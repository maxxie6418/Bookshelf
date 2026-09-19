// AI Agent 专用 REST 端点 /api/agent/*
// 鉴权：Bearer Agent Key（非 session cookie）
// 能力：查询 / 新增 / 编辑 / 软删除 / 分类 / 标签
// 约束：写限频（10次/10min）、删除加严（10次/1h）、禁止一切回收站操作
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { requireAgentKey } from '../lib/agent-auth';
import { checkWriteLimit, checkDeleteLimit } from '../lib/agent-ratelimit';
import * as books from '../lib/books';
import * as categories from '../lib/categories';
import * as tags from '../lib/tags';
import { toCsv } from '../lib/csv';
import { exportBookToRow } from './export';
import { bookSchema } from '../lib/book-schema';
import { err, intParam, idParam } from '../lib/http';
import {
  fetchDoubanMetadataByUrl,
  normalizeDoubanUrl,
} from '../lib/book-metadata';
import { fetchMetadataByIsbn } from '../lib/metadata-fallback';
import { storeCover } from '../lib/covers';

export const agentRoutes = new Hono<{ Bindings: Env; Variables: { agentHash: string } }>();
agentRoutes.use(requireAgentKey);

// 与 /api/books 共用同一份 schema（含字段长度/枚举/URL 校验），避免两份定义漂移
const bookCreateSchema = bookSchema;
const bookUpdateSchema = bookSchema.partial();

const fetchSchema = z.object({
  url: z.string().optional(),
  isbn: z.string().optional(),
  force: z.boolean().optional(),
});

const VALID_STATUS = ['unread', 'reading', 'finished', 'shelved'];
const VALID_SORTS = ['updated_desc', 'updated_asc', 'created_desc', 'created_asc', 'title_asc', 'title_desc', 'rating_desc'];

function rateLimited(c: { json: (v: unknown, s?: number) => Response }, retryAfter: number): Response {
  return c.json({
    error: { code: 'RATE_LIMITED', message: `操作过于频繁，请在 ${retryAfter} 秒后再试` },
  }, 429);
}

// GET /api/agent/books（查询，&status=&q=&tag=&category_id=&sort=&limit=&offset=）
agentRoutes.get('/books', async (c) => {
  const q = c.req.query();
  const status = q.status ?? undefined;
  if (status && !VALID_STATUS.includes(status)) return err(c, 'VALIDATION_ERROR', 'status 取值非法');
  const sort = q.sort ?? 'updated_desc';
  if (!VALID_SORTS.includes(sort)) return err(c, 'VALIDATION_ERROR', 'sort 取值非法');
  const categoryId = intParam(q.category_id);

  const data = await books.listBooks(c.env.DB, {
    status,
    favorite: q.favorite === '1',
    categoryId,
    tag: q.tag,
    q: q.q,
    sort,
    trash: false,
    limit: intParam(q.limit),
    offset: intParam(q.offset),
  });
  return c.json({ data });
});

// GET /api/agent/books/:id（详情）
agentRoutes.get('/books/:id', async (c) => {
  const id = idParam(c.req.param('id'));
  if (id == null) return err(c, 'VALIDATION_ERROR', '非法的书籍 ID');
  const book = await books.getBook(c.env.DB, id);
  if (!book) return err(c, 'NOT_FOUND', '不存在', 404);
  return c.json({ data: book });
});

// GET /api/agent/categories（分类列表，只读）
agentRoutes.get('/categories', async (c) => {
  const data = await categories.listCategories(c.env.DB);
  return c.json({ data });
});

// GET /api/agent/tags（标签列表，只读）
agentRoutes.get('/tags', async (c) => {
  const data = await tags.listTags(c.env.DB);
  return c.json({ data });
});

