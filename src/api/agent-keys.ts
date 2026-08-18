// AI Agent Key 管理端点 /api/agent-keys（仅登录管理员，session 鉴权）
// 支持列表 / 新建（返回明文一次）/ 撤销，上限 3 个活跃 key
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import { listAgentKeys, createAgentKey, revokeAgentKey } from '../lib/agent-key';

export const agentKeysRoutes = new Hono<{ Bindings: Env }>();
agentKeysRoutes.use(requireAuth);

const createSchema = z.object({
  label: z.string().max(50).optional().default(''),
});

function err(c: { json: (v: unknown, s?: number) => Response }, code: string, message: string, status = 400): Response {
  return c.json({ error: { code, message } }, status);
}

// GET /api/agent-keys（列表，仅元数据）
agentKeysRoutes.get('/', async (c) => {
  const data = await listAgentKeys(c.env.KV);
  return c.json({ data });
});

// POST /api/agent-keys（新建，返回明文一次，超上限报错）
agentKeysRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  try {
    const { plain, meta } = await createAgentKey(c.env.KV, parsed.data.label ?? '');
    return c.json({ data: { ...meta, key: plain } }, 201);
  } catch (e) {
    return err(c, 'KEY_LIMIT_REACHED', String((e as Error).message ?? '达到上限'), 409);
  }
});

// DELETE /api/agent-keys/:hash（撤销 key，立即失效）
agentKeysRoutes.delete('/:hash', async (c) => {
  const hash = c.req.param('hash');
  const ok = await revokeAgentKey(c.env.KV, hash);
  if (!ok) return err(c, 'NOT_FOUND', '该 key 不存在', 404);
  return c.body(null, 204);
});
