const express = require('express');
const router = express.Router();
const db = require('../db/connector');
const { authMiddleware } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rate-limit');

router.use(authMiddleware);

// 获取项目协作成员列表（仅创建者可访问）
router.get('/:projectId/members', async (req, res) => {
  try {
    // 检查权限（仅owner可查看成员列表）
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [req.params.projectId]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以查看成员列表' });
    }

    const members = await db.all(`
      SELECT u.id, u.username, pm.invited_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY pm.invited_at DESC
    `, [req.params.projectId]);

    res.json({ success: true, members });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 邀请协作（输入用户名）
router.post('/:projectId/invite', rateLimit('invite', req => req.ip || req.connection.remoteAddress), async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: '用户名不能为空' });

  try {
    // 检查项目是否存在且用户是owner
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [req.params.projectId]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以邀请协作' });
    }

    // 查找要邀请的用户
    const targetUser = await db.get('SELECT id FROM users WHERE username = ? AND status = 1', [username]);
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在或已被禁用' });
    }

    // 不能邀请自己
    if (targetUser.id === req.user.userId) {
      return res.status(400).json({ error: '不能邀请自己' });
    }

    // 检查是否已邀请
    const existing = await db.get(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.projectId, targetUser.id]
    );
    if (existing) {
      return res.status(409).json({ error: '该用户已是协作成员' });
    }

    // 添加协作成员
    const memberId = db.generateId();
    await db.run(
      'INSERT INTO project_members (id, project_id, user_id, invited_by, invited_at) VALUES (?, ?, ?, ?, ?)',
      [memberId, req.params.projectId, targetUser.id, req.user.userId, Math.floor(Date.now()/1000)]
    );

    res.json({ success: true, message: '邀请成功' });
  } catch (e) {
    res.status(400).json({ error: '邀请失败：' + e.message });
  }
});

// 移除协作成员（项目创建者操作，代码层同步清理）
router.delete('/:projectId/members/:uid', async (req, res) => {
  try {
    // 检查权限（仅owner可移除成员）
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [req.params.projectId]);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    if (project.owner_id !== req.user.userId) {
      return res.status(403).json({ error: '只有项目创建者可以移除成员' });
    }

    // 不能移除owner
    if (req.params.uid === project.owner_id) {
      return res.status(400).json({ error: '不能移除项目创建者' });
    }

    // 代码层清理（数据库级联删除作为备份）
    await db.run(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.projectId, req.params.uid]
    );

    res.json({ success: true, message: '已移除协作成员' });
  } catch (e) {
    res.status(400).json({ error: '移除失败：' + e.message });
  }
});

module.exports = router;
