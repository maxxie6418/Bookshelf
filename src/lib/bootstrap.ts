import type { Env } from '../env';
import { hashPassword } from './auth';
import { SCHEMA_STATEMENTS } from './schema';

// 首次运行引导：先确保表结构存在（幂等自迁移），再在 users 为空时 seed 初始管理员（首登强制改口令）。
// 口令优先级：INITIAL_ADMIN_PASSWORD secret > 默认 admin123（仅限个人自用场景，请部署后立即登录并改密）。
let seeded = false;
let schemaReady = false;
let notesColumnReady = false;
let reasonColumnReady = false;
let shelvedFavoriteReady = false;
let subtitleColumnReady = false;

// 幂等建表：仅当 users 表缺失时执行内置 schema（与 migrations/0000_init.sql 一致），
// 使「Deploy to Cloudflare」等不执行迁移命令的部署方式也能自动完成建表。
async function ensureSchema(env: Env): Promise<void> {
  if (schemaReady) return;
  const row = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
  ).first();
  if (row) {
    schemaReady = true;
    return;
  }
  await env.DB.batch(SCHEMA_STATEMENTS.map((sql) => env.DB.prepare(sql)));
  schemaReady = true;
}

// 幂等增量迁移：为已有 books 表补 notes（记录）列（可重复执行，缺列才 ALTER）。
// 适配已存在数据的本地/线上库；全新库直接走 schema.ts/migrations 内置 notes 列。
async function ensureBookNotesColumn(env: Env): Promise<void> {
  if (notesColumnReady) return;
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(books)').all<{ name: string }>();
    const hasNotes = cols.results?.some((c) => c.name === 'notes');
    if (!hasNotes) {
      await env.DB.prepare('ALTER TABLE books ADD COLUMN notes TEXT').run();
    }
  } catch {
    // books 表不存在或其它错误时静默跳过，避免阻塞引导
  }
  notesColumnReady = true;
}

// 幂等增量迁移：为已有 books 表补 reason（录入理由）列（可重复执行，缺列才 ALTER）。
// 适配已存在数据的本地/线上库；全新库直接走 schema.ts/migrations 内置 reason 列。
async function ensureBookReasonColumn(env: Env): Promise<void> {
  if (reasonColumnReady) return;
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(books)').all<{ name: string }>();
    const hasReason = cols.results?.some((c) => c.name === 'reason');
    if (!hasReason) {
      await env.DB.prepare('ALTER TABLE books ADD COLUMN reason TEXT').run();
    }
  } catch {
    // books 表不存在或其它错误时静默跳过，避免阻塞引导
  }
  reasonColumnReady = true;
}

// 幂等增量迁移：为已有 books 表补 subtitle（副标题）列（可重复执行，缺列才 ALTER）。
// 适配已存在数据的本地/线上库；全新库直接走 schema.ts/migrations 内置 subtitle 列。
async function ensureBookSubtitleColumn(env: Env): Promise<void> {
  if (subtitleColumnReady) return;
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(books)').all<{ name: string }>();
    const hasSubtitle = cols.results?.some((c) => c.name === 'subtitle');
    if (!hasSubtitle) {
      await env.DB.prepare('ALTER TABLE books ADD COLUMN subtitle TEXT').run();
    }
  } catch {
    // books 表不存在或其它错误时静默跳过，避免阻塞引导
  }
  subtitleColumnReady = true;
}

// 幂等增量迁移：重建 books 表以支持「搁置」(shelved) 状态与 favorite 收藏列。
// SQLite 无法直接修改 CHECK 约束，需重建表；D1 在 batch 逐语句执行时 PRAGMA foreign_keys=OFF
// 无法关闭 ON DELETE CASCADE（本地实测会级联清空 book_tags），故采用「重命名舞步」方案：
//   1) 创建 books_new + book_tags_new 辅助表并填充数据（favorite 走默认 0）
//   2) 旧表 RENAME 为 *_old，新表 RENAME 为正式名
//   3) 最后 DROP 旧表（此时 books_old 已无引用关联，book_tags 已指向新的 books）
// 检测条件：books 表已含 favorite 列且建表 SQL 含 shelved 时跳过；可重复执行。
// 全新库直接走 SCHEMA_STATEMENTS 内置定义；异常场景下用户仍可手动执行 migrations/0003。
async function ensureBookShelvedFavoriteRebuild(env: Env): Promise<void> {
  if (shelvedFavoriteReady) return;
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(books)').all<{ name: string }>();
    if (!cols.results?.length) {
      shelvedFavoriteReady = true;
      return;
    }
    const hasFavorite = cols.results.some((c) => c.name === 'favorite');
    const table = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='books'",
    ).first<{ sql: string }>();
    const hasShelved = (table?.sql ?? '').includes('shelved');
    if (hasFavorite && hasShelved) {
      shelvedFavoriteReady = true;
      return;
    }
    await env.DB.batch([
      `CREATE TABLE IF NOT EXISTS books_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  translator TEXT,
  publisher TEXT,
  publish_year INTEGER,
  page_count INTEGER,
  original_title TEXT,
  subtitle TEXT,
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
      `INSERT INTO books_new (
  id, title, author, translator, publisher, publish_year, page_count, original_title, subtitle,
  isbn, description, notes, reason, cover_url, douban_url, rating, status,
  category_id, sort_order, source, started_at, finished_at, deleted_at, created_at, updated_at
) SELECT
  id, title, author, translator, publisher, publish_year, page_count, original_title, subtitle,
  isbn, description, notes, reason, cover_url, douban_url, rating, status,
  category_id, sort_order, source, started_at, finished_at, deleted_at, created_at, updated_at
FROM books`,
      `CREATE TABLE IF NOT EXISTS book_tags_new (
  book_id INTEGER NOT NULL REFERENCES books_new(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
)`,
      'INSERT INTO book_tags_new (book_id, tag_id) SELECT book_id, tag_id FROM book_tags',
      'ALTER TABLE books RENAME TO books_old',
      'ALTER TABLE books_new RENAME TO books',
      'ALTER TABLE book_tags RENAME TO book_tags_old',
      'ALTER TABLE book_tags_new RENAME TO book_tags',
      'DROP TABLE book_tags_old',
      'DROP TABLE books_old',
      'CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)',
      'CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id)',
      'CREATE INDEX IF NOT EXISTS idx_books_updated ON books(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn)',
      'CREATE INDEX IF NOT EXISTS idx_books_deleted ON books(deleted_at)',
    ].map((sql) => env.DB.prepare(sql)));
  } catch {
    // 静默跳过，避免阻塞引导；异常场景下用户仍可手动执行 migrations/0003
  }
  shelvedFavoriteReady = true;
}

export async function ensureAdmin(env: Env): Promise<void> {
  await ensureSchema(env);
  await ensureBookNotesColumn(env);
  await ensureBookReasonColumn(env);
  await ensureBookSubtitleColumn(env);
  await ensureBookShelvedFavoriteRebuild(env);
  if (seeded) return;
  const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>();
  if ((row?.c ?? 0) > 0) {
    seeded = true;
    return;
  }
  const pwd = env.INITIAL_ADMIN_PASSWORD || 'admin123';
  const hash = await hashPassword(pwd);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (username, display_name, password_hash, is_admin, must_change_password) VALUES ('admin', 'Admin', ?, 1, 1)",
  )
    .bind(hash)
    .run();
  seeded = true;
}