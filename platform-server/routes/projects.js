const express = require('express');
const router = express.Router();
const db = require('../db/connector');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const logger = require('../db/logger');

// 安全地获取 projects 表列名（兼容 SQLite 和 PostgreSQL）
var _safeProjCols = null;
async function getSafeProjectCols() {
  if (_safeProjCols) return _safeProjCols;
  var base = 'p.id, p.name, p.owner_id, p.share_token, p.share_permission, p.pages_json, p.version_num, p.color, p.created_at, p.updated_at';
  try {
    var cols;
    if (process.env.DATABASE_URL) {
      cols = await db.all("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'projects'");
    } else {
      cols = await db.all('PRAGMA table_info(projects)');
    }
    var names = cols.map(function(c) { return c.name; });
    if (names.indexOf('share_password') >= 0) base += ', p.share_password';
    if (names.indexOf('share_expiry_days') >= 0) base += ', p.share_expiry_days';
  } catch(e) {}
  _safeProjCols = base;
  return base;
}

// ===== 项目详情（支持 JWT 认证 或 分享 token 访问）=====
// 定义在 authMiddleware 之前，以便自行处理认证
router.get('/:id', async (req, res) => {
  try {
    let permission = null;
    let currentUserId = null;

    // 尝试 JWT 认证
    try {
      // 手动触发 authMiddleware 的逻辑
      const token = req.headers['authorization']?.replace('Bearer ', '');
      if (token) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
        const user = await db.get('SELECT id, username FROM users WHERE id = ?', [decoded.userId]);
        if (user) {
          currentUserId = user.id;
          req.user = { userId: user.id, username: user.username };
        }
      }
    } catch (e) {
      // JWT 无效，继续尝试分享 token
    }

    // 查询项目（检查权限）
    const project = await db.get(`
      SELECT ${await getSafeProjectCols()}, u.username as owner_name
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!project) return res.status(404).json({ error: '项目不存在' });

    // 判断权限
    if (currentUserId) {
      // JWT 认证用户
      if (project.owner_id === currentUserId) {
        permission = 'owner';
      } else {
        // 检查是否是协作成员
        const member = await db.get(
          'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
          [req.params.id, currentUserId]
        );
        if (member) {
          permission = 'member';
        }
      }
    }

    // 如果不是 owner/member，检查分享 token
    if (!permission && req.query.token) {
      if (project.share_token === req.query.token && project.share_permission) {
        permission = 'view';
      }
    }

    // 无权限
    if (!permission) {
      return res.status(403).json({ error: '无权访问该项目' });
    }

    // 关联产品线
    project.productLines = await db.all(`
      SELECT pl.* FROM product_lines pl
      INNER JOIN project_product_lines ppl ON pl.id = ppl.product_line_id
      WHERE ppl.project_id = ? AND ppl.user_id = ?
      ORDER BY pl.sort_order
    `, [project.id, req.user.userId]);

    // 解析 pages_json
    if (project.pages_json) {
      try { project.pages = JSON.parse(project.pages_json); } catch(e) { project.pages = []; }
    } else {
      project.pages = [];
    }

    project.is_owner = project.owner_id === currentUserId;
    project.permission = permission;

    res.json({ success: true, data: project });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 获取项目页面树（支持分享 token，定义在 authMiddleware 之前）
router.get('/:id/pages', async (req, res) => {
  try {
    let permission = null;
    let currentUserId = null;

    // 尝试 JWT 认证
    try {
      const token = req.headers['authorization']?.replace('Bearer ', '');
      if (token) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
        const user = await db.get('SELECT id FROM users WHERE id = ?', [decoded.userId]);
        if (user) {
          currentUserId = user.id;
          req.user = { userId: user.id };
        }
      }
    } catch (e) {}

    const project = await db.get(
      'SELECT id, owner_id, share_token, share_permission, pages_json FROM projects WHERE id = ?',
      [req.params.id]
    );
    if (!project) return res.status(404).json({ error: '项目不存在' });

    // 判断权限
    if (currentUserId) {
      if (project.owner_id === currentUserId) {
        permission = 'owner';
      } else {
        const member = await db.get(
          'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
          [req.params.id, currentUserId]
        );
        if (member) permission = 'member';
      }
    }

    // 分享 token 访问
    if (!permission && req.query.token) {
      if (project.share_token === req.query.token && project.share_permission) {
        permission = 'view';
      }
    }

    if (!permission) {
      return res.status(403).json({ error: '无权限访问' });
    }

    if (project.pages_json) {
      const pages = JSON.parse(project.pages_json);
      res.json({ success: true, data: pages });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 以下路由需要认证
router.use(authMiddleware);

// 获取项目列表（支持按产品线过滤、搜索）
router.get('/', async (req, res) => {
  const { productLineId, search } = req.query;
  let sqlStr = `
    SELECT p.*, u.username as owner_name
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    WHERE (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
  `;
  let params = [req.user.userId, req.user.userId];

  if (productLineId) {
    sqlStr = `
      SELECT ${await getSafeProjectCols()}, u.username as owner_name
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      INNER JOIN project_product_lines ppl ON p.id = ppl.project_id
      WHERE ppl.product_line_id = ? AND (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
    `;
    params = [productLineId, req.user.userId, req.user.userId];
  }

  if (search) {
    sqlStr += ` AND p.name LIKE ?`;
    params.push(`%${search}%`);
  }

  sqlStr += ` ORDER BY p.updated_at DESC`;
  
  try {
    const projects = await db.all(sqlStr, params);
    // 为每个项目加载关联的产品线和版本
    for (const p of projects) {
      p.productLines = await db.all(`
        SELECT pl.* FROM product_lines pl
        INNER JOIN project_product_lines ppl ON pl.id = ppl.product_line_id
        WHERE ppl.project_id = ?
        ORDER BY pl.sort_order
      `, [p.id]);
      // 解析 pages_json
      if (p.pages_json) {
        try { p.pages = JSON.parse(p.pages_json); } catch(e) { p.pages = []; }
      } else {
        p.pages = [];
      }
    }
    res.json({ success: true, data: projects });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 新建项目
router.post('/', async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: '项目名称不能为空' });
  
  // 检查是否已存在同名项目（同一用户）
  const existing = await db.get('SELECT id FROM projects WHERE name = ? AND owner_id = ?', [name, req.user.userId]);
  if (existing) {
    return res.status(409).json({ error: '已存在同名项目' });
  }
  
  const shareToken = uuidv4();
  const projectColor = color || '#5B5EF4';
  try {
    const projectId = db.generateId();
    await db.run(
      'INSERT INTO projects (id, name, owner_id, share_token, share_permission, color, pages_json, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, NULL, ?, ?)',
      [projectId, name, req.user.userId, shareToken, projectColor, Math.floor(Date.now()/1000), Math.floor(Date.now()/1000)]
    );
    res.json({ success: true, id: projectId, shareToken, color: projectColor });
    
    logger.info(`Project created: ${name}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '创建失败：' + e.message });
  }
});

