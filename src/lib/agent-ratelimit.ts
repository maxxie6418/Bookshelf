// AI Agent 写操作频率限制（KV 持久化，按 Agent Key 计）。
// - 写操作（新增/编辑/删除共享）：每 10 分钟最多 10 次
// - 删除单独加严：每 1 小时最多 10 次
// 查询（GET）不计数、不限频。超限返回 429 + Retry-After。
import type { KVNamespace } from '@cloudflare/workers-types';

export const WRITE_WINDOW_MS = 10 * 60 * 1000; // 10 分钟
export const WRITE_LIMIT = 10;

export const DELETE_WINDOW_MS = 60 * 60 * 1000; // 1 小时
export const DELETE_LIMIT = 10;

interface BucketState {
  n: number;
  windowStart: number;
}

// 单桶限频：窗口内已达上限返回 false
async function hit(
  kv: KVNamespace,
  key: string,
  windowMs: number,
  limit: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Date.now();
  const raw = await kv.get(key);
  let s: BucketState = raw ? JSON.parse(raw) : { n: 0, windowStart: now };
  if (now - s.windowStart > windowMs) {
    s = { n: 0, windowStart: now };
  }
  if (s.n >= limit) {
    const retryAfter = Math.ceil((s.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }
  s.n += 1;
  // KV TTL 略大于窗口，避免残留
  await kv.put(key, JSON.stringify(s), {
    expirationTtl: Math.ceil((windowMs + 60_000) / 1000),
  });
  return { allowed: true, retryAfter: 0 };
}

export interface RateCheckResult {
  allowed: boolean;
  retryAfter: number;
}

// 写操作限频（新增/编辑/删除共享）
export function checkWriteLimit(
  kv: KVNamespace,
  agentHash: string,
): Promise<RateCheckResult> {
  return hit(kv, `agent:rl:${agentHash}:write`, WRITE_WINDOW_MS, WRITE_LIMIT);
}

// 删除单独加严限频
export function checkDeleteLimit(
  kv: KVNamespace,
  agentHash: string,
): Promise<RateCheckResult> {
  return hit(kv, `agent:rl:${agentHash}:del`, DELETE_WINDOW_MS, DELETE_LIMIT);
}
