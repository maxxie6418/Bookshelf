// 封面代理：GET /api/covers/:key 从 R2 读取封面
import { Hono } from 'hono';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import { readCover } from '../lib/covers';

export const coversRoutes = new Hono<{ Bindings: Env }>();

// 封面代理由 <img> 直接访问，不强制登录以保证列表/详情图可用；
// key 为内部生成的受控路径，不依赖鉴权 Cookie。
coversRoutes.get('/:key', async (c) => {
  const key = c.req.param('key');
  const res = await readCover(c.env.COVERS, key);
  if (!res) return c.json({ error: { code: 'NOT_FOUND', message: '封面不存在' } }, 404);
  return res;
});