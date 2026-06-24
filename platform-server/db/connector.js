// 数据库抽象层入口
// 自动检测环境：Vercel (DATABASE_URL) → PostgreSQL，本地 → SQLite

const path = require('path');
const fs = require('fs');

// 读取 .env（本地开发用）
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
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

loadEnv();

// 自动检测：如果有 DATABASE_URL 或 POSTGRES_URL（Vercel/Neon），使用 PostgreSQL
const hasPgUrl = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
const dbType = process.env.DB_TYPE || (hasPgUrl ? 'postgres' : 'sqlite');

let dbImpl;
if (dbType === 'postgres') {
  console.log('[DB] Using PostgreSQL adapter');
  dbImpl = require('./postgres');
} else {
  // SQLite 用于本地开发，Vercel 上不需要
  console.log('[DB] Using SQLite adapter');
  dbImpl = require('./sqlite');
}

module.exports = dbImpl;
