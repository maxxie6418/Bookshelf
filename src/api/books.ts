import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import * as books from '../lib/books';

export const booksRoutes = new Hono<{ Bindings: Env }>();
booksRoutes.use(requireAuth);

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
  reason: z.string().max(1000, '录入理由最多 1000 字').nullable().optional(),
  cover_url: z.string().nullable().optional(),
  douban_url: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  status: z.enum(['unread', 'reading', 'finished']).optional(),
  category_id: z.number().int().nullable().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
const bookCreateSchema = bookSchema;
const bookUpdateSchema = bookSchema.partial();

const VALID_STATUS = ['unread', 'reading', 'finished'];
const VALID_SORTS = ['updated_desc', 'updated_asc', 'title_asc', 'title_desc', 'rating_desc'];

function err(c: { json: (v: unknown, s?: number) => Response }, code: string, message: string, status = 400): Response {
  return c.json({ error: { code, message } }, status);
}

// GET /api/books（列表，默认不含回收站）
booksRoutes.get('/', async (c) => {
  const q = c.req.query();
  const status = q.status ?? undefined;
  if (status && !VALID_STATUS.includes(status)) return err(c, 'VALIDATION_ERROR', 'status 取值非法');
  const sort = q.sort ?? 'updated_desc';
  if (!VALID_SORTS.includes(sort)) return err(c, 'VALIDATION_ERROR', 'sort 取值非法');
  const categoryId = q.category_id ? Number(q.category_id) : undefined;
  const limit = q.limit ? Number(q.limit) : undefined;
  const offset = q.offset ? Number(q.offset) : undefined;

  const data = await books.listBooks(c.env.DB, {
    status,
    categoryId: Number.isNaN(categoryId ?? NaN) ? undefined : categoryId,
    tag: q.tag,
    q: q.q,
    sort,
    trash: q.trash === '1',
    limit,
    offset,
  });
  return c.json({ data });
});

// POST /api/books（新增）
booksRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = bookCreateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  const book = await books.createBook(c.env.DB, parsed.data);
  return c.json({ data: book }, 201);
});

// GET /api/books/trash（回收站列表）——必须在 /:id 之前注册
booksRoutes.get('/trash', async (c) => {
  const q = c.req.query();
  const data = await books.listBooks(c.env.DB, {
    status: q.status,
    tag: q.tag,
    q: q.q,
    sort: 'updated_desc',
    trash: true,
    limit: q.limit ? Number(q.limit) : undefined,
    offset: q.offset ? Number(q.offset) : undefined,
  });
  return c.json({ data });
});

// DELETE /api/books/trash（清空回收站）——静态段优先于 /:id
booksRoutes.delete('/trash', async (c) => {
  const count = await books.clearTrash(c.env.DB);
  return c.json({ data: { deleted: count } });
});

// DELETE /api/books/trash/:id（彻底删除，二次确认由前端负责）
booksRoutes.delete('/trash/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const ok = await books.permanentDelete(c.env.DB, id);
  if (!ok) return err(c, 'NOT_FOUND', '不存在或已被删除', 404);
  return c.body(null, 204);
});

// POST /api/books/:id/restore（恢复）
booksRoutes.post('/:id/restore', async (c) => {
  const id = Number(c.req.param('id'));
  const ok = await books.restore(c.env.DB, id);
  if (!ok) return err(c, 'NOT_FOUND', '不存在', 404);
  const book = await books.getBook(c.env.DB, id);
  return c.json({ data: book });
});

// GET /api/books/:id（详情）
booksRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const book = await books.getBook(c.env.DB, id);
  if (!book) return err(c, 'NOT_FOUND', '不存在', 404);
  return c.json({ data: book });
});

// PATCH /api/books/:id（部分更新）
booksRoutes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => null);
  const parsed = bookUpdateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  const book = await books.updateBook(c.env.DB, id, parsed.data);
  if (!book) return err(c, 'NOT_FOUND', '不存在', 404);
  return c.json({ data: book });
});

// DELETE /api/books/:id（软删 → 回收站）
booksRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const ok = await books.softDelete(c.env.DB, id);
  if (!ok) return err(c, 'NOT_FOUND', '不存在或已在回收站', 404);
  return c.json({ data: { id, deleted: true } });
});
