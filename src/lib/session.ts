import type { Env } from '../env';

const COOKIE_NAME = 'bs_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 天

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
  const sig = await hmac(env.SESSION_SECRET, data);
  return `${data}.${sig}`;
}

export async function verifySession(env: Env, token: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = await hmac(env.SESSION_SECRET, data);
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