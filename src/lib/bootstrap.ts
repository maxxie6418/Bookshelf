import type { Env } from '../env';
import { hashPassword } from './auth';

// 首次运行引导：若 users 为空且设置了 INITIAL_ADMIN_PASSWORD，自动 seed 初始管理员。
// 让「Deploy to Cloudflare」一键部署后无需手动 seed 即可登录（首登强制改口令）。
let seeded = false;

export async function ensureAdmin(env: Env): Promise<void> {
  if (seeded) return;
  const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>();
  if ((row?.c ?? 0) > 0) {
    seeded = true;
    return;
  }
  const pwd = env.INITIAL_ADMIN_PASSWORD;
  if (!pwd) {
    // 未设置初始口令：跳过（用户需自行 seed 或设置 secret）。
    seeded = true;
    return;
  }
  const hash = await hashPassword(pwd);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (username, display_name, password_hash, is_admin, must_change_password) VALUES ('admin', 'Admin', ?, 1, 1)",
  )
    .bind(hash)
    .run();
  seeded = true;
}