// 获取项目详情
router.get('/:id', async (req, res) => {
  try {
    const project = await db.get(`
      SELECT ${await getSafeProjectCols()}, u.username as owner_name
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.id = ? AND (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
    `, [req.params.id, req.user.userId, req.user.userId]);
    
    if (!project) return res.status(404).json({ error: '项目不存在或无权访问' });
    
    // 关联产品线
    project.productLines = await db.all(`
      SELECT pl.* FROM product_lines pl
      INNER JOIN project_product_lines ppl ON pl.id = ppl.product_line_id
      WHERE ppl.project_id = ? AND ppl.user_id = ?
      ORDER BY pl.sort_order
    `, [project.id, req.user.userId]);
    
    // 解析 pages_json
    if (project.pages_json) {
      try { project.pages = JSON.parse(project.pages_json); } catch(e) { project.pages = []; }
    } else {
      project.pages = [];
    }
    
    // 是否所有者/成员
    project.is_owner = project.owner_id === req.user.userId;
    project.permission = project.is_owner ? 'owner' : 'member';
    
    res.json({ success: true, data: project });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 更新项目
router.put('/:id', async (req, res) => {
  const { name, productLineIds, color } = req.body;
  if (!name) return res.status(400).json({ error: '项目名称不能为空' });
  
  try {
    // 检查权限
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以编辑项目' });
    }
    
    if (color) {
      await db.run(
        'UPDATE projects SET name = ?, color = ?, updated_at = ? WHERE id = ?',
        [name, color, Math.floor(Date.now()/1000), req.params.id]
      );
    } else {
      await db.run(
        'UPDATE projects SET name = ?, updated_at = ? WHERE id = ?',
        [name, Math.floor(Date.now()/1000), req.params.id]
      );
    }
    
    // 更新产品线关联（只删除当前用户的，再插入新的）
    await db.run('DELETE FROM project_product_lines WHERE project_id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (Array.isArray(productLineIds)) {
      for (const lineId of productLineIds) {
        const relId = db.generateId();
        if (process.env.DATABASE_URL) {
          await db.run('INSERT INTO project_product_lines (id, project_id, product_line_id, user_id) VALUES (?, ?, ?, ?) ON CONFLICT (project_id, product_line_id) DO NOTHING', [relId, req.params.id, lineId, req.user.userId]);
        } else {
          await db.run('INSERT OR IGNORE INTO project_product_lines (id, project_id, product_line_id, user_id) VALUES (?, ?, ?, ?)', [relId, req.params.id, lineId, req.user.userId]);
        }
      }
    }
    
    res.json({ success: true });
    
    logger.info(`Project updated: ${name || req.params.id}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '更新失败：' + e.message });
  }
});

// 设置分享权限
router.put('/:id/share-permission', async (req, res) => {
  const sharePermission = req.body.share_permission;
  const sharePassword = req.body.share_password || null;
  const shareExpiryDays = req.body.share_expiry_days || null;
  const newValue = sharePermission ? 1 : 0;
  try {
    const project = await db.get('SELECT owner_id, share_permission FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以设置权限' });
    }
    
    // 检测新列是否存在（兼容 SQLite 和 PostgreSQL）
    var cols;
    if (process.env.DATABASE_URL) {
      cols = await db.all("SELECT column_name as name FROM information_schema.columns WHERE table_name = 'projects'");
    } else {
      cols = await db.all('PRAGMA table_info(projects)');
    }
    var colNames = cols.map(function(c) { return c.name; });
    var hasPasswordCol = colNames.indexOf('share_password') >= 0;
    var hasExpiryCol = colNames.indexOf('share_expiry_days') >= 0;
    
    // 当关闭分享（从 1 → 0）时，重新生成 share_token 以彻底失效旧链接
    let newShareToken = null;
    if (project.share_permission === 1 && newValue === 0) {
      newShareToken = uuidv4();
    }
    
    if (newShareToken) {
      var closeSQL = 'UPDATE projects SET share_permission = ?, share_token = ?, updated_at = ?';
      var closeParams = [newValue, newShareToken, Math.floor(Date.now()/1000)];
      if (hasPasswordCol) { closeSQL += ', share_password = NULL'; }
      if (hasExpiryCol) { closeSQL += ', share_expiry_days = NULL'; }
      closeSQL += ' WHERE id = ?';
      closeParams.push(req.params.id);
      await db.run(closeSQL, closeParams);
    } else {
      var updateSQL = 'UPDATE projects SET share_permission = ?, updated_at = ?';
      var updateParams = [newValue, Math.floor(Date.now()/1000)];
      if (hasPasswordCol) { updateSQL += ', share_password = ?'; updateParams.push(sharePassword); }
      if (hasExpiryCol) { updateSQL += ', share_expiry_days = ?'; updateParams.push(shareExpiryDays); }
      updateSQL += ' WHERE id = ?';
      updateParams.push(req.params.id);
      await db.run(updateSQL, updateParams);
    }
    
    const result = { success: true };
    if (newShareToken) {
      result.shareToken = newShareToken;
      result.message = '已关闭分享，旧分享链接已失效。如重新分享需使用新链接。';
    }
    res.json(result);
    
    logger.info(`Project share permission updated: ${req.params.id} → ${newValue}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '设置失败：' + e.message });
  }
});

// 删除项目（硬删除 + 清理 previewCache）
router.delete('/:id', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以删除项目' });
    }
    
    // 代码层清理：删除关联表记录（数据库级联删除作为备份）
    await db.run('DELETE FROM project_product_lines WHERE project_id = ?', [req.params.id]);
    await db.run('DELETE FROM project_members WHERE project_id = ?', [req.params.id]);
    
    // 删除项目记录
    await db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
    
    // 清理 previewCache 目录
    const cacheDir = path.join(__dirname, '..', '..', 'previewCache', 'projects', req.params.id);
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
    
    res.json({ success: true });
    
    logger.info(`Project deleted: ${req.params.id}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '删除失败：' + e.message });
  }
});

// 获取项目页面树
router.get('/:id/pages', async (req, res) => {
  try {
    const project = await db.get(
      'SELECT pages_json, share_token, share_permission FROM projects WHERE id = ? AND (owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?))',
      [req.params.id, req.user.userId, req.user.userId]
    );
    if (!project) return res.status(404).json({ error: '项目不存在或无权访问' });
    
    if (project.pages_json) {
      const pages = JSON.parse(project.pages_json);
      res.json({ success: true, data: pages });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 获取项目成员列表（仅项目创建者）
router.get('/:id/members', async (req, res) => {
  try {
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以查看成员' });
    }
    
    const members = await db.all(`
      SELECT pm.*, u.username
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY pm.invited_at DESC
    `, [req.params.id]);
    
    res.json({ success: true, data: members });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 邀请协作（添加成员）
router.post('/:id/members', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: '用户名不能为空' });
  
  try {
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以邀请协作' });
    }
    
    // 查找用户
    const user = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    
    // 不能邀请自己
    if (user.id === req.user.userId) {
      return res.status(400).json({ error: '不能邀请自己' });
    }
    
    // 检查是否已存在
    const existing = await db.get(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.id, user.id]
    );
    if (existing) return res.status(409).json({ error: '该用户已是协作成员' });
    
    // 添加成员
    const relId = db.generateId();
    await db.run(
      'INSERT INTO project_members (id, project_id, user_id, invited_by, invited_at) VALUES (?, ?, ?, ?, ?)',
      [relId, req.params.id, user.id, req.user.userId, Math.floor(Date.now()/1000)]
    );
    
    res.json({ success: true });
    logger.info(`Member invited to project: ${req.params.id}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '邀请失败：' + e.message });
  }
});

