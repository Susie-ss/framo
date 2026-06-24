const express = require('express');
const router = express.Router();
const db = require('../db/connector');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const logger = require('../db/logger');

router.use(authMiddleware);

// 获取所有标签（按 sort_order，含各标签项目数，按用户隔离）
router.get('/', async (req, res) => {
  try {
    const lines = await db.all(`
      SELECT pl.*, 
             (SELECT COUNT(DISTINCT ppl.project_id) 
              FROM project_product_lines ppl
              JOIN projects p ON ppl.project_id = p.id
              WHERE ppl.product_line_id = pl.id
                AND (ppl.user_id = ? OR ppl.user_id IS NULL)
                AND (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
             ) as project_count
      FROM product_lines pl
      WHERE pl.owner_id = ?
         OR pl.id IN (
          SELECT DISTINCT ppl.product_line_id FROM project_product_lines ppl
          JOIN projects p ON ppl.project_id = p.id
          WHERE ppl.user_id = ?
            AND (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
        )
      ORDER BY pl.sort_order ASC
    `, [req.user.userId, req.user.userId, req.user.userId, req.user.userId, req.user.userId, req.user.userId, req.user.userId]);
    
    res.json({ success: true, data: { lines } });
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

// 新建产品线
router.post('/', async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: '名称不能为空' });
  
  // 检查是否已存在同名产品线（仅限本用户）
  const existing = await db.get('SELECT id FROM product_lines WHERE name = ? AND (owner_id = ? OR owner_id IS NULL)', [name, req.user.userId]);
  if (existing) {
    return res.status(409).json({ error: '已存在同名产品线' });
  }
  
  const c = color || '#5B5EF4';
  // 获取最大 sort_order
  const maxSort = await db.get('SELECT MAX(sort_order) as max FROM product_lines');
  const sortOrder = (maxSort && maxSort.max !== null ? maxSort.max + 1 : 0);
  try {
    const id = db.generateId();
    await db.run(
      'INSERT INTO product_lines (id, name, color, sort_order, owner_id) VALUES (?, ?, ?, ?, ?)',
      [id, name, c, sortOrder, req.user.userId]
    );
    res.json({ success: true, id });
    
    logger.info(`Product line created: ${name}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '创建失败：' + e.message });
  }
});

// 编辑标签
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: '名称不能为空' });
  try {
    await db.run(
      'UPDATE product_lines SET name = ?, color = ? WHERE id = ?',
      [name, color || '#5B5EF4', id]
    );
    res.json({ success: true });
    
    logger.info(`Product line updated: ${name}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '更新失败：' + e.message });
  }
});

// 批量更新排序
router.put('/sort', async (req, res) => {
  const { order } = req.body; // [{id, sort_order}, ...]
  if (!Array.isArray(order)) return res.status(400).json({ error: '参数格式错误' });
  try {
    for (const item of order) {
      await db.run(
        'UPDATE product_lines SET sort_order = ? WHERE id = ?',
        [item.sort_order, item.id]
      );
    }
    res.json({ success: true });
    
    logger.info(`Product lines sort order updated`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '排序更新失败：' + e.message });
  }
});

// 删除标签（关联项目自动移除关联，不删除项目）
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    // 移除项目关联（不删除项目本身）
    await db.run('DELETE FROM project_product_lines WHERE product_line_id = ?', [id]);
    // 删除产品线
    await db.run('DELETE FROM product_lines WHERE id = ?', [id]);
    res.json({ success: true });
    
    logger.info(`Product line deleted: ${id}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '删除失败：' + e.message });
  }
});

// 向产品线添加项目
router.post('/:id/add-project', async (req, res) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: '缺少 projectId' });
  try {
    // 检查是否已关联
    const existing = await db.get(
      'SELECT id FROM project_product_lines WHERE project_id = ? AND product_line_id = ?',
      [projectId, req.params.id]
    );
    if (existing) return res.status(409).json({ error: '项目已在此产品线中' });
    const relId = db.generateId();
    await db.run(
      'INSERT INTO project_product_lines (id, project_id, product_line_id) VALUES (?, ?, ?)',
      [relId, projectId, req.params.id]
    );
    res.json({ success: true });
    
    logger.info(`Project added to product line: ${req.params.id}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '添加失败：' + e.message });
  }
});

// 从产品线移除项目
router.delete('/:lineId/remove-project/:projectId', async (req, res) => {
  try {
    await db.run(
      'DELETE FROM project_product_lines WHERE product_line_id = ? AND project_id = ?',
      [req.params.lineId, req.params.projectId]
    );
    res.json({ success: true });
    
    logger.info(`Project removed from product line: ${req.params.lineId}`, { user_id: req.user.userId, username: req.user.username, url: req.url });
  } catch (e) {
    res.status(400).json({ error: '移除失败：' + e.message });
  }
});

module.exports = router;
