const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db/connector');
const { authMiddleware } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rate-limit');
const storage = require('../storage');

router.use(authMiddleware);

// 检查用户状态
async function checkUserStatus(userId) {
  const user = await db.get('SELECT status FROM users WHERE id = ?', [userId]);
  return user && user.status === 1;
}

// multer 内存存储（先存内存，再交给 storage 层处理）
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage, limits: { fileSize: 200 * 1024 * 1024 } });

// 上传接口：multer → 限流 → 业务逻辑
router.post('/',
  upload.single('file'),
  rateLimit('upload', req => req.user?.userId, req => req.file?.size || 0),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: '未收到上传文件，可能文件过大（最大200MB）或格式不正确' });
    }

    const projectId = req.body.projectId;
    if (!projectId) {
      return res.status(400).json({ error: '缺少 projectId' });
    }

    try {
      // 检查用户状态
      if (!(await checkUserStatus(req.user.userId))) {
        return res.status(403).json({ error: '账号已被禁用' });
      }

      // 检查项目是否存在且用户有权限
      const project = await db.get(
        'SELECT id, pages_json FROM projects WHERE id = ? AND owner_id = ?',
        [projectId, req.user.userId]
      );
      if (!project) {
        return res.status(404).json({ error: '项目不存在或无权限' });
      }

      // 使用 storage 层解压 ZIP
      const result = await storage.extractZip(projectId, req.file.buffer);
      const pagesJson = result.pagesJson;

      // 更新项目 pages_json
      await db.run(
        'UPDATE projects SET pages_json = ?, updated_at = ? WHERE id = ?',
        [pagesJson, Math.floor(Date.now() / 1000), projectId]
      );

      // 版本号递增
      const { incrementVersion, recordVersion } = require('./comments');
      const newVersion = await incrementVersion(projectId);
      await recordVersion(projectId, newVersion, pagesJson);

      res.json({ success: true, message: '上传成功', version: newVersion, hasPagesJson: !!pagesJson });
    } catch (e) {
      console.error('Upload error:', e);
      res.status(500).json({ error: '解压失败：' + e.message });
    }
  }
);

// multer 错误处理（捕获文件过大等错误，返回友好提示）
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: '文件过大，最大支持200MB' });
    }
    return res.status(400).json({ error: '文件上传错误：' + err.message });
  }
  next(err);
});

// 获取当前用户项目列表（插件用）
router.get('/my-projects', async (req, res) => {
  try {
    const projects = await db.all(
      'SELECT id, name FROM projects WHERE owner_id = ? ORDER BY updated_at DESC',
      [req.user.userId]
    );
    res.json({ success: true, projects });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

module.exports = router;
