// 本地文件系统存储适配器
const path = require('path');
const fs = require('fs');

const BASE_DIR = path.join(__dirname, '..', '..', 'previewCache', 'projects');

function getFilePath(projectId, relativePath) {
  const fullPath = path.join(BASE_DIR, projectId, relativePath);
  // 安全检查：防止路径遍历
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(BASE_DIR, projectId))) {
    return null;
  }
  if (fs.existsSync(resolved)) {
    return resolved;
  }
  return null;
}

function listProjectFiles(projectId) {
  const dir = path.join(BASE_DIR, projectId);
  if (!fs.existsSync(dir)) return [];
  const files = [];
  function walk(d) {
    const items = fs.readdirSync(d, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(d, item.name);
      const rel = path.relative(dir, full);
      if (item.isDirectory()) {
        walk(full);
      } else {
        files.push({ path: rel, fullPath: full, size: fs.statSync(full).size });
      }
    }
  }
  walk(dir);
  return files;
}

function deleteProjectFiles(projectId) {
  const dir = path.join(BASE_DIR, projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = {
  getFilePath,
  listProjectFiles,
  deleteProjectFiles,
};
