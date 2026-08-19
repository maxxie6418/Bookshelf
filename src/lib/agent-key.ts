// AI Agent Bearer Key 管理：生成/哈希/KV 存取。
// 明文 key 仅在创建时返回一次；为支持后续复制展示（前4/后4+星号），
// 用 SESSION_SECRET 派生密钥对明文 AES-GCM 加密后存 KV（仅存密文，不存明文）。
import type { KVNamespace } from '@cloudflare/workers-types';

const MAX_ACTIVE_KEYS = 3; // 最多 3 个活跃 key

const LIST_KEY = 'agent:keys'; // 活跃 key 哈希列表（JSON 数组，顺序即创建顺序）
const KEY_PREFIX = 'agent:key:'; // 单个 key 元数据

export interface AgentKeyMeta {
  hash: string;
  label: string;
  created_at: string;
  prefix: string; // 明文前 4 位，便于辨认
  suffix?: string; // 明文后 4 位（新 key；老 key 无此字段）
  enc?: string; // base64（iv + AES-GCM 密文），仅用于按需解密回显
  last_used_at?: string | null; // 上次鉴权成功时间（节流写入）
}

// 派生 AES-GCM 密钥：以 SESSION_SECRET 等有效 secret 经 SHA-256 派生固定 32 字节密钥，
// 带域分隔前缀避免与其它用途冲突。修改 SESSION_SECRET 后旧 key 无法回显（bearer 校验不受影响）。
async function deriveEncKey(secret: string): Promise<CryptoKey> {
  const data = new TextEncoder().encode('bookshelf:agent-key-encrypt:' + secret);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// 加密明文 key → base64(iv || ciphertext)，iv 前置便于解密
export async function encryptAgentKeyPlain(secret: string, plain: string): Promise<string> {
  const key = await deriveEncKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...combined));
}

// 解密前项编码的密文 → 明文；密钥不符或密文损坏时抛错
export async function decryptAgentKeyPlain(secret: string, enc: string): Promise<string> {
  const key = await deriveEncKey(secret);
  const combined = Uint8Array.from(atob(enc), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
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
// secret 用于派生 AES 密钥加密明文存储；为空则只存哈希（老行为，无法回显）。
export async function createAgentKey(kv: KVNamespace, label: string, secret?: string): Promise<{ plain: string; meta: AgentKeyMeta }> {
  const existing = await listAgentKeys(kv);
  if (existing.length >= MAX_ACTIVE_KEYS) {
    throw new Error(`活跃 key 已达上限（${MAX_ACTIVE_KEYS} 个），请先撤销一个再创建`);
  }
  const plain = generateKey();
  const hash = await hashKey(plain);
  const prefix = plain.slice(0, 4);
  const suffix = plain.slice(-4);
  let enc: string | undefined;
  if (secret) {
    try { enc = await encryptAgentKeyPlain(secret, plain); } catch { enc = undefined; }
  }
  const meta: AgentKeyMeta = {
    hash,
    label: label.trim() || '未命名',
    created_at: new Date().toISOString(),
    prefix,
    suffix,
    ...(enc ? { enc } : {}),
  };
  await kv.put(KEY_PREFIX + hash, JSON.stringify(meta));
  const list = [...existing.map((m) => m.hash), hash];
  await kv.put(LIST_KEY, JSON.stringify(list));
  return { plain, meta };
}

// 按需解密回显 key 明文；无密文 / 密钥不符 / 密文损坏时返回 null
export async function revealAgentKey(kv: KVNamespace, secret: string, hash: string): Promise<string | null> {
  const meta = await validKey(kv, hash);
  if (!meta || !meta.enc || !secret) return null;
  try {
    return await decryptAgentKeyPlain(secret, meta.enc);
  } catch {
    return null;
  }
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