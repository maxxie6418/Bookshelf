import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { verifyPassword, hashPassword } from '../lib/auth';
import {
  signSession,
  verifySession,
  sessionCookie,
  readSessionCookie,
  SessionPayload,
} from '../lib/session';
import { checkBruteForce, recordFailed, reset as resetBrute } from '../lib/brute-force';

export const authRoutes = new Hono<{ Bindings: Env }>();

const loginSchema = z.object({ password: z.string().min(1, '口令必填') });

type UserRow = {
  id: number;
  username: string | null;
  display_name: string | null;
  password_hash: string;
  is_admin: number;
  must_change_password: number;
};

function publicUser(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    is_admin: !!u.is_admin,
    must_change_password: !!u.must_change_password,
  };
}

function clientIp(c: { req: { raw: Request } }): string {
  return c.req.raw.headers.get('cf-connecting-ip') || 'unknown';
}

authRoutes.post('/login', async (c) => {
  const ip = clientIp(c);
  const bf = await checkBruteForce(c.env.KV, ip);
  if (bf.locked) {
    const mins = Math.ceil((bf.until! - Date.now()) / 60000);
    return c.json(
      { error: { code: 'BRUTE_FORCE_LOCKED', message: `登录失败过多，约 ${mins} 分钟后重试` } },
      429,
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误' } },
      400,
    );
  }
  const { password } = parsed.data;

  const user = await c.env.DB.prepare(
    'SELECT id, username, display_name, password_hash, is_admin, must_change_password FROM users LIMIT 1',
  ).first<UserRow>();

  if (!user || !(await verifyPassword(user.password_hash, password))) {
    await recordFailed(c.env.KV, ip);
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '口令错误' } }, 401);
  }

  await resetBrute(c.env.KV, ip);
  const payload: SessionPayload = { uid: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 };
  const token = await signSession(c.env, payload);
  return c.json({ data: publicUser(user) }, 200, { 'Set-Cookie': sessionCookie(token) });
});

authRoutes.post('/logout', (c) => {
  return c.json({ data: { success: true } }, 200, { 'Set-Cookie': sessionCookie(null) });
});

authRoutes.get('/me', async (c) => {
  const token = readSessionCookie(c.req.header('Cookie'));
  const payload = await verifySession(c.env, token);
  if (!payload) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '未登录' } }, 401);
  }
  const user = await c.env.DB.prepare(
    'SELECT id, username, display_name, is_admin, must_change_password FROM users WHERE id=?',
  )
    .bind(payload.uid)
    .first<UserRow>();
  if (!user) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '未登录' } }, 401);
  }
  return c.json({ data: publicUser(user) });
});

// 修改口令（首登强改 + 设置面板共用；需登录）
authRoutes.post('/password', async (c) => {
  const token = readSessionCookie(c.req.header('Cookie'));
  const payload = await verifySession(c.env, token);
  if (!payload) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '未登录' } }, 401);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ new_password: z.string().min(6, '口令至少 6 位') }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误' } }, 400);
  }
  const hash = await hashPassword(parsed.data.new_password);
  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(hash, payload.uid)
    .run();
  return c.json({ data: { success: true } });
});