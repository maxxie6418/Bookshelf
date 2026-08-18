// AI Agent Bearer Key 鉴权中间件。
// 校验 Authorization: Bearer <key>，成功把 key 哈希挂到 c.get('agentHash')。
import { createMiddleware } from 'hono/factory';
import type { Env } from '../env';
import { verifyAgentKey } from './agent-key';

export const requireAgentKey = createMiddleware<{
  Bindings: Env;
  Variables: { agentHash: string };
}>(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  const plain = m?.[1]?.trim() ?? '';
  const meta = await verifyAgentKey(c.env.KV, plain);
  if (!meta) {
    return c.json({ error: { code: 'INVALID_AGENT_KEY', message: '无效的 Agent Key' } }, 401);
  }
  c.set('agentHash', meta.hash);
  await next();
});
