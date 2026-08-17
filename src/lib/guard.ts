import { createMiddleware } from 'hono/factory';
import type { Env } from '../env';
import { verifySession, readSessionCookie, SessionPayload } from './session';

// 受保护路由守卫：校验签名会话 Cookie，失败返 401；成功把 payload 挂到 c.get('user')。
export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: { user: SessionPayload };
}>(async (c, next) => {
  const token = readSessionCookie(c.req.header('Cookie'));
  const payload = await verifySession(c.env, token);
  if (!payload) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '未登录' } }, 401);
  }
  c.set('user', payload);
  await next();
});
