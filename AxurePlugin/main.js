const http = require('http');
const handler = require('serve-handler');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const FormData = require('form-data');
const crypto = require('crypto');
const vm = require('vm');
const os = require('os');
const cheerio = require('cheerio');

const AXURE_BASE = 'http://127.0.0.1:32767';

// Electron 打包后数据存到用户目录，非打包模式仍用当前目录
const isElectron = !!(process.versions && process.versions.electron);
const DATA_DIR = (() => {
    if (!isElectron) return __dirname;
    const home = require('os').homedir();
    if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'AxureSyncService');
    } else if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'AxureSyncService');
    }
    // Linux
    return path.join(home, '.config', 'AxureSyncService');
})();
const PREVIEW_DIR = path.join(DATA_DIR, 'preview');
const MANIFEST_FILE = path.join(DATA_DIR, 'manifest.json');
const TOKEN_FILE = path.join(DATA_DIR, 'token.json');
const LOCAL_CONFIG = path.join(__dirname, 'config.json');  // 打包内置配置
const USER_CONFIG = path.join(DATA_DIR, 'config.json');    // 用户自定义覆盖

// 读取配置：优先用户目录，其次打包内置
function loadConfig() {
    try {
        // 先读内置
        let cfg = {};
        if (fs.existsSync(LOCAL_CONFIG)) cfg = fs.readJsonSync(LOCAL_CONFIG);
        // 用户配置覆盖
        if (fs.existsSync(USER_CONFIG)) {
            const userCfg = fs.readJsonSync(USER_CONFIG);
            Object.assign(cfg, userCfg);
        }
        return cfg;
    } catch(e) { return {}; }
}
const APP_CONFIG = loadConfig();

// 服务器地址
const V2_API_BASE = (APP_CONFIG.serverUrl || 'http://localhost:3000').replace(/\/+$/, '') + '/api';

// UI 端口
let UI_PORT = APP_CONFIG.uiPort || APP_CONFIG.port || 8080;
if (UI_PORT < 1024 || UI_PORT > 65535) UI_PORT = 8080;

// 静态文件服务仍然用 __dirname（asar 内的只读文件）
const STATIC_DIR = __dirname;

let manifest = { projects: {} };

// 初始化环境
fs.ensureDirSync(PREVIEW_DIR);
if (fs.existsSync(MANIFEST_FILE)) {
    try { manifest = fs.readJsonSync(MANIFEST_FILE); } catch (e) { manifest = { projects: {} }; }
} else {
    // 创建空结构，确保 UI 能正常读取
    fs.writeJsonSync(MANIFEST_FILE, manifest, { spaces: 2 });
}

// ==================== Token 管理 ====================

function saveTokens(accessToken, refreshToken) {
    const data = {};
    if (accessToken) data.accessToken = accessToken;
    if (refreshToken) data.refreshToken = refreshToken;
    
    if (fs.existsSync(TOKEN_FILE)) {
        const existing = fs.readJsonSync(TOKEN_FILE);
        if (!accessToken && existing.accessToken) data.accessToken = existing.accessToken;
        if (!refreshToken && existing.refreshToken) data.refreshToken = existing.refreshToken;
    }
    
    fs.writeJsonSync(TOKEN_FILE, data, { spaces: 2 });
}

function loadTokens() {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    try {
        return fs.readJsonSync(TOKEN_FILE);
    } catch (e) {
        return null;
    }
}

function clearTokens() {
    if (fs.existsSync(TOKEN_FILE)) fs.removeSync(TOKEN_FILE);
}

// 检查 token 是否过期
function isTokenExpired(token) {
    if (!token) return true;
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.exp * 1000 < Date.now();
    } catch (e) {
        return true;
    }
}

// 刷新 token
async function refreshAccessToken() {
    const tokens = loadTokens();
    if (!tokens || !tokens.refreshToken) {
        throw new Error('No refresh token available');
    }
    
    try {
        const res = await axios.post(`${V2_API_BASE}/auth/refresh`, {
            refreshToken: tokens.refreshToken
        });
        
        if (res.data && res.data.accessToken) {
            saveTokens(res.data.accessToken, null);
            return res.data.accessToken;
        }
        throw new Error('Failed to refresh token');
    } catch (e) {
        clearTokens();
        throw new Error('Refresh token invalid');
    }
}

