import type { KVNamespace } from '@cloudflare/workers-types';

// 登录失败频率封锁（KV 持久化版，Worker 多实例间共享）。
// 思路来自 Redesk brute-force.ts，但存储从内存 Map 改为 KV。
const WINDOW_MS = 15 * 60 * 1000; // 计数窗口 15 分钟
const THRESHOLD = 5; // 窗口内失败达 5 次即封锁
const LOCK_MS = 30 * 60 * 1000; // 封锁 30 分钟

interface BfState {
  fails: number;
  firstFail: number;
  lockedUntil?: number;
}

export async function checkBruteForce(
  kv: KVNamespace,
  ip: string,
): Promise<{ locked: boolean; until?: number }> {
  const raw = await kv.get(`login:${ip}`);
  if (!raw) return { locked: false };
  const s = JSON.parse(raw) as BfState;
  if (s.lockedUntil && s.lockedUntil > Date.now()) {
    return { locked: true, until: s.lockedUntil };
  }
  return { locked: false };
}

export async function recordFailed(kv: KVNamespace, ip: string): Promise<void> {
  const now = Date.now();
  const raw = await kv.get(`login:${ip}`);
  let s: BfState = raw ? JSON.parse(raw) : { fails: 0, firstFail: now };

  // 窗口已过则重新计数
  if (!raw || now - s.firstFail > WINDOW_MS) {
    s = { fails: 0, firstFail: now };
  }
  s.fails += 1;
  if (s.fails >= THRESHOLD) {
    s.lockedUntil = now + LOCK_MS;
  }
  await kv.put(`login:${ip}`, JSON.stringify(s), {
    expirationTtl: Math.ceil((LOCK_MS + WINDOW_MS) / 1000),
  });
}

export async function reset(kv: KVNamespace, ip: string): Promise<void> {
  await kv.delete(`login:${ip}`);
}