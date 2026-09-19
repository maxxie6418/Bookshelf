// 首次引导自迁移 schema：与 migrations/0000_init.sql 保持一致（仅首版 schema）。
// 全部语句幂等（IF NOT EXISTS），可安全重复执行；Worker 首次请求时若检测到缺表会自动执行，
// 使「Deploy to Cloudflare」等不跑迁移命令的部署方式也能开箱即用。
// 注意：逐条语句用 env.DB.batch() 执行（miniflare 的 exec 不支持多行多语句字符串）；
// 后续增量迁移请以 migrations/ 目录为准，勿在本文追加新表定义。
// 清理说明（v1.3.0）：settings / ai_query_log 表与 books.original_title 列从未被业务代码使用，
// 已从全新建库 DDL 中移除；存量库中的同名表/列保留不动（无读写方，无兼容风险），迁移历史文件不修改。
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,

  // username 唯一约束：防并发 seed 竞态插入重复 admin 行（存量库由 bootstrap 的幂等 ensure 补建）
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)',

  `CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  translator TEXT,
  publisher TEXT,
  publish_year INTEGER,
  page_count INTEGER,
  isbn TEXT,
  description TEXT,
  notes TEXT,
  reason TEXT,
  cover_url TEXT,
  douban_url TEXT,
  rating REAL,
  status TEXT NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread','reading','finished','shelved')),
  favorite INTEGER NOT NULL DEFAULT 0
    CHECK (favorite IN (0,1)),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('douban','neodb','openlibrary','googlebooks','manual')),
  started_at TEXT,
  finished_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,

  'CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)',
  'CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id)',
  'CREATE INDEX IF NOT EXISTS idx_books_updated ON books(updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn)',
  'CREATE INDEX IF NOT EXISTS idx_books_deleted ON books(deleted_at)',

  `CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8a8274'
)`,

  `CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
)`,

  `CREATE TABLE IF NOT EXISTS book_tags (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
)`,
];