// 移除协作成员
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以移除成员' });
    }
    
    // 不能移除自己（创建者）
    if (req.params.userId === project.owner_id) {
      return res.status(400).json({ error: '不能移除项目创建者' });
    }
    
    await db.run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [
      req.params.id,
      req.params.userId
    ]);
    
    res.json({ success: true });
    logger.info(`Member removed from project: ${req.params.id}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '移除失败：' + e.message });
  }
});

// 批量设置项目标签（替换所有标签）
router.put('/:id/tags', async (req, res) => {
  const { tagIds } = req.body;
  try {
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以设置标签' });
    }
    
    // 清除当前用户对此项目的所有标签关联
    await db.run('DELETE FROM project_product_lines WHERE project_id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    
    // 插入新标签
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      for (const tagId of tagIds) {
        const relId = db.generateId();
        if (process.env.DATABASE_URL) {
          await db.run('INSERT INTO project_product_lines (id, project_id, product_line_id, user_id) VALUES (?, ?, ?, ?) ON CONFLICT (project_id, product_line_id) DO NOTHING', [relId, req.params.id, tagId, req.user.userId]);
        } else {
          await db.run('INSERT OR IGNORE INTO project_product_lines (id, project_id, product_line_id, user_id) VALUES (?, ?, ?, ?)', [relId, req.params.id, tagId, req.user.userId]);
        }
      }
    }
    
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: '设置标签失败：' + e.message });
  }
});

module.exports = router;
