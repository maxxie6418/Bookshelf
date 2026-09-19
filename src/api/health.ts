import { Hono } from 'hono';
import type { Env } from '../env';

export const healthRoutes = new Hono<{ Bindings: Env }>();

// GET /api/health —— 存活探针（注册在引导中间件之前，bootstrap 故障时仍可探活）
// GET /api/health?deep=1 —— 深度探测：逐一检查 D1 / KV 可用性，异常返回 503
healthRoutes.get('/', async (c) => {
  if (c.req.query('deep') !== '1') {
    return c.json({ ok: true });
  }
  const checks: Record<string, 'ok' | 'error'> = {};
  try {
    await c.env.DB.prepare('SELECT 1').first();
    checks.db = 'ok';
  } catch {
    checks.db = 'error';
  }
  try {
    await c.env.KV.get('__health_probe__');
    checks.kv = 'ok';
  } catch {
    checks.kv = 'error';
  }
  const ok = !Object.values(checks).includes('error');
  return c.json({ ok, checks }, ok ? 200 : 503);
});
