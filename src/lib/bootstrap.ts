import type { Env } from '../env';
import { hashPassword } from './auth';
import { SCHEMA_STATEMENTS } from './schema';

// 首次运行引导：先确保表结构存在（幂等自迁移），再在 users 为空时 seed 初始管理员（首登强制改口令）。
// 口令优先级：INITIAL_ADMIN_PASSWORD secret > 默认 admin123（仅限个人自用场景，请部署后立即登录并改密）。
let seeded = false;
let schemaReady = false;
let notesColumnReady = false;
let reasonColumnReady = false;

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

export async function ensureAdmin(env: Env): Promise<void> {
  await ensureSchema(env);
  await ensureBookNotesColumn(env);
  await ensureBookReasonColumn(env);
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