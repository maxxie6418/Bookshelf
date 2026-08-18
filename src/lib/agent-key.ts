// AI Agent Bearer Key 管理：生成/哈希/KV 存取。
// 明文 key 仅在创建时返回一次，KV 只存 SHA-256 哈希，无法回显。
import type { KVNamespace } from '@cloudflare/workers-types';

const MAX_ACTIVE_KEYS = 3; // 最多 3 个活跃 key

const LIST_KEY = 'agent:keys'; // 活跃 key 哈希列表（JSON 数组，顺序即创建顺序）
const KEY_PREFIX = 'agent:key:'; // 单个 key 元数据

export interface AgentKeyMeta {
  hash: string;
  label: string;
  created_at: string;
  prefix: string; // 明文前 4 位，便于辨认
  last_used_at?: string | null; // 上次鉴权成功时间（节流写入）
}

// 对明文 key 做 SHA-256 哈希（Worker Web Crypto）
export async function hashKey(plain: string): Promise<string> {
  const data = new TextEncoder().encode(`bs-agent:${plain}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 生成随机 key（前缀 + 42 位随机 base58，便于手动区分）
export function generateKey(): string {
  const prefix = 'bsk_';
  const bytes = new Uint8Array(28);
  crypto.getRandomValues(bytes);
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let body = '';
  for (let i = 0; i < bytes.length; i++) body += charset[bytes[i] % charset.length];
  return prefix + body;
}

async function validKey(kv: KVNamespace, hash: string): Promise<AgentKeyMeta | null> {
  const raw = await kv.get(KEY_PREFIX + hash);
  if (!raw) return null;
  return JSON.parse(raw) as AgentKeyMeta;
}

// 校验 Bearer 明文 key，返回元数据或 null；成功时节流记录 last_used_at
const lastUsageWrite: Record<string, number> = {};
const LAST_USAGE_THROTTLE_MS = 60_000;

export async function verifyAgentKey(kv: KVNamespace, plain: string): Promise<AgentKeyMeta | null> {
  if (!plain) return null;
  const hash = await hashKey(plain.trim());
  const meta = await validKey(kv, hash);
  if (!meta) return null;
  const now = Date.now();
  if (!lastUsageWrite[hash] || now - lastUsageWrite[hash] >= LAST_USAGE_THROTTLE_MS) {
    lastUsageWrite[hash] = now;
    meta.last_used_at = new Date(now).toISOString();
    await kv.put(KEY_PREFIX + hash, JSON.stringify(meta)).catch(() => undefined);
  }
  return meta;
}

// 列出全部活跃 key（仅元数据，不含明文）
export async function listAgentKeys(kv: KVNamespace): Promise<AgentKeyMeta[]> {
  const raw = await kv.get(LIST_KEY);
  const hashes: string[] = raw ? JSON.parse(raw) : [];
  const metas: AgentKeyMeta[] = [];
  for (const hash of hashes) {
    const meta = await validKey(kv, hash);
    if (meta) metas.push(meta);
  }
  return metas;
}

// 新增 key：返回明文（仅此一次）。超过活跃上限抛错。
export async function createAgentKey(kv: KVNamespace, label: string): Promise<{ plain: string; meta: AgentKeyMeta }> {
  const existing = await listAgentKeys(kv);
  if (existing.length >= MAX_ACTIVE_KEYS) {
    throw new Error(`活跃 key 已达上限（${MAX_ACTIVE_KEYS} 个），请先撤销一个再创建`);
  }
  const plain = generateKey();
  const hash = await hashKey(plain);
  const meta: AgentKeyMeta = {
    hash,
    label: label.trim() || '未命名',
    created_at: new Date().toISOString(),
    prefix: plain.slice(0, 4),
  };
  await kv.put(KEY_PREFIX + hash, JSON.stringify(meta));
  const list = [...existing.map((m) => m.hash), hash];
  await kv.put(LIST_KEY, JSON.stringify(list));
  return { plain, meta };
}

// 撤销 key（按哈希删除）
export async function revokeAgentKey(kv: KVNamespace, hash: string): Promise<boolean> {
  const existing = await listAgentKeys(kv);
  const next = existing.filter((m) => m.hash !== hash);
  if (next.length === existing.length) return false;
  await kv.delete(KEY_PREFIX + hash);
  delete lastUsageWrite[hash];
  await kv.put(LIST_KEY, JSON.stringify(next.map((m) => m.hash)));
  // 清理该 key 的限频计数
  await kv.delete(`agent:rl:${hash}:write`).catch(() => undefined);
  await kv.delete(`agent:rl:${hash}:del`).catch(() => undefined);
  return true;
}