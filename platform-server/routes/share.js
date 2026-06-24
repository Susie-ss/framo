const express = require('express');
const router = express.Router();
const db = require('../db/connector');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');

// 检测新列是否存在（兼容 SQLite 和 PostgreSQL）
async function getShareCols() {
  try {
    var cols;
    if (process.env.DATABASE_URL) {
      // PostgreSQL
      cols = await db.all("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'projects'");
    } else {
      cols = await db.all('PRAGMA table_info(projects)');
    }
    var names = cols.map(function(c) { return c.name; });
    return {
      hasPassword: names.indexOf('share_password') >= 0,
      hasExpiry: names.indexOf('share_expiry_days') >= 0
    };
  } catch(e) { return { hasPassword: false, hasExpiry: false }; }
}

// 通过分享链接访问项目（只读）
router.get('/:token', optionalAuthMiddleware, async (req, res) => {
  try {
    const { token } = req.params;
    const { pwd } = req.query;

    // 安全地查询（兼容旧列）
    var { hasPassword, hasExpiry } = await getShareCols();
    var selectCols = 'p.id, p.name, p.owner_id, p.share_token, p.share_permission, p.pages_json, p.version_num, p.updated_at, p.created_at, u.username as owner_name';
    if (hasPassword) selectCols += ', p.share_password';
    if (hasExpiry) selectCols += ', p.share_expiry_days';

    // 查找项目
    const project = await db.get(`
      SELECT ${selectCols}
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.share_token = ?
    `, [token]);

    if (!project) {
      return res.status(404).json({ error: '分享链接无效' });
    }

    // 检查权限：分享关闭后，链接彻底失效
    if (project.share_permission === 0) {
      return res.status(404).json({ error: '分享链接已失效' });
    }

    // 密码保护：如果设置了密码
    var storedPwd = hasPassword ? project.share_password : null;
    if (storedPwd) {
      if (pwd && pwd.toLowerCase() === storedPwd.toLowerCase()) {
        // 密码正确，继续
      } else if (pwd) {
        return res.status(403).json({ error: '密码错误', needPassword: true });
      } else {
        return res.status(403).json({ error: '需要密码访问', needPassword: true });
      }
    }

    // 返回项目信息
    const result = {
      id: project.id,
      name: project.name,
      owner_name: project.owner_name,
      version_num: project.version_num,
      pages_json: project.pages_json,
      permission: 'view',
      has_password: !!storedPwd,
      share_expiry_days: hasExpiry ? (project.share_expiry_days || null) : null
    };

    if (project.pages_json) {
      try { result.pages = JSON.parse(project.pages_json); } catch(e) { result.pages = []; }
    } else {
      result.pages = [];
    }

    res.json({ success: true, project: result });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 验证分享密码（不返回项目数据）
router.post('/:token/verify-password', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const project = await db.get(
      'SELECT share_password FROM projects WHERE share_token = ?',
      [token]
    );

    if (!project) {
      return res.status(404).json({ error: '分享链接无效' });
    }

    if (project.share_password && project.share_password === password) {
      return res.json({ success: true });
    }

    return res.status(403).json({ error: '密码错误' });
  } catch (e) {
    res.status(500).json({ error: '验证失败：' + e.message });
  }
});

// 重新生成 share_token
router.post('/regenerate/:projectId', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;

    // 检查权限
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以重新生成分享链接' });
    }

    const newToken = require('uuid').v4();
    await db.run(
      'UPDATE projects SET share_token = ?, updated_at = ? WHERE id = ?',
      [newToken, Math.floor(Date.now()/1000), projectId]
    );

    res.json({ success: true, shareToken: newToken });
  } catch (e) {
    res.status(500).json({ error: '重新生成失败：' + e.message });
  }
});

module.exports = router;
