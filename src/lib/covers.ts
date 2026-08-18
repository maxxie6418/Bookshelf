// R2 封面下载与代理：把豆瓣封面下载到 COVERS bucket，返回站内代理路径
import type { R2Bucket } from '@cloudflare/workers-types';
import { fetchWithRetry } from './fetch-utils';

// 从封面 URL 生成稳定、可读的 R2 key（避免暴露外链 / 防止缓存穿透）
export function coverKey(url: string, isbn?: string | null): string {
  const ext = (() => {
    const m = url.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i);
    return m ? m[1].toLowerCase() : 'jpg';
  })();
  const base = isbn || url.replace(/^https?:\/\//, '').replace(/\W+/g, '-').slice(0, 96);
  return `${base}.${ext}`;
}

// 下载远程封面写入 R2，返回站内代理 URL；失败返回 null（走前端纯色兜底）
export async function storeCover(
  bucket: R2Bucket,
  url: string,
  opts: { isbn?: string | null } = {},
): Promise<string | null> {
  try {
    const res = await fetchWithRetry(url, { timeoutMs: 15000, referer: 'https://book.douban.com/' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const type = res.headers.get('Content-Type') || 'image/jpeg';
    const key = coverKey(url, opts.isbn);
    await bucket.put(key, buf, { httpMetadata: { contentType: type }, customMetadata: { src: url } });
    return `/api/covers/${key}`;
  } catch {
    return null;
  }
}

// 从 R2 读取封面内容并返回 Response（供 /api/covers/:key 路由使用）
export async function readCover(bucket: R2Bucket, key: string): Promise<Response | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;
  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=86400, immutable');
  return new Response(obj.body, { headers });
}
