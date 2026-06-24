require('dotenv').config();
const config = require("../config");

const express = require('express');
const router = express.Router();
const db = require('../db/connector');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const logger = require('../db/logger');

// 统一限流中间件
const { rateLimit } = require('../middleware/rate-limit');

// 注册
router.post('/register', rateLimit('register', req => req.ip || req.connection.remoteAddress), async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: '用户名至少3位，密码至少6位' });
    }
    // 检查用户是否存在
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: '用户名已存在' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = db.generateId();
    // 生成随机昵称：大写字母+数字，8位
    const nickname = Array.from({length:8},()=>Math.random()<0.5?String.fromCharCode(65+Math.floor(Math.random()*26)):String(Math.floor(Math.random()*10))).join('');
    const now = Math.floor(Date.now()/1000);
    await db.run(
      'INSERT INTO users (id, username, password_hash, nickname, status, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      [userId, username, passwordHash, nickname, now]
    );

    logger.info(`User registered: ${username}`, { user_id: userId, username });
    res.json({ success: true, userId });
  } catch (e) {
    console.error('[register] error:', e.message, e.stack);
    return res.status(500).json({ error: '注册失败', detail: e.message });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    // 使用统一限流检查登录失败次数
    const limitCheck = rateLimit.check('login_fail', ip);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: '当前 IP 登录尝试次数过多，请稍后再试'
      });
    }
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      rateLimit.hit('login_fail', ip);
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    if (user.status !== 1) {
      return res.status(403).json({ error: '账号已被禁用，请联系管理员' });
    }
    // 登录成功，重置失败计数
    rateLimit.clear('login_fail', ip);
    // 更新最后登录信息
    const clientIP = ip.replace('::ffff:', '').replace('::1', '127.0.0.1');
    await db.run('UPDATE users SET last_login_ip = ?, last_login_at = ?, updated_at = ? WHERE id = ?', [
      clientIP,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000),
      user.id
    ]);
    // 生成 access token（15分钟）
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, nickname: user.nickname },
      config.JWT_SECRET,
      { expiresIn: config.ACCESS_TOKEN_EXPIRY }
    );
    // 生成 refresh token（7天）
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      config.JWT_SECRET,
      { expiresIn: config.REFRESH_TOKEN_EXPIRY }
    );
    // 存储 refresh token 到数据库
    const expiresAt = Math.floor(Date.now() / 1000) + config.REFRESH_TOKEN_EXPIRY;
    await db.run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt]
    );
    // 设置 cookie 供 iframe 预览认证（必须在 res.json 之前）
    res.cookie('auth_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });
    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, nickname: user.nickname }
    });

    logger.info(`User logged in: ${username}`, { user_id: user.id, username, ip: req.ip });
  } catch (e) {
    console.error('[login] error:', e.message, e.stack);
    return res.status(500).json({ error: '登录失败', detail: e.message });
  }
});

// 获取当前登录用户信息（需认证）
router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: '缺少认证 token' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: '缺少认证 token' });
  }
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const user = await db.get('SELECT id, username, nickname, status, last_login_at, created_at FROM users WHERE id = ?', [payload.userId]);
    if (!user || user.status !== 1) {
      return res.status(401).json({ success: false, message: '用户不存在或已被禁用' });
    }
    res.json({ success: true, data: { id: user.id, username: user.username, nickname: user.nickname, status: user.status } });
  } catch (e) {
    return res.status(401).json({ success: false, message: 'token 无效或已过期' });
  }
});

