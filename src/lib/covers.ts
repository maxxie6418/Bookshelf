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

// 封面下载上限：防止超大响应占满内存（Workers 128MB 限制）与任意非图片内容落盘
const MAX_COVER_BYTES = 5 * 1024 * 1024;

// 下载远程封面写入 R2，返回站内代理 URL；失败返回 null（走前端纯色兜底）
export async function storeCover(
  bucket: R2Bucket,
  url: string,
  opts: { isbn?: string | null } = {},
): Promise<string | null> {
  try {
    const key = coverKey(url, opts.isbn);
    const existing = await bucket.head(key);
    if (existing) return `/api/covers/${key}`;
    const res = await fetchWithRetry(url, {
      timeoutMs: 15000,
      // Referer 只对豆瓣图床携带（防盗链需要）；其它图床带豆瓣 Referer 反而可能被拒
      referer: /doubanio\.com/.test(url) ? 'https://book.douban.com/' : undefined,
    });
    if (!res.ok) return null;
    const type = (res.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    // 仅允许安全位图类型：拒绝 SVG（同源可执行脚本）等非位图内容落盘
    if (type && !/^image\/(jpeg|png|webp|gif)$/.test(type)) return null;
    const len = Number(res.headers.get('Content-Length') || 0);
    if (Number.isFinite(len) && len > MAX_COVER_BYTES) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_COVER_BYTES) return null;
    await bucket.put(key, buf, { httpMetadata: { contentType: type || 'image/jpeg' }, customMetadata: { src: url } });
    return `/api/covers/${key}`;
  } catch {
    return null;
  }
}

// 手动上传封面：按书籍 ID 稳定命名（重传直接覆盖），删除联动清理按 cover_url 引用同样生效
export function uploadedCoverKey(bookId: number, contentType: string): string {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType === 'image/gif' ? 'gif' : 'jpg';
  return `upload-${bookId}.${ext}`;
}

// 允许上传/下载落盘的图片类型：拒绝 SVG（同源可执行脚本）等非位图
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function storeUploadedCover(
  bucket: R2Bucket,
  bookId: number,
  buf: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const key = uploadedCoverKey(bookId, contentType);
  await bucket.put(key, buf, { httpMetadata: { contentType }, customMetadata: { src: 'upload' } });
  return `/api/covers/${key}`;
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