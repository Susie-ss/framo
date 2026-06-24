// SQLite 实现（使用 sql.js，纯 JS，无需原生编译）
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sql = require('sql.js');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.substring(0, idx).trim();
      const val = line.substring(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const dbPath = path.join(__dirname, '..', 'database.sqlite');

// 生成随机 10 位小写字母+数字混合字符串 ID
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(10);
  let id = '';
  for (let i = 0; i < 10; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

// 异步加载数据库
let db = null;
let dbReady = false;
let dbCallbacks = [];

function onDBReady(callback) {
  if (dbReady) {
    callback(db);
  } else {
    dbCallbacks.push(callback);
  }
}

// 初始化
sql().then(SQL => {
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  dbReady = true;
  dbCallbacks.forEach(cb => cb(db));
  dbCallbacks = [];
  console.log('Database loaded');
});

// 保存数据库到文件
function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    console.log('[DB] Database saved to disk, size:', data.length);
  } catch (e) {
    console.error('[DB] saveDatabase failed:', e.message);
  }
}

// 等待数据库就绪的包装函数
function withDB(callback) {
  onDBReady(() => {
    try {
      callback(null, db);
    } catch (e) {
      callback(e, null);
    }
  });
}

// 执行 SQL（增删改）
function run(sqlStr, params = []) {
  if (!db) throw new Error('Database not initialized');
  try {
    const stmt = db.prepare(sqlStr);
    stmt.run(params);
    stmt.free();
    saveDatabase();
    // 获取 last_insert_rowid 和 changes
    // sql.js 的 db.exec() 返回 [{columns:[], values:[[]]}] 格式
    const lastIdResult = db.exec("SELECT last_insert_rowid()");
    const changesResult = db.exec("SELECT changes()");
    const lastInsertRowid = (lastIdResult[0] && lastIdResult[0].values && lastIdResult[0].values[0])
      ? lastIdResult[0].values[0][0]
      : 0;
    const changes = (changesResult[0] && changesResult[0].values && changesResult[0].values[0])
      ? changesResult[0].values[0][0]
      : 0;
    return { lastInsertRowid, changes };
  } catch (e) {
    console.error('DB run error:', e.message, sqlStr);
    throw e;
  }
}

// 执行 SQL（查询单条）
function get(sqlStr, params = []) {
  if (!db) throw new Error('Database not initialized');
  try {
    const stmt = db.prepare(sqlStr);
    stmt.bind(params);
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result[0] || null;
  } catch (e) {
    console.error('DB get error:', e.message, sqlStr);
    throw e;
  }
}

// 执行 SQL（查询多条）
function all(sqlStr, params = []) {
  if (!db) throw new Error('Database not initialized');
  try {
    const stmt = db.prepare(sqlStr);
    stmt.bind(params);
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  } catch (e) {
    console.error('DB all error:', e.message, sqlStr);
    throw e;
  }
}

// 关闭数据库（进程退出时调用）
function close() {
  saveDatabase();
  if (db && typeof db.close === 'function') {
    db.close();
  }
}

process.on('exit', close);
process.on('SIGINT', () => { close(); process.exit(); });

module.exports = { run, get, all, close, saveDatabase, onDBReady, generateId };
