// 存储抽象层 — 自动切换本地文件系统 / Vercel Blob
const path = require('path');
const fs = require('fs');

// 检测是否在 Vercel 环境（有 BLOB_STORE_ID）
const isVercel = !!(process.env.BLOB_STORE_ID);

let storageImpl;
if (isVercel) {
  storageImpl = require('./vercel-blob');
  console.log('[Storage] Using Vercel Blob');
} else {
  storageImpl = require('./local');
  console.log('[Storage] Using Local FS');
}

// 统一接口封装

// 上传并解压 ZIP 到目标
async function extractZip(projectId, zipBuffer, getPagesJson) {
  if (isVercel) {
    // Vercel Blob: 解压到内存，逐个上传
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    const fileMap = {};
    let pagesJson = null;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryName = entry.entryName;
      const buf = entry.getData();

      if (entryName === 'pages.json') {
        pagesJson = buf.toString('utf-8');
      }

      fileMap[entryName] = buf;
    }

    await storageImpl.uploadProjectFiles(projectId, fileMap);

    if (getPagesJson && !pagesJson) {
      pagesJson = getPagesJson(fileMap);
    }

    return { pagesJson, fileMap };
  } else {
    // 本地文件系统
    const AdmZip = require('adm-zip');
    const targetDir = path.join(__dirname, '..', '..', 'previewCache', 'projects', projectId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(targetDir, true);

    const pagesJsonPath = path.join(targetDir, 'pages.json');
    let pagesJson = null;
    if (fs.existsSync(pagesJsonPath)) {
      pagesJson = fs.readFileSync(pagesJsonPath, 'utf-8');
    }
    return { pagesJson, targetDir };
  }
}

// 获取文件内容或代理 URL
async function serveFile(projectId, relativePath) {
  if (isVercel) {
    return await storageImpl.getFileUrl(projectId, relativePath);
  } else {
    return storageImpl.getFilePath(projectId, relativePath);
  }
}

// 列出项目文件
async function listFiles(projectId) {
  if (isVercel) {
    return await storageImpl.listProjectFiles(projectId);
  } else {
    return storageImpl.listProjectFiles(projectId);
  }
}

// 删除项目文件
async function deleteFiles(projectId) {
  if (isVercel) {
    await storageImpl.deleteProjectFiles(projectId);
  } else {
    storageImpl.deleteProjectFiles(projectId);
  }
}

module.exports = {
  extractZip,
  serveFile,
  listFiles,
  deleteFiles,
  isVercel,
};
