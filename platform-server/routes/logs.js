/**
 * 日志查询 API 路由
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connector');
const logger = require('../db/logger');

// 查询日志（需认证，仅管理员）
router.get('/', async (req, res) => {
  try {
    // TODO: 添加管理员权限验证
    const options = {};
    
    // 解析查询参数
    if (req.query.level !== undefined) {
      options.level = parseInt(req.query.level);
    }
    
    if (req.query.user_id) {
      options.user_id = req.query.user_id;
    }
    
    if (req.query.start_time) {
      options.startTime = req.query.start_time;
    }
    
    if (req.query.end_time) {
      options.endTime = req.query.end_time;
    }
    
    if (req.query.keyword) {
      options.keyword = req.query.keyword;
    }
    
    options.limit = parseInt(req.query.limit) || 100;
    
    const logs = await logger.queryLogs(options);
    res.json({
      success: true,
      data: logs,
      total: logs.length
    });
  } catch (err) {
    logger.error('查询日志失败', { stack: err.stack, url: req.url });
    res.status(500).json({
      success: false,
      message: '查询日志失败：' + err.message
    });
  }
});

// 获取日志统计
router.get('/stats', async (req, res) => {
  try {
    // 按级别统计
    const levelStats = await db.all(`
      SELECT level_name, COUNT(*) as count 
      FROM logs 
      GROUP BY level_name 
      ORDER BY level
    `);
    
    // 按日期统计（最近7天）
    const dateSql = process.env.DATABASE_URL
      ? `SELECT DATE(timestamp) as date, COUNT(*) as count FROM logs WHERE timestamp >= NOW() - INTERVAL '7 days' GROUP BY DATE(timestamp) ORDER BY date DESC`
      : `SELECT DATE(timestamp) as date, COUNT(*) as count FROM logs WHERE timestamp >= datetime('now', '-7 days') GROUP BY DATE(timestamp) ORDER BY date DESC`;
    const dateStats = await db.all(dateSql);
    
    // 总日志数
    const total = await db.get('SELECT COUNT(*) as count FROM logs');
    
    res.json({
      success: true,
      data: {
        total: total.count,
        by_level: levelStats,
        by_date: dateStats
      }
    });
  } catch (err) {
    logger.error('获取日志统计失败', { stack: err.stack, url: req.url });
    res.status(500).json({
      success: false,
      message: '获取日志统计失败：' + err.message
    });
  }
});

// 清理旧日志
router.delete('/clean', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const deleted = await logger.cleanOldLogs(days);
    logger.info(`清理了 ${deleted} 条旧日志`, { url: req.url });
    res.json({
      success: true,
      message: `成功清理 ${deleted} 条旧日志`,
      deleted: deleted
    });
  } catch (err) {
    logger.error('清理旧日志失败', { stack: err.stack, url: req.url });
    res.status(500).json({
      success: false,
      message: '清理旧日志失败：' + err.message
    });
  }
});

module.exports = router;
