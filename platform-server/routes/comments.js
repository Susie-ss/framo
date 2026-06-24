const express = require('express');
const router = express.Router();
const db = require('../db/connector');
const { authMiddleware } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rate-limit');
const multer = require('multer');
const crypto = require('crypto');

// ===== 评论功能 =====

// 获取项目评论（按页面过滤可选）
router.get('/api/projects/:id/comments', authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;
    const pagePath = req.query.page || null;

    // 检查权限
    const project = await db.get(
      'SELECT id, owner_id FROM projects WHERE id = ? AND (owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?))',
      [projectId, req.user.userId, req.user.userId]
    );
    if (!project) return res.status(404).json({ error: '项目不存在或无权访问' });

    let sql = `
      SELECT c.*, u.username,
        (SELECT avatar_data FROM user_avatars WHERE user_id = c.user_id) as avatar
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.project_id = ?
    `;
    const params = [projectId];

    if (pagePath) {
      sql += ' AND c.page_path = ?';
      params.push(pagePath);
    }
    sql += ' ORDER BY c.created_at ASC';

    const comments = await db.all(sql, params);
    res.json({ success: true, data: comments });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 添加评论
router.post('/api/projects/:id/comments', authMiddleware, rateLimit('comment'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const { page_path, content, parent_id, version_num } = req.body;

    if (!content) return res.status(400).json({ error: '评论内容不能为空' });

    // 检查权限
    const project = await db.get(
      'SELECT id, pages_json FROM projects WHERE id = ? AND (owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?))',
      [projectId, req.user.userId, req.user.userId]
    );
    if (!project) return res.status(404).json({ error: '项目不存在或无权访问' });

    // 无页面时禁止评论
    if (!project.pages_json) return res.status(400).json({ error: '项目尚未上传内容，无法评论' });

    // 如为回复，检查父评论是否存在
    if (parent_id) {
      const parent = await db.get('SELECT id, user_id FROM comments WHERE id = ?', [parent_id]);
      if (!parent) return res.status(404).json({ error: '父评论不存在' });
    }

    const id = db.generateId();
    const now = Math.floor(Date.now() / 1000);
    await db.run(
      'INSERT INTO comments (id, project_id, user_id, page_path, content, parent_id, version_num, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, req.user.userId, page_path || '', content, parent_id || null, version_num || 1, now]
    );

    const comment = await db.get(
      'SELECT c.*, u.username, (SELECT avatar_data FROM user_avatars WHERE user_id = c.user_id) as avatar FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?',
      [id]
    );

    res.json({ success: true, data: comment });
  } catch (e) {
    res.status(500).json({ error: '评论失败：' + e.message });
  }
});

// ===== 头像功能 =====

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 } // 500KB
});

// 上传头像
router.post('/api/users/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未收到图片文件' });

    const buf = req.file.buffer;
    // 简单防注入：只接受真正的图片格式
    const magic = buf.slice(0, 4).toString('hex');
    const validMagics = ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', '89504e47'];
    if (!validMagics.includes(magic)) {
      return res.status(400).json({ error: '仅支持 JPG/PNG 图片格式' });
    }

    // 如果是PNG，生成唯一随机前缀防代码注入
    let base64;
    if (magic === '89504e47') {
      const randomPrefix = crypto.randomBytes(32).toString('hex');
      base64 = randomPrefix + '_' + buf.toString('base64');
    } else {
      base64 = buf.toString('base64');
    }

    const now = Math.floor(Date.now() / 1000);
    if (process.env.DATABASE_URL) {
      await db.run(
        'INSERT INTO user_avatars (user_id, avatar_data, updated_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET avatar_data = EXCLUDED.avatar_data, updated_at = EXCLUDED.updated_at',
        [req.user.userId, base64, now]
      );
    } else {
      await db.run(
        'INSERT OR REPLACE INTO user_avatars (user_id, avatar_data, updated_at) VALUES (?, ?, ?)',
        [req.user.userId, base64, now]
      );
    }

    res.json({ success: true, avatar: base64 });
  } catch (e) {
    res.status(500).json({ error: '上传失败：' + e.message });
  }
});

// 获取头像
router.get('/api/users/avatar/:userId', async (req, res) => {
  try {
    const avatar = await db.get('SELECT avatar_data FROM user_avatars WHERE user_id = ?', [req.params.userId]);
    if (!avatar || !avatar.avatar_data) {
      return res.status(404).json({ error: '无头像' });
    }

    let data = avatar.avatar_data;
    // 检查是否是PNG（带随机前缀）
    const mime = data.startsWith('ffd8') || !data.includes('_') ? 'image/jpeg' : 'image/png';
    // 去除随机前缀
    const idx = data.indexOf('_');
    if (idx > 0 && idx < 100) data = data.substring(idx + 1);

    const buf = Buffer.from(data, 'base64');
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: '获取失败' });
  }
});

