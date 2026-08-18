import type { Env } from '../env';
import { hashPassword } from './auth';

// 首次运行引导：若 users 为空，自动 seed 初始管理员（首登强制改口令）。
// 口令优先级：INITIAL_ADMIN_PASSWORD secret > 默认 admin123（仅限个人自用场景，请部署后立即登录并改密）。
let seeded = false;

export async function ensureAdmin(env: Env): Promise<void> {
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
