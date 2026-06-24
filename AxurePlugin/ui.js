// ui.js - 插件前端交互逻辑

let currentUser = null;
let serverProjects = [];
let openIds = new Set();
let lastSyncSuccess = true;
let syncErrorMsg = '';

// ==================== 图标 ====================
const Icons = {
    folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    file: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    upload: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    pages: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
};

// ==================== 路由 ====================
function showPage(name) {
    // 清除遗留的动态弹窗遮罩和 toast，防止挡住新页面
    document.querySelectorAll('.modal-overlay:not(#config-modal)').forEach(el => el.remove());
    document.querySelectorAll('.toast').forEach(el => el.remove());

    ['page-login', 'page-register', 'page-main'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === name ? 'block' : 'none';
    });
}

function router() {
    const hash = location.hash.slice(1) || '/login';
    if (hash === '/register') {
        showPage('page-register');
    } else if (hash === '/main') {
        showPage('page-main');
    } else {
        showPage('page-login');
    }
}

// ==================== Toast ====================
function showToast(msg, type, persistent) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.textContent = msg;
    document.body.appendChild(t);
    if (!persistent) {
        setTimeout(() => { if (t.parentNode) t.remove(); }, 2800);
    }
    return t;
}

// ==================== 弹窗 ====================
function showModal(html) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    return overlay;
}

// ==================== 认证 ====================
async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (data.success) {
            currentUser = data.data;
            showPage('page-main');
            updateUserBadge();
            loadProjects();
        } else {
            showPage('page-login');
        }
    } catch (e) {
        showPage('page-login');
    }
}

// ==================== 登录 ====================
async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    if (!username || !password) {
        errEl.textContent = '请输入用户名和密码';
        return;
    }
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            location.hash = '#/main';
            showPage('page-main');
            loadProjects();
            updateUserBadge();
            errEl.textContent = '';
        } else {
            errEl.textContent = data.error || '登录失败';
        }
    } catch (e) {
        errEl.textContent = '网络错误，请重试';
    }
}

// ==================== 注册 ====================
async function doRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const errEl = document.getElementById('register-error');

    if (!username || !password || !password2) {
        errEl.textContent = '请填写所有内容';
        errEl.className = 'auth-error';
        return;
    }
    if (username.length < 3) {
        errEl.textContent = '用户名至少3位字符';
        errEl.className = 'auth-error';
        return;
    }
    if (password.length < 6) {
        errEl.textContent = '密码至少6位字符';
        errEl.className = 'auth-error';
        return;
    }
    if (password !== password2) {
        errEl.textContent = '两次密码输入不一致';
        errEl.className = 'auth-error';
        return;
    }

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            errEl.className = 'auth-error auth-success';
            errEl.textContent = '注册成功';
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-password2').value = '';
            setTimeout(() => { location.hash = '#/login'; router(); }, 800);
        } else {
            errEl.className = 'auth-error';
            errEl.textContent = data.error || '注册失败';
        }
    } catch (e) {
        errEl.className = 'auth-error';
        errEl.textContent = '网络错误，请重试';
    }
}

// ==================== 注销 ====================
async function doLogout() {
    if (!confirm('确定要注销登录吗？')) return;
    // 不 await，fire-and-forget — 不阻塞 UI 切换
    fetch('/api/logout', { method: 'POST' }).catch(() => {});
    currentUser = null;
    openIds.clear();
    location.hash = '#/login';
    showPage('page-login');
}

// ==================== 加载服务端项目列表 ====================
async function loadProjects() {
    try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        if (data.success) {
            serverProjects = data.projects || [];
        }
    } catch (e) {
        console.error('Failed to load projects:', e);
    }
}

function updateUserBadge() {
    const el = document.getElementById('user-badge');
    if (el && currentUser) {
        el.innerHTML = Icons.user + ' ' + currentUser.username;
    }
}

// ==================== 格式化时间 ====================
function formatSyncTime(ts) {
    if (!ts) return '未同步';
    const d = new Date(ts);
    const dateStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    const timeStr = String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');
    return dateStr + ' ' + timeStr;
}

