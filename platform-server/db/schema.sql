-- Axure 预览文件管理平台 - SQLite 建表脚本
-- 需要逐条执行（sql.js 不支持一次执行多条语句）

-- ========== 用户表 ==========
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status INTEGER DEFAULT 1,
  last_login_ip TEXT,
  last_login_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

-- ========== 产品线表 ==========
CREATE TABLE IF NOT EXISTS product_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#5B5EF4',
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER
);

-- ========== 项目表 ==========
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  share_permission INTEGER DEFAULT 0,
  pages_json TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- ========== 项目-产品线多对多关系表 ==========
CREATE TABLE IF NOT EXISTS project_product_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  product_line_id INTEGER NOT NULL,
  created_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (product_line_id) REFERENCES product_lines(id) ON DELETE CASCADE,
  UNIQUE(project_id, product_line_id)
);

-- ========== 协作成员表 ==========
CREATE TABLE IF NOT EXISTS project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  invited_by INTEGER NOT NULL,
  invited_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id),
  UNIQUE(project_id, user_id)
);

-- ========== 刷新令牌表 ==========
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========== 索引 ==========
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_product_lines_sort ON product_lines(sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token);
CREATE INDEX IF NOT EXISTS idx_pl_project ON project_product_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_pl_line ON project_product_lines(product_line_id);
CREATE INDEX IF NOT EXISTS idx_pm_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rt_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_rt_expires ON refresh_tokens(expires_at);

-- ========== 初始化数据：默认产品线 ==========
INSERT OR IGNORE INTO product_lines (id, name, color, sort_order) VALUES
  (1, '未分类', '#9CA3AF', 0);
