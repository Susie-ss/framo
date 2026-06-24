const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const db = require('../db/connector');
const { optionalAuthMiddleware } = require('../middleware/auth');
const storage = require('../storage');

router.use(optionalAuthMiddleware);

// 从 pages_json 树中构建 页面名→relPath 映射
function buildPageMapping(pagesJson) {
  if (!pagesJson) return {};
  const map = {};
  const flatten = (nodes) => {
    if (!nodes) return;
    nodes.forEach(n => {
      if (n.url) map[n.url] = n.relPath || n.url;
      if (n.children) flatten(n.children);
    });
  };
  if (pagesJson.tree) flatten(pagesJson.tree);
  else if (Array.isArray(pagesJson)) flatten(pagesJson);
  return map;
}

// 带权限校验的文件代理服务
// 挂载点: /api/projects/:id/files，内部路由用 /* 匹配剩余路径
router.get('/*', async (req, res) => {
  const projectId = req.params.id;
  const relativePath = req.params[0] || 'index.html';

  try {
    // 1. 检查项目是否存在
    const project = await db.get(
      'SELECT id, share_token, share_permission, owner_id FROM projects WHERE id = ?',
      [projectId]
    );
    if (!project) {
      return res.status(404).send('Project not found');
    }

    let hasAccess = false;
    let accessMethod = 'none';

    // 2. 按优先级判断访问权限
    // a) 检查是否有有效的 Bearer Token
    if (req.user) {
      // 检查是否是 owner 或协作成员
      if (project.owner_id === req.user.userId) {
        hasAccess = true;
        accessMethod = 'owner';
      } else {
        const member = await db.get(
          'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
          [projectId, req.user.userId]
        );
        if (member) {
          hasAccess = true;
          accessMethod = 'member';
        }
      }
    }

    // b) 检查 shareToken
    if (!hasAccess) {
      const shareToken = req.query.shareToken || req.query.token || req.shareToken;
      if (shareToken && shareToken === project.share_token) {
        if (project.share_permission === 1) {
          // 任何人可见
          hasAccess = true;
          accessMethod = 'share_token_anyone';
        } else {
          // 仅成员可见 - 需要登录且是成员
          if (req.user) {
            const member = await db.get(
              'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
              [projectId, req.user.userId]
            );
            if (member) {
              hasAccess = true;
              accessMethod = 'share_token_member';
            }
          }
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).send('Access denied');
    }

    // 3. 安全检查：防止路径遍历
    const resolvedRelative = path.resolve('/', relativePath);
    if (!resolvedRelative.startsWith('/')) {
      return res.status(403).send('Access denied');
    }

    // 4. 权限通过，通过 storage 层读取文件
    const result = await storage.serveFile(projectId, relativePath);

    if (!result) {
      // 文件不存在时，尝试通过 pages_json 解析 Axure 页面路径
      const ext = path.extname(relativePath).toLowerCase();
      if (ext === '.html') {
        const pageName = path.basename(relativePath);
        const projData = await db.get('SELECT pages_json FROM projects WHERE id = ?', [projectId]);
        if (projData && projData.pages_json) {
          try {
            const pages = JSON.parse(projData.pages_json);
            const pageMap = buildPageMapping(pages);
            const targetPath = pageMap[pageName];
            if (targetPath) {
              const redirectPath = '/api/projects/' + projectId + '/files/' + targetPath;
              return res.redirect(302, redirectPath);
            }
          } catch(e) { /* fall through to 404 */ }
        }
      }
      return res.status(404).send('File not found');
    }

    // 5. 设置安全响应头
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "connect-src 'none'; " +
      "font-src 'self' data:; " +
      "frame-src 'none'; " +
      "object-src 'none'; " +
      "base-uri 'self'"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // 6. 根据返回类型发送文件
    if (typeof result === 'string' && result.startsWith('http')) {
      // Vercel Blob 模式，返回 URL 重定向
      res.redirect(result);
    } else {
      // 本地模式，返回文件路径
      res.sendFile(result);
    }
  } catch (e) {
    console.error('File serve error:', e);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
