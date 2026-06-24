// 日志模块 - 提供日志记录功能
// Vercel 环境下仅输出到 console，本地环境同时写文件和数据库

const path = require('path');
const fs = require('fs');

const isVercel = !!process.env.VERCEL;

// 日志级别
const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

// 生成 ISO 时间戳
function getTimestamp() {
  return new Date().toISOString();
}

// 格式化日志消息
function formatMessage(level, message, meta = {}) {
  const timestamp = getTimestamp();
  const levelName = LEVEL_NAMES[level] || 'INFO';
  let formatted = `[${timestamp}] [${levelName}]`;
  if (meta.username) formatted += ` [${meta.username}]`;
  if (meta.url) formatted += ` ${meta.method || 'GET'} ${meta.url}`;
  formatted += `: ${message}`;
  if (meta.stack) formatted += `\n${meta.stack}`;
  return formatted;
}

// 核心日志函数
function log(level, message, meta = {}) {
  const entry = {
    timestamp: getTimestamp(),
    level: level,
    level_name: LEVEL_NAMES[level] || 'INFO',
    message: typeof message === 'string' ? message : JSON.stringify(message),
    user_id: meta.user_id || null,
    username: meta.username || null,
    ip: meta.ip || null,
    url: meta.url || null,
    method: meta.method || null,
    stack: meta.stack || null
  };

  // 同时输出到控制台
  const consoleMethod = level >= LOG_LEVEL.ERROR ? 'error' :
                        level >= LOG_LEVEL.WARN ? 'warn' : 'log';
  console[consoleMethod](formatMessage(level, entry.message, meta));

  // 仅在本地（非 Vercel）时写文件和数据库
  if (!isVercel) {
    try {
      const LOG_FILE_PATH = path.join(__dirname, '..', 'logs');
      if (!fs.existsSync(LOG_FILE_PATH)) {
        fs.mkdirSync(LOG_FILE_PATH, { recursive: true });
      }
      const date = new Date().toISOString().split('T')[0];
      const fileName = path.join(LOG_FILE_PATH, `app-${date}.log`);
      fs.appendFileSync(fileName, formatMessage(level, entry.message, meta) + '\n', 'utf8');
    } catch (e) {
      // 文件写入失败不影响正常服务
    }

    try {
      const db = require('./connector');
      if (db && typeof db.run === 'function') {
        db.run(
          `INSERT INTO logs (timestamp, level, level_name, message, user_id, username, ip, url, method, stack, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entry.timestamp, entry.level, entry.level_name, entry.message,
            entry.user_id, entry.username, entry.ip, entry.url,
            entry.method, entry.stack, entry.timestamp
          ]
        ).catch(() => {}); // async, ignore errors
      }
    } catch (e) {
      // 数据库写入失败不影响正常服务
    }
  }
}

function debug(message, meta = {}) { log(LOG_LEVEL.DEBUG, message, meta); }
function info(message, meta = {}) { log(LOG_LEVEL.INFO, message, meta); }
function warn(message, meta = {}) { log(LOG_LEVEL.WARN, message, meta); }
function error(message, meta = {}) {
  if (message instanceof Error) {
    meta.stack = message.stack;
    message = message.message;
  }
  log(LOG_LEVEL.ERROR, message, meta);
}

function getMetaFromRequest(req, additionalMeta = {}) {
  const meta = { ...additionalMeta };
  if (req) {
    meta.ip = req.ip || req.connection?.remoteAddress || null;
    meta.url = req.originalUrl || req.url || null;
    meta.method = req.method || null;
    if (req.user) {
      meta.user_id = req.user.id || null;
      meta.username = req.user.username || null;
    }
  }
  return meta;
}

function queryLogs(options = {}) {
  return Promise.resolve([]);
}

function cleanOldLogs(daysToKeep = 30) {
  return Promise.resolve(0);
}

function flushLogs() {}

module.exports = {
  LOG_LEVEL,
  debug,
  info,
  warn,
  error,
  log,
  getMetaFromRequest,
  queryLogs,
  cleanOldLogs,
  flushLogs
};
