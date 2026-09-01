// 元数据抓取：POST /api/books/metadata/fetch
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import {
  fetchDoubanMetadataByUrl,
  fetchDoubanMetadataByIsbn,
  normalizeDoubanUrl,
} from '../lib/book-metadata';
import { storeCover } from '../lib/covers';

export const metadataRoutes = new Hono<{ Bindings: Env }>();
metadataRoutes.use(requireAuth);

const fetchSchema = z.object({
  url: z.string().optional(),
  isbn: z.string().optional(),
  force: z.boolean().optional(),
});

metadataRoutes.post('/fetch', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = fetchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误' } }, 400);
  }
  const { url, isbn, force } = parsed.data;
  if (!url && !isbn) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '请提供 url 或 isbn' } }, 400);
  }

  try {
    const meta = isbn
      ? await fetchDoubanMetadataByIsbn(isbn, c.env.KV, { force })
      : await fetchDoubanMetadataByUrl(url!, c.env.KV, { force });

    // 封面下载到 R2，返回站内代理路径；失败保留原图或置空（走前端纯色兜底）
    let cover_url = meta.cover_url;
    if (cover_url) {
      const stored = await storeCover(c.env.COVERS, cover_url, { isbn: meta.isbn });
      cover_url = stored ?? cover_url;
    }

    return c.json({
      data: {
        ...meta,
        cover_url,
        douban_url: url ? (normalizeDoubanUrl(url) ?? url) : null,
        douban_rating: meta.douban_rating,
      },
    });
  } catch (e) {
    return c.json({ error: { code: 'FETCH_FAILED', message: (e as Error).message || '获取失败' } }, 400);
  }
});