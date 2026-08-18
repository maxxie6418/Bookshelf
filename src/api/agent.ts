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

export const agentRoutes = new Hono<{ Bindings: Env; Variables: { agentHash: string } }>();
agentRoutes.use(requireAgentKey);

const bookSchema = z.object({
  title: z.string().min(1, '书名必填'),
  author: z.string().nullable().optional(),
  translator: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  publish_year: z.number().int().nullable().optional(),
  page_count: z.number().int().nullable().optional(),
  original_title: z.string().nullable().optional(),
  isbn: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().max(2000, '记录最多 2000 字').nullable().optional(),
  cover_url: z.string().nullable().optional(),
  douban_url: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  status: z.enum(['unread', 'reading', 'finished']).optional(),
  category_id: z.number().int().nullable().optional(),
  tags: z.array(z.string()).optional(),
});
const bookCreateSchema = bookSchema;
const bookUpdateSchema = bookSchema.partial();

const VALID_STATUS = ['unread', 'reading', 'finished'];
const VALID_SORTS = ['updated_desc', 'updated_asc', 'title_asc', 'title_desc', 'rating_desc'];

function err(c: { json: (v: unknown, s?: number) => Response }, code: string, message: string, status = 400): Response {
  return c.json({ error: { code, message } }, status);
}

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
  const categoryId = q.category_id ? Number(q.category_id) : undefined;

  const data = await books.listBooks(c.env.DB, {
    status,
    categoryId: Number.isNaN(categoryId ?? NaN) ? undefined : categoryId,
    tag: q.tag,
    q: q.q,
    sort,
    trash: false,
    limit: q.limit ? Number(q.limit) : undefined,
    offset: q.offset ? Number(q.offset) : undefined,
  });
  return c.json({ data });
});

// GET /api/agent/books/:id（详情）
agentRoutes.get('/books/:id', async (c) => {
  const id = Number(c.req.param('id'));
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

// PATCH /api/agent/books/:id（编辑，写限频）
agentRoutes.patch('/books/:id', async (c) => {
  const wl = await checkWriteLimit(c.env.KV, c.get('agentHash'));
  if (!wl.allowed) return rateLimited(c, wl.retryAfter);

  const id = Number(c.req.param('id'));
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

  const id = Number(c.req.param('id'));
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