// 获取有效 access token
async function getValidAccessToken() {
    const tokens = loadTokens();
    if (!tokens || !tokens.accessToken) return null;
    
    if (isTokenExpired(tokens.accessToken)) {
        // Token 过期，尝试刷新
        try {
            return await refreshAccessToken();
        } catch (e) {
            return null;
        }
    }
    
    return tokens.accessToken;
}

// ==================== API 处理 ====================

// 读取请求主体
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

// 上传进度状态
const uploadProgress = new Map(); // key: uploadId, value: { stage, progress, error }
let _uploadIdCounter = 0;
function nextUploadId() { return `upload_${++_uploadIdCounter}`; }

async function handleApiRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    try {
        // POST /api/login
        if (pathname === '/api/login' && req.method === 'POST') {
            const body = await readBody(req);
            const data = JSON.parse(body);
            const { username, password } = data;
            
            if (!username || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '用户名和密码不能为空' }));
                return;
            }
            
            try {
                const result = await axios.post(`${V2_API_BASE}/auth/login`, { username, password });
                const { accessToken, refreshToken, user } = result.data;
                
                saveTokens(accessToken, refreshToken);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, accessToken, refreshToken, user }));
            } catch (e) {
                const error = e.response?.data?.error || '登录失败';
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error }));
            }
            return;
        }
        
        // GET /api/me
        if (pathname === '/api/me' && req.method === 'GET') {
            const tokens = loadTokens();
            if (!tokens || !tokens.accessToken) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '未登录' }));
                return;
            }
            
            try {
                const result = await axios.get(`${V2_API_BASE}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.data));
            } catch (e) {
                clearTokens();
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'token无效' }));
            }
            return;
        }
        
        // POST /api/logout
        if (pathname === '/api/logout' && req.method === 'POST') {
            const tokens = loadTokens();
            if (tokens && tokens.refreshToken) {
                try {
                    await axios.post(`${V2_API_BASE}/auth/logout`, {
                        refreshToken: tokens.refreshToken
                    });
                } catch (e) {
                    // ignore
                }
            }
            
            clearTokens();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
        }
        
        // POST /api/refresh
        if (pathname === '/api/refresh' && req.method === 'POST') {
            try {
                const newToken = await refreshAccessToken();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, accessToken: newToken }));
            } catch (e) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
            return;
        }
        
        // GET /api/projects
        if (pathname === '/api/projects' && req.method === 'GET') {
            try {
                const token = await getValidAccessToken();
                if (!token) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '未登录' }));
                    return;
                }
                
                const result = await axios.get(`${V2_API_BASE}/upload/my-projects`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.data));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
            return;
        }
        
        // POST /api/upload
        if (pathname === '/api/upload' && req.method === 'POST') {
            const body = await readBody(req);
            const data = JSON.parse(body);
            const { projectId } = data;
            const uploadId = data.uploadId || nextUploadId();
            
            // 初始化进度
            uploadProgress.set(uploadId, { stage: 'packing', progress: 0, uploadId });
            
            if (!projectId) {
                uploadProgress.set(uploadId, { stage: 'error', progress: 0, error: '缺少 projectId', uploadId });
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '缺少 projectId', uploadId }));
                return;
            }
            
            try {
                // 1. 打包 preview/ 目录为 ZIP
                const zip = new AdmZip();
                
                const addDirToZip = (dir, zipPath = '') => {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const fullPath = path.join(dir, file);
                        const zipFilePath = zipPath ? `${zipPath}/${file}` : file;
                        if (fs.statSync(fullPath).isDirectory()) {
                            addDirToZip(fullPath, zipFilePath);
                        } else {
                            zip.addLocalFile(fullPath, zipPath);
                        }
                    }
                };
                
                addDirToZip(PREVIEW_DIR);
                const zipBuffer = zip.toBuffer();
                
                // 检查文件大小
                if (zipBuffer.length > 200 * 1024 * 1024) {
                    uploadProgress.set(uploadId, { stage: 'error', progress: 0, 
                        error: '项目文件超过200MB限制，请精简后再上传', uploadId });
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '项目文件超过200MB限制，请精简后再上传', uploadId }));
                    return;
                }
                
                // 2. 上传到 v2 服务端
                const token = await getValidAccessToken();
                if (!token) {
                    uploadProgress.set(uploadId, { stage: 'error', progress: 0, 
                        error: '未登录或登录信息已失效', uploadId });
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '未登录或登录信息已失效', uploadId }));
                    return;
                }
                
                uploadProgress.set(uploadId, { stage: 'uploading', progress: 0, uploadId });
                
                const formData = new FormData();
                formData.append('file', zipBuffer, { filename: 'preview.zip' });
                formData.append('projectId', projectId);
                
                const uploadRes = await axios.post(`${V2_API_BASE}/upload`, formData, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        ...formData.getHeaders()
                    },
                    timeout: 120000,
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                            uploadProgress.set(uploadId, { stage: 'uploading', progress: pct, uploadId });
                        }
                    }
                });
                
                uploadProgress.set(uploadId, { stage: 'done', progress: 100, uploadId });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ...uploadRes.data, uploadId }));
            } catch (e) {
                console.error('Upload error:', e);
                let errorMsg = '上传失败';
                if (e.code === 'ECONNABORTED') {
                    errorMsg = '上传超时，请检查网络连接';
                } else if (e.response && e.response.status === 413) {
                    errorMsg = '项目文件超过200MB限制，请精简后再上传';
                } else if (e.response && e.response.data && e.response.data.error) {
                    errorMsg = e.response.data.error;
                } else {
                    errorMsg = e.message || '网络错误';
                }
                uploadProgress.set(uploadId, { stage: 'error', progress: 0, error: errorMsg, uploadId });
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: errorMsg, uploadId }));
            }
            return;
        }
        
        // POST /api/register
        if (pathname === '/api/register' && req.method === 'POST') {
            const body = await readBody(req);
            const data = JSON.parse(body);
            const { username, password } = data;

            if (!username || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '用户名和密码不能为空' }));
                return;
            }

            try {
                const result = await axios.post(`${V2_API_BASE}/auth/register`, { username, password });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.data));
            } catch (e) {
                const error = e.response?.data?.error || '注册失败';
                res.writeHead(e.response?.status || 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error }));
            }
            return;
        }

        // POST /api/project/delete
        if (pathname === '/api/project/delete' && req.method === 'POST') {
            const body = await readBody(req);
            const data = JSON.parse(body);
            const { name } = data;

            if (!name) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '缺少项目名称' }));
                return;
            }

            try {
                // 删除预览目录
                const projectDir = path.join(PREVIEW_DIR, name);
                if (fs.existsSync(projectDir)) {
                    fs.removeSync(projectDir);
                }

                // 从 manifest 中移除
                if (manifest.projects[name]) {
                    delete manifest.projects[name];
                    fs.writeJsonSync(MANIFEST_FILE, manifest, { spaces: 2 });
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
            return;
        }

        // POST /api/project/upload
        if (pathname === '/api/project/upload' && req.method === 'POST') {
            const body = await readBody(req);
            const data = JSON.parse(body);
            const { name, projectId } = data;
            const uploadId = data.uploadId || nextUploadId();

            // 初始化进度
            uploadProgress.set(uploadId, { stage: 'packing', progress: 0, uploadId });

            if (!name || !projectId) {
                uploadProgress.set(uploadId, { stage: 'error', progress: 0, 
                    error: '缺少项目名称或projectId', uploadId });
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '缺少项目名称或projectId', uploadId }));
                return;
            }

            try {
                const projectDir = path.join(PREVIEW_DIR, name);
                if (!fs.existsSync(projectDir)) {
                    uploadProgress.set(uploadId, { stage: 'error', progress: 0, 
                        error: '项目预览文件不存在', uploadId });
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '项目预览文件不存在', uploadId }));
                    return;
                }

                const zip = new AdmZip();
                const addDirToZip = (dir, zipPath = '') => {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const fullPath = path.join(dir, file);
                        const zipFilePath = zipPath ? `${zipPath}/${file}` : file;
                        if (fs.statSync(fullPath).isDirectory()) {
                            addDirToZip(fullPath, zipFilePath);
                        } else {
                            zip.addLocalFile(fullPath, zipPath);
                        }
                    }
                };
                addDirToZip(projectDir, '');

                const zipBuffer = zip.toBuffer();

                // 检查文件大小
                if (zipBuffer.length > 200 * 1024 * 1024) {
                    uploadProgress.set(uploadId, { stage: 'error', progress: 0, 
                        error: '项目文件超过200MB限制，请精简后再上传', uploadId });
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '项目文件超过200MB限制，请精简后再上传', uploadId }));
                    return;
                }

                const token = await getValidAccessToken();
                if (!token) {
                    uploadProgress.set(uploadId, { stage: 'error', progress: 0, 
                        error: '未登录或登录信息已失效', uploadId });
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: '未登录或登录信息已失效', uploadId }));
                    return;
                }

                uploadProgress.set(uploadId, { stage: 'uploading', progress: 0, uploadId });

                const formData = new FormData();
                formData.append('file', zipBuffer, { filename: 'preview.zip' });
                formData.append('projectId', projectId);

                const uploadRes = await axios.post(`${V2_API_BASE}/upload`, formData, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        ...formData.getHeaders()
                    },
                    timeout: 120000,
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                            uploadProgress.set(uploadId, { stage: 'uploading', progress: pct, uploadId });
                        }
                    }
                });

                uploadProgress.set(uploadId, { stage: 'done', progress: 100, uploadId });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ...uploadRes.data, uploadId }));
            } catch (e) {
                console.error('Upload error:', e);
                let errorMsg = '上传失败';
                if (e.code === 'ECONNABORTED') {
                    errorMsg = '上传超时，请检查网络连接';
                } else if (e.response && e.response.status === 413) {
                    errorMsg = '项目文件超过200MB限制，请精简后再上传';
                } else if (e.response && e.response.data && e.response.data.error) {
                    errorMsg = e.response.data.error;
                } else {
                    errorMsg = e.message || '网络错误';
                }
                uploadProgress.set(uploadId, { stage: 'error', progress: 0, error: errorMsg, uploadId });
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: errorMsg, uploadId }));
            }
            return;
        }

        // GET /api/manifest — 从 AppData 目录读取 manifest（避开路径不匹配）
        if (pathname === '/api/manifest' && req.method === 'GET') {
            try {
                if (fs.existsSync(MANIFEST_FILE)) {
                    const mf = fs.readJsonSync(MANIFEST_FILE);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(mf));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ projects: {} }));
                }
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }

        // GET /api/config — 读取当前配置
        if (pathname === '/api/config' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ port: UI_PORT }));
            return;
        }

        // POST /api/config — 保存配置（仅写文件，用户手动重启生效）
        if (pathname === '/api/config' && req.method === 'POST') {
            const body = await readBody(req);
            const { port } = JSON.parse(body);
            if (!port || port < 1024 || port > 65535) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '端口范围 1024-65535' }));
                return;
            }
            fs.writeJsonSync(USER_CONFIG, { port, ...loadConfig() });
            UI_PORT = port;  // 同步更新内存变量，齿轮打开立即看到新值
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, port }));
            return;
        }

        // GET /api/upload/progress?uploadId=xxx — 轮询上传进度
        if (pathname === '/api/upload/progress' && req.method === 'GET') {
            const uploadId = url.searchParams.get('uploadId');
            if (!uploadId || !uploadProgress.has(uploadId)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ stage: 'idle', progress: 0 }));
                return;
            }
            const info = uploadProgress.get(uploadId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(info));
            // 完成后保留 30 秒再清理
            if (info.stage === 'done' || info.stage === 'error') {
                setTimeout(() => uploadProgress.delete(uploadId), 30000);
            }
            return;
        }

        // 默认：交给 serve-handler 处理静态文件
        handler(req, res, { public: '.' });
    } catch (e) {
        console.error('API error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
    }
}

// ==================== Axure 监控逻辑 ====================

const getMD5 = (str) => crypto.createHash('md5').update(str || '').digest('hex');

// 递归清理空文件夹
function cleanEmptyDirs(dirPath) {
    if (!fs.existsSync(dirPath) || dirPath === PREVIEW_DIR) return;
    
    let files = fs.readdirSync(dirPath);
    if (files.length > 0) {
        files.forEach(file => {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) cleanEmptyDirs(fullPath);
        });
        files = fs.readdirSync(dirPath);
    }
    
    if (files.length === 0) {
        try { fs.rmdirSync(dirPath); console.log(`  [清理] 空目录已移除: ${path.relative(PREVIEW_DIR, dirPath)}`); } catch(e){}
    }
}

// 资源下载：对齐根目录，防止路径偏移
async function downloadAsset(assetUrl, projectDir, pageRelPath) {
    if (!assetUrl || assetUrl.startsWith('data:')) return assetUrl;
    
    let cleanUrl = assetUrl.split('?')[0];
    let isRemote = assetUrl.startsWith('http');
    let localRel = isRemote 
        ? `resources/remote/${getMD5(cleanUrl)}${path.extname(cleanUrl) || '.css'}`
        : cleanUrl.replace(/^(\.\.\/)+/, '').replace(/^\//, '');
    
    const localFullPath = path.join(projectDir, localRel);
    
    try {
        const target = isRemote ? assetUrl : `${AXURE_BASE}/${localRel}`;
        const res = await axios.get(target, { responseType: 'arraybuffer', timeout: 5000 });
        await fs.ensureDir(path.dirname(localFullPath));
        await fs.writeFile(localFullPath, res.data);
    } catch (e) {
        if (!fs.existsSync(localFullPath)) return assetUrl;
    }
    
    const depth = pageRelPath.split('/').filter(p => p).length - 1;
    const prefix = depth > 0 ? '../'.repeat(depth) : '';
    return `${prefix}${localRel}?v=${Date.now()}`;
}

// 页面抓取与 HTML 物理写入
async function downloadPage(projName, pageUrl, remoteMd5) {
    try {
        const projectDir = path.join(PREVIEW_DIR, projName);
        const pageRecord = manifest.projects[projName].pages[pageUrl];
        if (!pageRecord) return;
        
        const { data: html } = await axios.get(`${AXURE_BASE}/${pageUrl}`, { timeout: 5000 });
        const $ = cheerio.load(html);
        
        $('head').prepend(`<script>window.location.isLocal=true;window.__axure_local_mode=true;</script>`);
        
        const assetTasks = [];
        [['link','href'],['script','src'],['img','src']].forEach(([tag, attr]) => {
            $(tag).each((i, el) => {
                const url = $(el).attr(attr);
                if (url) assetTasks.push(downloadAsset(url, projectDir, pageRecord.path).then(p => $(el).attr(attr, p)));
            });
        });
        
        const scriptSrc = $('script[src*="data.js"]').attr('src');
        if (scriptSrc) {
            try {
                const dataJsUrl = `${AXURE_BASE}/${scriptSrc}`.replace(/([^:])\/\//g, '$1/');
                const res = await axios.get(dataJsUrl, { timeout: 3000 });
                let dataJsContent = res.data;
                // 下载图片并替换 data.js 中的路径
                const imgMatches = dataJsContent.match(/"images\/[^"]+\.(svg|png|jpg|gif)"/g);
                if (imgMatches) {
                    for (let m of imgMatches) {
                        const imgPath = m.replace(/"/g, '');
                        const newPath = await downloadAsset(imgPath, projectDir, pageRecord.path);
                        dataJsContent = dataJsContent.replace(m, '"' + newPath + '"');
                    }
                }
                // 下载并修正 data.js 中的字体引用
                const fontMatches = dataJsContent.match(/"sketchfonts\/[^"]+\.ttf"/g);
                if (fontMatches) {
                    for (let m of fontMatches) {
                        const fontPath = m.replace(/"/g, '');
                        const newPath = await downloadAsset(fontPath, projectDir, pageRecord.path);
                        dataJsContent = dataJsContent.replace(m, '"' + newPath + '"');
                    }
                }
                // 写入修正后的 data.js 到页面同级目录
                const pageDir = path.dirname(path.join(projectDir, pageRecord.path));
                const dataJsFullPath = path.join(pageDir, 'data.js');
                await fs.ensureDir(pageDir);
                await fs.writeFile(dataJsFullPath, dataJsContent);
                // 更新 HTML 中的 script src 指向本地文件
                $('script[src*="data.js"]').attr('src', 'data.js?v=' + Date.now());
            } catch (e) { console.error(`  [data.js] ${e.message}`); }
        }
        
        await Promise.all(assetTasks);
        const fullPath = path.join(projectDir, pageRecord.path);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, $.html());
        
        pageRecord.dataJsMd5 = remoteMd5;
        fs.writeJsonSync(MANIFEST_FILE, manifest, { spaces: 2 });
        console.log(`  [写入] ${pageUrl}`);
    } catch (e) { console.error(`  [错误] ${pageUrl}: ${e.message}`); }
}

async function monitor() {
    try {
        const startRes = await axios.get(`${AXURE_BASE}/start.html`, { timeout: 1000 });
        const projName = startRes.data.match(/fileName\s*:\s*'([^']+)'/)?.[1]?.trim() || 'Default';
        const projectDir = path.join(PREVIEW_DIR, projName);
        
        if (!manifest.projects[projName]) manifest.projects[projName] = { pages: {} };
        
        const docRes = await axios.get(`${AXURE_BASE}/data/document.js`, { timeout: 2000 });
        const sandbox = { $axure: { loadDocument: d => d } };
        vm.createContext(sandbox);
        const docObj = vm.runInContext(docRes.data, sandbox);
        
        const currentUrls = new Set();
        const extract = (nodes) => nodes.forEach(n => { if(n.url) currentUrls.add(n.url); if(n.children) extract(n.children); });
        extract(docObj.sitemap.rootNodes);
        
        let deleted = false;
        for (const url in manifest.projects[projName].pages) {
            if (!currentUrls.has(url)) {
                const oldPath = path.join(projectDir, manifest.projects[projName].pages[url].path);
                if (fs.existsSync(oldPath)) fs.removeSync(oldPath);
                delete manifest.projects[projName].pages[url];
                deleted = true;
                console.log(`\n[移除] 页面: ${url}`);
            }
        }
        if (deleted) cleanEmptyDirs(projectDir);
        
        manifest.projects[projName].tree = await recursiveSync(docObj.sitemap.rootNodes, '', projName);
        
        for (const url in manifest.projects[projName].pages) {
            const info = manifest.projects[projName].pages[url];
            try {
                const djsRes = await axios.get(`${AXURE_BASE}/files/${url.split('.')[0]}/data.js`, { timeout: 1000 });
                const remoteMd5 = getMD5(djsRes.data);
                if (remoteMd5 !== info.dataJsMd5) {
                    console.log(`\n[更新] 发现变动: ${url}`);
                    await downloadPage(projName, url, remoteMd5);
                }
            } catch (e) { if (!info.dataJsMd5) await downloadPage(projName, url, ''); }
        }
        manifest.projects[projName].lastSync = Date.now();
        manifest._axureOnline = true;
        fs.writeJsonSync(MANIFEST_FILE, manifest, { spaces: 2 });

        // 生成 pages.json
        const pagesJson = { tree: manifest.projects[projName].tree || [] };
        const pagesJsonPath = path.join(PREVIEW_DIR, projName, 'pages.json');
        fs.writeJsonSync(pagesJsonPath, pagesJson, { spaces: 2 });
        process.stdout.write(`\r[${new Date().toLocaleTimeString()}] 正在运行: ${projName} ... `);
    } catch (e) {
        if (e.code === 'ECONNREFUSED') {
            manifest._axureOnline = false;
            fs.writeJsonSync(MANIFEST_FILE, manifest, { spaces: 2 });
            process.stdout.write(`\r[等待] 请在Axure中点击预览...      `);
        }
    }
    setTimeout(monitor, 3000);
}

async function recursiveSync(nodes, currentPath, projName) {
    let tree = [];
    for (const node of nodes) {
        const folderName = node.pageName.replace(/[\/\\?%*:|"<>]/g, '-');
        let info = { name: node.pageName, url: node.url, children: [] };
        if (node.url) {
            const rel = path.join(currentPath, folderName, node.url).replace(/\\/g, '/');
            if (!manifest.projects[projName].pages[node.url]) {
                console.log(`\n[新增] ${node.pageName}`);
                manifest.projects[projName].pages[node.url] = { path: rel, dataJsMd5: '' };
                await downloadPage(projName, node.url, '');
            }
            info.relPath = rel;
        }
        if (node.children) info.children = await recursiveSync(node.children, path.join(currentPath, folderName), projName);
        tree.push(info);
    }
    return tree;
}

// 启动服务器
const serverPublicDir = isElectron ? __dirname : '.';
const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
        handleApiRequest(req, res);
    } else {
        handler(req, res, { public: serverPublicDir });
    }
})
.listen(UI_PORT, () => {
    console.log(`\n同步服务已启动: http://localhost:${UI_PORT}\n`);
    monitor();
});
