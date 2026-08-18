// 首次引导自迁移 schema：与 migrations/0000_init.sql 保持一致（仅首版 schema）。
// 全部语句幂等（IF NOT EXISTS），可安全重复执行；Worker 首次请求时若检测到缺表会自动执行，
// 使「Deploy to Cloudflare」等不跑迁移命令的部署方式也能开箱即用。
// 注意：逐条语句用 env.DB.batch() 执行（miniflare 的 exec 不支持多行多语句字符串）；
// 后续增量迁移请以 migrations/ 目录为准，勿在本文追加新表定义。
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

  `CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  translator TEXT,
  publisher TEXT,
  publish_year INTEGER,
  page_count INTEGER,
  original_title TEXT,
  isbn TEXT,
  description TEXT,
  cover_url TEXT,
  douban_url TEXT,
  rating REAL,
  status TEXT NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread','reading','finished')),
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

  `CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,

  `CREATE TABLE IF NOT EXISTS ai_query_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_text TEXT,
  filter_json TEXT,
  row_count INTEGER,
  ip TEXT,
  ok INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
];