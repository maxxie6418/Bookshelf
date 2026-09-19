import { Hono } from 'hono';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import * as books from '../lib/books';
import { getStats } from '../lib/stats';
import { bookSchema } from '../lib/book-schema';
import { err, intParam, idParam } from '../lib/http';
import { ALLOWED_IMAGE_TYPES, storeUploadedCover, uploadedCoverKey } from '../lib/covers';

export const booksRoutes = new Hono<{ Bindings: Env }>();
booksRoutes.use(requireAuth);

// 上传封面大小上限（与抓取封面一致）
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const bookCreateSchema = bookSchema;
const bookUpdateSchema = bookSchema.partial();

function parseId(c: { req: { param: (k: string) => string } }): number | null {
  return idParam(c.req.param('id'));
}

const VALID_STATUS = ['unread', 'reading', 'finished', 'shelved'];
const VALID_SORTS = ['updated_desc', 'updated_asc', 'created_desc', 'created_asc', 'title_asc', 'title_desc', 'rating_desc'];

// GET /api/books（列表，默认不含回收站）
booksRoutes.get('/', async (c) => {
  const q = c.req.query();
  const status = q.status ?? undefined;
  if (status && !VALID_STATUS.includes(status)) return err(c, 'VALIDATION_ERROR', 'status 取值非法');
  const sort = q.sort ?? 'updated_desc';
  if (!VALID_SORTS.includes(sort)) return err(c, 'VALIDATION_ERROR', 'sort 取值非法');
  const categoryId = intParam(q.category_id);
  const limit = intParam(q.limit);
  const offset = intParam(q.offset);

  const data = await books.listBooks(c.env.DB, {
    status,
    favorite: q.favorite === '1',
    categoryId,
    tag: q.tag,
    q: q.q,
    sort,
    trash: q.trash === '1',
    limit,
    offset,
  });
  return c.json({ data });
});

// GET /api/books/stats（侧栏聚合统计）——必须在 /:id 之前注册
booksRoutes.get('/stats', async (c) => {
  const stats = await getStats(c.env.DB);
  return c.json({ data: stats });
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
    limit: intParam(q.limit),
    offset: intParam(q.offset),
  });
  return c.json({ data });
});

// DELETE /api/books/trash（清空回收站）——静态段优先于 /:id
booksRoutes.delete('/trash', async (c) => {
  const count = await books.clearTrash(c.env.DB, { kv: c.env.KV, bucket: c.env.COVERS });
  return c.json({ data: { deleted: count } });
});

// DELETE /api/books/trash/:id（彻底删除，二次确认由前端负责）
booksRoutes.delete('/trash/:id', async (c) => {
  const id = parseId(c);
  if (id == null) return err(c, 'VALIDATION_ERROR', '非法的书籍 ID');
  const ok = await books.permanentDelete(c.env.DB, id, { kv: c.env.KV, bucket: c.env.COVERS });
  if (!ok) return err(c, 'NOT_FOUND', '不存在或已被删除', 404);
  return c.body(null, 204);
});

// POST /api/books/:id/restore（恢复）
booksRoutes.post('/:id/restore', async (c) => {
  const id = parseId(c);
  if (id == null) return err(c, 'VALIDATION_ERROR', '非法的书籍 ID');
  const ok = await books.restore(c.env.DB, id);
  if (!ok) return err(c, 'NOT_FOUND', '不存在', 404);
  const book = await books.getBook(c.env.DB, id);
  return c.json({ data: book });
});

// POST /api/books/:id/cover（手动上传封面：存 R2 并返回站内路径；前端把路径填入封面 URL 后随表单保存）
booksRoutes.post('/:id/cover', async (c) => {
  const id = parseId(c);
  if (id == null) return err(c, 'VALIDATION_ERROR', '非法的书籍 ID');
  const book = await books.getBook(c.env.DB, id);
  if (!book) return err(c, 'NOT_FOUND', '不存在', 404);

  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return err(c, 'VALIDATION_ERROR', '缺少文件字段 file');
  const type = (file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(type)) return err(c, 'VALIDATION_ERROR', '仅支持 JPG/PNG/WebP/GIF 图片');
  if (file.size > MAX_UPLOAD_BYTES) return err(c, 'VALIDATION_ERROR', '图片不能超过 5MB');

  const buf = await file.arrayBuffer();
  const cover_url = await storeUploadedCover(c.env.COVERS, id, buf, type);
  return c.json({ data: { cover_url, key: uploadedCoverKey(id, type) } });
});

// GET /api/books/:id（详情）
booksRoutes.get('/:id', async (c) => {
  const id = parseId(c);
  if (id == null) return err(c, 'VALIDATION_ERROR', '非法的书籍 ID');
  const book = await books.getBook(c.env.DB, id);
  if (!book) return err(c, 'NOT_FOUND', '不存在', 404);
  return c.json({ data: book });
});

// PATCH /api/books/:id（部分更新）
booksRoutes.patch('/:id', async (c) => {
  const id = parseId(c);
  if (id == null) return err(c, 'VALIDATION_ERROR', '非法的书籍 ID');
  const body = await c.req.json().catch(() => null);
  const parsed = bookUpdateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  const book = await books.updateBook(c.env.DB, id, parsed.data);
  if (!book) return err(c, 'NOT_FOUND', '不存在', 404);
  return c.json({ data: book });
});

// DELETE /api/books/:id（软删 → 回收站）
booksRoutes.delete('/:id', async (c) => {
  const id = parseId(c);
  if (id == null) return err(c, 'VALIDATION_ERROR', '非法的书籍 ID');
  const ok = await books.softDelete(c.env.DB, id);
  if (!ok) return err(c, 'NOT_FOUND', '不存在或已在回收站', 404);
  return c.json({ data: { id, deleted: true } });
});