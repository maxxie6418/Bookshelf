import type { Env } from '../env';

const COOKIE_NAME = 'bs_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 天

// 会话签名密钥：优先用 SESSION_SECRET；为空时序列表（Web Crypto）无法用空串签名，
// 故从稳定输入（Worker 名 + APP_NAME + INITIAL_ADMIN_PASSWORD 或固定盐）派生一个回退密钥，
// 保证未设置 secret 时登录不崩、已登录会话重启后仍有效。正式部署请务必 `wrangler secret put SESSION_SECRET`。
function sessionSecret(env: Env): string {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 16) return env.SESSION_SECRET;
  const fallbackBase = `${env.APP_NAME ?? 'bookshelf'}:${env.INITIAL_ADMIN_PASSWORD ?? 'bs-fallback'}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(fallbackBase);
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `bs-dflt-${hash.toString(16).padStart(8, '0')}`;
}

// 供其他模块使用同一有效 secret（如 Agent Key 的 AES 加密派生密钥），保证与签名密钥一致。
export function getSessionSecret(env: Env): string {
  return sessionSecret(env);
}

export interface SessionPayload {
  uid: number;
  exp: number;
}

function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

function enc(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc(data));
  return toB64url(new Uint8Array(sig));
}

// 签发无状态会话：base64url(payload).HMAC —— 用 SESSION_SECRET 验签。
export async function signSession(env: Env, payload: SessionPayload): Promise<string> {
  const data = toB64url(enc(JSON.stringify(payload)));
  const sig = await hmac(sessionSecret(env), data);
  return `${data}.${sig}`;
}

export async function verifySession(env: Env, token: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = await hmac(sessionSecret(env), data);
  if (expected !== sig) return null; // 防篡改
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(data))) as SessionPayload;
    if (payload.exp < Date.now()) return null; // 过期
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string | null): string {
  if (!token) return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

export function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return m ? m[1] : null;
}