// ==================== 上传弹窗 ====================
function showUploadModal(projectName) {
    loadProjects().then(() => {
        const options = serverProjects.map(p =>
            '<option value="' + p.id + '">' + p.name + '</option>'
        ).join('');

        const overlay = showModal('<div class="modal">' +
            '<div class="modal-header">' +
            '<h3>上传项目</h3>' +
            '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button></div>' +
            '<div class="modal-body">' +
            '<p>将 "<strong>' + projectName + '</strong>" 上传项目：</p>' +
            '<select id="upload-project-select"><option value="">选择目标项目</option>' + options + '</select>' +
            '</div>' +
            '<div class="modal-footer">' +
            '<button class="btn-cancel" onclick="this.closest(\'.modal-overlay\').remove()">取消</button>' +
            '<button class="btn-confirm" id="btn-confirm-upload">确认上传</button>' +
            '</div></div>');

        overlay.querySelector('#btn-confirm-upload').addEventListener('click', async () => {
            const projectId = overlay.querySelector('#upload-project-select').value;
            if (!projectId) { showToast('请选择目标项目', 'error'); return; }
            overlay.remove();
            await doProjectUpload(projectName, projectId);
        });
    });
}

async function doProjectUpload(name, projectId) {
    const uploadId = 'upload_' + Date.now();
    let progressToast = showToast('打包中...', 'info', true);
    let pollTimer = null;

    try {
        const res = await fetch('/api/project/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, projectId, uploadId })
        });

        // 开始轮询进度
        pollTimer = setInterval(async () => {
            try {
                const pRes = await fetch('/api/upload/progress?uploadId=' + uploadId);
                const pData = await pRes.json();
                if (pData.stage === 'uploading') {
                    updateToast(progressToast, '上传中... ' + pData.progress + '%', 'info');
                } else if (pData.stage === 'done') {
                    clearInterval(pollTimer);
                    updateToast(progressToast, '上传成功', 'success');
                } else if (pData.stage === 'error') {
                    clearInterval(pollTimer);
                    updateToast(progressToast, '上传失败：' + (pData.error || '未知错误'), 'error');
                } else if (pData.stage === 'packing') {
                    updateToast(progressToast, '打包中...', 'info');
                }
            } catch (e) {
                // 轮询失败忽略
            }
        }, 500);

        const data = await res.json();
        // 清除轮询（如果响应先到）
        if (pollTimer) clearInterval(pollTimer);

        if (data.success) {
            updateToast(progressToast, '上传成功', 'success');
        } else {
            updateToast(progressToast, '上传失败：' + (data.error || '未知错误'), 'error');
        }
    } catch (e) {
        if (pollTimer) clearInterval(pollTimer);
        updateToast(progressToast, '上传失败：网络错误', 'error');
    }
}

// 更新已有 toast 的内容（保留引用，避免重复创建）
function updateToast(toastEl, message, type) {
    if (!toastEl) return;
    toastEl.textContent = '';
    // 根据类型设置样式
    const colors = { success: '#059669', error: '#dc2626', info: '#2563eb', warning: '#d97706' };
    toastEl.style.background = colors[type] || colors.info;
    toastEl.style.color = '#fff';
    toastEl.textContent = message;
    toastEl.style.display = 'block';
    // 成功/错误消息自动消失
    if (type === 'success' || type === 'error') {
        setTimeout(() => { if (toastEl) toastEl.remove(); }, 3000);
    }
}

// ==================== 删除弹窗 ====================
function showDeleteModal(projectName) {
    const overlay = showModal('<div class="modal">' +
        '<div class="modal-header">' +
        '<h3>删除项目缓存</h3>' +
        '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button></div>' +
        '<div class="modal-body">' +
        '<p style="color:#991b1b;">将删除 "<strong>' + projectName + '</strong>" 本地缓存的预览文件，不影响已上传的内容。</p>' +
        '<p>此操作不可撤销，确定要继续吗？</p>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button class="btn-cancel" onclick="this.closest(\'.modal-overlay\').remove()">取消</button>' +
        '<button class="btn-danger" id="btn-confirm-delete">确认删除</button>' +
        '</div></div>');

    overlay.querySelector('#btn-confirm-delete').addEventListener('click', async () => {
        overlay.remove();
        await doProjectDelete(projectName);
    });
}

async function doProjectDelete(name) {
    showToast('正在删除...', 'info');
    try {
        const res = await fetch('/api/project/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.success) {
            showToast('已删除本地缓存', 'success');
            update();
        } else {
            showToast('删除失败：' + (data.error || '未知错误'), 'error');
        }
    } catch (e) {
        showToast('删除失败：网络错误', 'error');
    }
}

// ==================== 树渲染 ====================
function buildTree(nodes, projName) {
    return nodes.map(node => {
        if (!node.url && node.children && node.children.length === 0) return '';
        let html = '<li>';
        if (node.url) {
            html += '<span class="tree-file">' + Icons.file + ' ' + node.name + '</span>';
        } else {
            html += '<div class="folder">' + Icons.folder + ' ' + node.name + '</div>';
        }
        if (node.children && node.children.length > 0) {
            html += '<ul class="tree">' + buildTree(node.children, projName) + '</ul>';
        }
        html += '</li>';
        return html;
    }).join('');
}