// 刷新 token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: '缺少 refresh token' });
  }
  try {
    const payload = jwt.verify(refreshToken, config.JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error('Invalid token type');
    // 检查 refresh token 是否在数据库中存在且未过期
    const tokenRecord = await db.get(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > ?',
      [refreshToken, Math.floor(Date.now() / 1000)]
    );
    if (!tokenRecord) {
      return res.status(401).json({ error: 'refresh token 已失效，请重新登录' });
    }
    // 获取用户信息
    const user = await db.get('SELECT id, username FROM users WHERE id = ? AND status = 1', [payload.userId]);
    if (!user) {
      return res.status(401).json({ error: '用户不存在或已被禁用' });
    }
    // 生成新的 access token
    const newAccessToken = jwt.sign(
      { userId: user.id, username: user.username, nickname: user.nickname },
      config.JWT_SECRET,
      { expiresIn: config.ACCESS_TOKEN_EXPIRY }
    );
    res.json({ success: true, accessToken: newAccessToken });
  } catch (e) {
    res.status(401).json({ error: 'refresh token 无效或已过期' });
  }
});

// 注销
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }
    res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: '注销失败' });
  }
});

// 修改个人信息（需认证）
router.put('/profile', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const { username } = req.body;
    if (!username || username.length < 3) {
      return res.status(400).json({ error: '用户名至少3位' });
    }
    // 检查用户名是否已被占用
    const existing = await db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, payload.userId]);
    if (existing) {
      return res.status(409).json({ error: '用户名已被占用' });
    }
    await db.run('UPDATE users SET username = ?, updated_at = ? WHERE id = ?', [
      username, Math.floor(Date.now() / 1000), payload.userId
    ]);
    // 生成新 token（因为 username 在 token 里）
    const newAccessToken = jwt.sign(
      { userId: payload.userId, username },
      config.JWT_SECRET,
      { expiresIn: config.ACCESS_TOKEN_EXPIRY }
    );
    res.json({ success: true, accessToken: newAccessToken });

    logger.info(`User updated profile: ${username}`, { user_id: payload.userId, username });
  } catch (e) {
    return res.status(401).json({ error: 'token 无效或已过期' });
  }
});

// 修改密码（需认证）
router.put('/password', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请填写密码' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' });
    }
    // 验证旧密码
    const user = await db.get('SELECT * FROM users WHERE id = ?', [payload.userId]);
    if (!user || !(await bcrypt.compare(oldPassword, user.password_hash))) {
      return res.status(400).json({ error: '当前密码不正确' });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
      newHash, Math.floor(Date.now() / 1000), payload.userId
    ]);
    // 清除所有 refresh token，强制重新登录
    await db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [payload.userId]);
    res.json({ success: true });
  } catch (e) {
    return res.status(401).json({ error: 'token 无效或已过期' });
  }
});

// 获取用户完整资料（需认证）
router.get('/profile', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const user = await db.get('SELECT id, username, nickname, status, created_at FROM users WHERE id = ?', [payload.userId]);
    if (!user || user.status !== 1) return res.status(401).json({ error: '用户不存在或已被禁用' });
    // 统计
    const projectCount = await db.get(
      'SELECT COUNT(*) as count FROM projects WHERE owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?)',
      [user.id, user.id]
    );
    const commentCount = await db.get(
      'SELECT COUNT(*) as count FROM comments WHERE user_id = ?',
      [user.id]
    );
    const tagCount = await db.get(
      'SELECT COUNT(*) as count FROM product_lines WHERE owner_id = ?',
      [user.id]
    );
    res.json({ success: true, data: {
      id: user.id, username: user.username, nickname: user.nickname,
      created_at: user.created_at,
      projectCount: projectCount?.count || 0,
      commentCount: commentCount?.count || 0,
      tagCount: tagCount?.count || 0
    }});
  } catch(e) {
    return res.status(401).json({ error: 'token无效或已过期' });
  }
});

// 修改昵称（需认证）
router.put('/nickname', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const { nickname } = req.body;
    if (!nickname || nickname.length < 1 || nickname.length > 20) {
      return res.status(400).json({ error: '昵称长度1-20位' });
    }
    await db.run('UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?', [
      nickname, Math.floor(Date.now()/1000), payload.userId
    ]);
    res.json({ success: true });
  } catch(e) {
    return res.status(401).json({ error: 'token无效或已过期' });
  }
});

module.exports = router;
