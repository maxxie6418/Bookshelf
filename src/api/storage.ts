// 存储资源检查与清理：GET /api/storage/check、POST /api/storage/cleanup
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import { deleteOrphans, findOrphans } from '../lib/storage';

export const storageRoutes = new Hono<{ Bindings: Env }>();
storageRoutes.use(requireAuth);

// GET /api/storage/check：列出 KV 元数据缓存与 R2 封面孤儿资源
storageRoutes.get('/check', async (c) => {
  const report = await findOrphans(c.env.DB, c.env.KV, c.env.COVERS);
  return c.json({ data: report });
});

const cleanupSchema = z.object({
  kv: z.boolean().optional(),
  covers: z.boolean().optional(),
});

// POST /api/storage/cleanup：按需删除孤儿资源（幂等，重复执行无副作用）
storageRoutes.post('/cleanup', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = cleanupSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '参数错误' } }, 400);
  }
  const { kv, covers } = parsed.data;
  const result = await deleteOrphans(c.env.DB, c.env.KV, c.env.COVERS, { kv, covers });
  return c.json({ data: result });
});