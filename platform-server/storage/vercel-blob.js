// Vercel Blob 存储适配器
const { put, del, list, head } = require('@vercel/blob');

const BLOB_PREFIX = 'projects';

// 上传文件到 Blob
async function uploadFile(projectId, relativePath, buffer) {
  const key = `${BLOB_PREFIX}/${projectId}/${relativePath}`;
  const blob = await put(key, buffer, {
    access: 'public',
    addRandomSuffix: false,
  });
  return blob.url;
}

// 批量上传文件（从 ZIP 提取后的文件映射）
async function uploadProjectFiles(projectId, fileMap) {
  const results = [];
  for (const [relativePath, buffer] of Object.entries(fileMap)) {
    const url = await uploadFile(projectId, relativePath, buffer);
    results.push({ path: relativePath, url });
  }
  return results;
}

// 获取文件 URL
async function getFileUrl(projectId, relativePath) {
  const key = `${BLOB_PREFIX}/${projectId}/${relativePath}`;
  try {
    const blob = await head(key);
    return blob.url;
  } catch {
    return null;
  }
}

// 列出项目的所有文件
async function listProjectFiles(projectId) {
  const result = await list({ prefix: `${BLOB_PREFIX}/${projectId}/` });
  return result.blobs.map(b => ({
    path: b.pathname.replace(`${BLOB_PREFIX}/${projectId}/`, ''),
    url: b.url,
    size: b.size,
  }));
}

// 删除项目所有文件
async function deleteProjectFiles(projectId) {
  const blobs = await list({ prefix: `${BLOB_PREFIX}/${projectId}/` });
  for (const blob of blobs.blobs) {
    await del(blob.url);
  }
}

module.exports = {
  uploadFile,
  uploadProjectFiles,
  getFileUrl,
  listProjectFiles,
  deleteProjectFiles,
};
