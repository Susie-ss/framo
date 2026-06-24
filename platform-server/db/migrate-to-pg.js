// 一键迁移：SQLite → PostgreSQL
// 用法: node db/migrate-to-pg.js
// 要求: .env 或环境变量中设置 DATABASE_URL
//       运行前确保 PostgreSQL 数据库已创建（schema 会自动创建）
//       迁移前在 Neon 设置 max_connections=20 或以上，避免迁移过程连接断开

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const sqlitePath = path.join(__dirname, '..', 'database.sqlite');
const fs = require('fs');

// 检查 SQLite 数据库文件
if (!fs.existsSync(sqlitePath)) {
  console.error('❌ 未找到 SQLite 数据库文件:', sqlitePath);
  process.exit(1);
}

// 检查 PostgreSQL 连接字符串
const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!pgUrl) {
  console.error('❌ 请设置 DATABASE_URL 环境变量');
  console.error('   格式: postgresql://user:pass@host:5432/db');
  process.exit(1);
}

async function migrate() {
  console.log('🚀 开始数据迁移: SQLite → PostgreSQL\n');

  // 1. 连接 SQLite
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const sqliteBuffer = fs.readFileSync(sqlitePath);
  const sqliteDb = new SQL.Database(sqliteBuffer);
  console.log('✅ SQLite 数据库已加载');

  // 2. 连接 PostgreSQL
  const pgPool = new Pool({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
  });
  console.log('✅ PostgreSQL 已连接');

  // 3. 初始化 PostgreSQL schema（复用已有逻辑）
  console.log('\n📦 初始化 PostgreSQL 表结构...');
  const { execSync } = require('child_process');
  // 直接复制 postgres.js 中的建表逻辑
  await initPgSchema(pgPool);
  console.log('✅ PostgreSQL 表结构已创建');

  // 4. 定义需迁移的表和查询
  const tables = [
    { name: 'users', orderBy: 'created_at ASC' },
    { name: 'product_lines', orderBy: 'sort_order ASC' },
    { name: 'projects', orderBy: 'created_at ASC' },
    { name: 'project_product_lines', orderBy: 'created_at ASC' },
    { name: 'project_members', orderBy: 'invited_at ASC' },
    { name: 'refresh_tokens', orderBy: 'created_at ASC' },
    { name: 'comments', orderBy: 'created_at ASC' },
    { name: 'project_versions', orderBy: 'version_num ASC' },
    { name: 'logs', orderBy: 'created_at ASC' },
  ];

  for (const table of tables) {
    console.log(`\n📋 迁移表: ${table.name}...`);

    // 检查表是否存在
    const checkResult = sqliteDb.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table.name}'`);
    if (checkResult.length === 0 || checkResult[0].values.length === 0) {
      console.log(`   ⏭️  表 ${table.name} 在 SQLite 中不存在，跳过`);
      continue;
    }

    // 读取 SQLite 数据
    const stmt = sqliteDb.prepare(`SELECT * FROM ${table.name} ORDER BY ${table.orderBy}`);
    let count = 0;
    let batch = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      batch.push(row);
      count++;

      // 每 50 条批量插入
      if (batch.length >= 50) {
        await insertBatch(pgPool, table.name, batch);
        process.stdout.write(`   📄 已迁移 ${count} 条...\r`);
        batch = [];
      }
    }
    stmt.free();

    // 插入剩余数据
    if (batch.length > 0) {
      await insertBatch(pgPool, table.name, batch);
    }

    console.log(`   ✅ 迁移完成: ${count} 条记录`);
  }

  // 5. 清理
  await pgPool.end();
  sqliteDb.close();
  console.log('\n🎉 数据迁移完成！');
}

async function initPgSchema(pool) {
  const client = await pool.connect();
  try {
    // 用户表
    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      nickname TEXT, status INTEGER DEFAULT 1, last_login_ip TEXT,
      last_login_at BIGINT, created_at BIGINT, updated_at BIGINT
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS product_lines (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT DEFAULT '#5B5EF4',
      sort_order INTEGER DEFAULT 0, owner_id TEXT, created_at BIGINT
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT,
      share_token TEXT UNIQUE, share_permission INTEGER DEFAULT 0,
      share_password TEXT, share_expiry_days INTEGER,
      pages_json TEXT, version_num INTEGER DEFAULT 0,
      color TEXT DEFAULT '#5B5EF4', created_at BIGINT, updated_at BIGINT
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS project_product_lines (
      id TEXT PRIMARY KEY, project_id TEXT, product_line_id TEXT, user_id TEXT,
      created_at BIGINT, UNIQUE(project_id, product_line_id)
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY, project_id TEXT, user_id TEXT,
      invited_by TEXT, invited_at BIGINT, UNIQUE(project_id, user_id)
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY, user_id TEXT, token TEXT UNIQUE,
      expires_at BIGINT, created_at BIGINT
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS project_versions (
      id TEXT PRIMARY KEY, project_id TEXT, version_num INTEGER,
      pages_json TEXT, created_at BIGINT
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, project_id TEXT, user_id TEXT,
      page_path TEXT, content TEXT, parent_id TEXT,
      version_num INTEGER DEFAULT 1, created_at BIGINT
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY, timestamp TEXT, level INTEGER,
      level_name TEXT, message TEXT, user_id TEXT, username TEXT,
      ip TEXT, url TEXT, method TEXT, stack TEXT, created_at TEXT
    )`);
    // 建索引
    for (const idx of [
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id)',
      'CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token)',
      'CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)',
      'CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_versions_project ON project_versions(project_id)',
    ]) {
      try { await client.query(idx); } catch (e) { /* 忽略已存在错误 */ }
    }
  } finally {
    client.release();
  }
}

async function insertBatch(pool, table, rows) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const client = await pool.connect();
  try {
    for (const row of rows) {
      const values = columns.map(col => row[col] !== undefined ? row[col] : null);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
      await client.query(sql, values);
    }
  } finally {
    client.release();
  }
}

migrate().catch(err => {
  console.error('\n❌ 迁移失败:', err);
  process.exit(1);
});
