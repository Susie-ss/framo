const config = require('../config');
const jwt = require('jsonwebtoken');

// JWT 认证中间件
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: '缺少认证 token' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '缺少认证 token' });
  }
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'token 无效或已过期' });
  }
}

// 可选认证中间件（用于分享链接访问，有 token 就解析，没有就匿名）
async function optionalAuthMiddleware(req, res, next) {
  // 1. 检查 Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const payload = jwt.verify(token, config.JWT_SECRET);
        req.user = payload;
      } catch (e) {
        // token 无效，继续尝试其他方式
      }
    }
  }
  // 2. 检查 cookie（iframe 预览用）
  if (!req.user && req.headers.cookie) {
    const cookies = {};
    req.headers.cookie.split(';').forEach(c => {
      const parts = c.split('=');
      if (parts.length >= 2) cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    });
    if (cookies.auth_token) {
      try {
        const payload = jwt.verify(cookies.auth_token, config.JWT_SECRET);
        req.user = payload;
      } catch (e) {
        // cookie 中的 token 无效
      }
    }
  }
  // 3. 检查 query 参数中的 shareToken
  if (req.query.shareToken) {
    req.shareToken = req.query.shareToken;
  }
  next();
}

module.exports = { authMiddleware, optionalAuthMiddleware };