// POST /api/agent/books（新增，写限频）
agentRoutes.post('/books', async (c) => {
  const wl = await checkWriteLimit(c.env.KV, c.get('agentHash'));
  if (!wl.allowed) return rateLimited(c, wl.retryAfter);

  const body = await c.req.json().catch(() => null);
  const parsed = bookCreateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  const book = await books.createBook(c.env.DB, parsed.data);
  return c.json({ data: book }, 201);
});

// POST /api/agent/books/metadata/fetch（豆瓣链接 / ISBN 抓取回填，写限频；返回元数据，不直接入库）
agentRoutes.post('/books/metadata/fetch', async (c) => {
  const wl = await checkWriteLimit(c.env.KV, c.get('agentHash'));
  if (!wl.allowed) return rateLimited(c, wl.retryAfter);

  const body = await c.req.json().catch(() => null);
  const parsed = fetchSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  const { url, isbn, force } = parsed.data;
  if (!url && !isbn) return err(c, 'VALIDATION_ERROR', '请提供 url 或 isbn');

  try {
    // ISBN 模式走「豆瓣优先 + 兜底链」；豆瓣链接模式仍只走豆瓣
    const meta = isbn
      ? await fetchMetadataByIsbn(isbn, c.env.KV, { force })
      : await fetchDoubanMetadataByUrl(url!, c.env.KV, { force });

    // 封面下载到 R2，返回站内代理路径；失败保留原图或置空（前端走纯色兜底）
    let cover_url = meta.cover_url;
    if (cover_url) {
      const stored = await storeCover(c.env.COVERS, cover_url, { isbn: meta.isbn });
      cover_url = stored ?? cover_url;
    }

    return c.json({
      data: {
        ...meta,
        cover_url,
        douban_url: url ? (normalizeDoubanUrl(url) ?? url) : meta.douban_url ?? null,
        douban_rating: meta.douban_rating,
      },
    });
  } catch (e) {
    // 原始异常只进日志，不透出内部细节（可能含上游 URL/网络栈信息）
    console.error('[agent:metadata]', (e as Error)?.stack || e);
    return err(c, 'FETCH_FAILED', '抓取失败：链接无效或数据源暂时不可用');
  }
});

// PATCH /api/agent/books/:id（编辑，写限频）
agentRoutes.patch('/books/:id', async (c) => {
  const wl = await checkWriteLimit(c.env.KV, c.get('agentHash'));
  if (!wl.allowed) return rateLimited(c, wl.retryAfter);

  const id = idParam(c.req.param('id'));
  if (id == null) return err(c, 'VALIDATION_ERROR', '非法的书籍 ID');
  const body = await c.req.json().catch(() => null);
  const parsed = bookUpdateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  const book = await books.updateBook(c.env.DB, id, parsed.data);
  if (!book) return err(c, 'NOT_FOUND', '不存在', 404);
  return c.json({ data: book });
});

// DELETE /api/agent/books/:id（仅软删除 → 回收站；删除限频加严，禁止回收站任何操作）
agentRoutes.delete('/books/:id', async (c) => {
  const wl = await checkWriteLimit(c.env.KV, c.get('agentHash'));
  if (!wl.allowed) return rateLimited(c, wl.retryAfter);
  const dl = await checkDeleteLimit(c.env.KV, c.get('agentHash'));
  if (!dl.allowed) return rateLimited(c, dl.retryAfter);

  const id = idParam(c.req.param('id'));
  if (id == null) return err(c, 'VALIDATION_ERROR', '非法的书籍 ID');
  const ok = await books.softDelete(c.env.DB, id);
  if (!ok) return err(c, 'NOT_FOUND', '不存在或已在回收站', 404);
  return c.json({ data: { id, deleted: true } });
});

// GET /api/agent/export/books（导出全部未删除藏书为 CSV，供 AI 使用；导出不纳入写/删限频）
agentRoutes.get('/export/books', async (c) => {
  const all = await books.listAllBooks(c.env.DB);
  const csv = toCsv(all.map((b) => exportBookToRow(b)));
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="books-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
});