function toggleCard(cardId) {
    const el = document.getElementById(cardId);
    if (el) {
        const isOpen = el.classList.toggle('open');
        if (isOpen) openIds.add(cardId); else openIds.delete(cardId);
    }
}

// ==================== 渲染 ====================
async function update() {
    try {
        const res = await fetch('/api/manifest?t=' + Date.now());
        if (!res.ok) throw new Error('no manifest');
        const data = await res.json();
        render(data);
        lastSyncSuccess = data._axureOnline !== false;
        syncErrorMsg = '';
    } catch (e) {
        lastSyncSuccess = false;
        syncErrorMsg = Object.keys(manifest.projects || {}).length > 0 ? '无法连接同步服务' : '';
    }
    updateStatus();
}

function updateStatus() {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (dot && text) {
        if (lastSyncSuccess) {
            dot.classList.remove('error');
            text.textContent = '已开启自动同步';
        } else {
            dot.classList.add('error');
            text.textContent = syncErrorMsg || '等待Axure启动预览';
        }
    }
}

function render(data) {
    const names = Object.keys(data.projects);
    const countEl = document.getElementById('projects-count');
    const listEl = document.getElementById('project-list');
    const emptyEl = document.getElementById('empty-state');
    if (countEl) countEl.textContent = names.length;

    if (names.length === 0) {
        if (listEl) listEl.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    names.sort((a, b) => {
        const ta = data.projects[a].lastSync || 0;
        const tb = data.projects[b].lastSync || 0;
        return tb - ta;
    });

    let html = '';
    names.forEach(name => {
        const proj = data.projects[name];
        const cardId = 'card-' + name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-');
        const isOpen = openIds.has(cardId) ? ' open' : '';
        const pageCount = Object.keys(proj.pages || {}).length;
        const lastSync = formatSyncTime(proj.lastSync);

        html += '<div class="project-card' + isOpen + '" id="' + cardId + '">' +
            '<div class="project-card-main" onclick="toggleCard(\'' + cardId + '\')">' +
            '<div class="project-icon">' + Icons.folder + '</div>' +
            '<div class="project-info">' +
            '<div class="project-name">' + name + '</div>' +
            '<div class="project-meta">' +
            '<span>' + Icons.pages + ' ' + pageCount + ' 页</span>' +
            '<span>' + Icons.clock + ' ' + lastSync + '</span>' +
            '</div></div>' +
            '<div class="project-actions">' +
            '<button class="action-btn upload-btn" title="上传到管理平台" onclick="event.stopPropagation();showUploadModal(\'' + name + '\')">' + Icons.upload + '</button>' +
            '<button class="action-btn delete-btn" title="删除本地缓存" onclick="event.stopPropagation();showDeleteModal(\'' + name + '\')">' + Icons.trash + '</button>' +
            '</div></div>' +
            '<div class="project-card-body">' +
            '<ul class="tree">' + buildTree(proj.tree || [], name) + '</ul>' +
            '</div></div>';
    });

    if (listEl) listEl.innerHTML = html;
}

// ==================== 初始化 ====================
window.onload = () => {
    // hash 导航
    window.addEventListener('hashchange', router);

    // 回车事件
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            if (document.getElementById('page-login').style.display !== 'none') {
                doLogin();
            } else if (document.getElementById('page-register').style.display !== 'none') {
                doRegister();
            }
        }
    });

    updateUserBadge();
    checkAuth();
    setInterval(update, 3000);
    update();
};

// ===== 服务配置 =====
function showConfigModal() {
    fetch('/api/config').then(r=>r.json()).then(d=>{
        document.getElementById('config-port').value = d.port || 8080;
    }).catch(()=>{});
    document.getElementById('config-modal').style.display = 'flex';
}
async function saveConfig() {
    const port = parseInt(document.getElementById('config-port').value) || 8080;
    if (port < 1024 || port > 65535) { alert('端口范围: 1024-65535'); return; }
    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({port})
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('config-modal').style.display = 'none';
            alert('端口已保存为 ' + port + '，请关闭程序重新打开生效');
        } else {
            alert('保存失败: ' + (data.error || '未知错误'));
        }
    } catch(e) { alert('保存失败: ' + e.message); }
}
window.showConfigModal = showConfigModal;
window.saveConfig = saveConfig;