// ===== 首页统计 =====
router.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const tagCount = await db.get(
      'SELECT COUNT(*) as count FROM product_lines WHERE (owner_id = ? OR id IN (SELECT DISTINCT ppl.product_line_id FROM project_product_lines ppl JOIN projects p ON ppl.project_id = p.id WHERE ppl.user_id = ? AND (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))))',
      [req.user.userId, req.user.userId, req.user.userId, req.user.userId]
    );
    const projectCount = await db.get(
      'SELECT COUNT(*) as count FROM projects WHERE owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?)',
      [req.user.userId, req.user.userId]
    );
    
    // 本周新增项目
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // Sunday=0->7
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0,0,0,0);
    const weekStart = Math.floor(monday.getTime() / 1000);
    const thisWeekCount = await db.get(
      'SELECT COUNT(*) as count FROM projects WHERE (owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?)) AND created_at >= ?',
      [req.user.userId, req.user.userId, weekStart]
    );
    
    // 总评论数
    const totalCommentCount = await db.get(
      'SELECT COUNT(*) as count FROM comments c INNER JOIN projects p ON c.project_id = p.id WHERE p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)',
      [req.user.userId, req.user.userId]
    );
    
    // 最新评论时间
    const latestComment = await db.get(
      'SELECT MAX(c.created_at) as latest FROM comments c INNER JOIN projects p ON c.project_id = p.id WHERE p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)',
      [req.user.userId, req.user.userId]
    );

    // 最近项目
    const recentProjects = await db.all(
      'SELECT p.*, u.username as owner_name FROM projects p LEFT JOIN users u ON p.owner_id = u.id WHERE p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?) ORDER BY p.updated_at DESC LIMIT 6',
      [req.user.userId, req.user.userId]
    );
    
    // 为最近项目加载标签
    for (const p of recentProjects) {
      p.productLines = await db.all(`
        SELECT pl.* FROM product_lines pl
        INNER JOIN project_product_lines ppl ON pl.id = ppl.product_line_id
        WHERE ppl.project_id = ? AND ppl.user_id = ?
        ORDER BY pl.sort_order
      `, [p.id, req.user.userId]);
    }

    res.json({
      success: true,
      data: {
        tagCount: tagCount?.count || 0,
        projectCount: projectCount?.count || 0,
        thisWeekProjectCount: thisWeekCount?.count || 0,
        totalCommentCount: totalCommentCount?.count || 0,
        latestCommentTime: latestComment?.latest || 0,
        recentProjects: recentProjects || []
      }
    });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 评论计数（按页面分组）
router.get('/api/projects/:id/comment-counts', authMiddleware, async (req, res) => {
  try {
    const counts = await db.all('SELECT page_path, COUNT(*) as count FROM comments WHERE project_id = ? GROUP BY page_path', [req.params.id]);
    res.json({ success: true, data: counts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 通知 =====
router.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    // 查找用户参与的评论中，被他人回复的（parent_id 指向用户评论的）
    const replies = await db.all(`
      SELECT c2.*, c1.page_path, c1.content as replied_content,
        p.name as project_name, u.username as reply_user,
        (SELECT avatar_data FROM user_avatars WHERE user_id = c2.user_id) as avatar
      FROM comments c1
      INNER JOIN comments c2 ON c2.parent_id = c1.id
      INNER JOIN projects p ON c2.project_id = p.id
      LEFT JOIN users u ON c2.user_id = u.id
      WHERE c1.user_id = ? AND c2.user_id != ?
        AND (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
      ORDER BY c2.created_at DESC
      LIMIT 20
    `, [req.user.userId, req.user.userId, req.user.userId, req.user.userId]);

    res.json({ success: true, data: replies });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// ===== 版本号递增（在 upload 中调用）=====
async function incrementVersion(projectId) {
  const project = await db.get('SELECT version_num FROM projects WHERE id = ?', [projectId]);
  const newVersion = (project?.version_num || 0) + 1;
  await db.run('UPDATE projects SET version_num = ?, updated_at = ? WHERE id = ?',
    [newVersion, Math.floor(Date.now() / 1000), projectId]);
  return newVersion;
}

// 记录版本
async function recordVersion(projectId, versionNum, pagesJson) {
  const id = db.generateId();
  const now = Math.floor(Date.now() / 1000);
  await db.run('INSERT INTO project_versions (id, project_id, version_num, pages_json, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, projectId, versionNum, pagesJson, now]);
  return { id, versionNum };
}

module.exports = router;
module.exports.incrementVersion = incrementVersion;
module.exports.recordVersion = recordVersion;
