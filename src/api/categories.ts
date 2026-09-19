import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import * as categories from '../lib/categories';
import { err } from '../lib/http';

export const categoriesRoutes = new Hono<{ Bindings: Env }>();
categoriesRoutes.use(requireAuth);

const catSchema = z.object({
  name: z.string().min(1, '分类名必填').max(100, '分类名过长'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色需为 #rrggbb').optional().default('#8a8274'),
});
const catUpdateSchema = z.object({
  name: z.string().min(1).max(100, '分类名过长').optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

categoriesRoutes.get('/', async (c) => {
  const data = await categories.listCategories(c.env.DB);
  return c.json({ data });
});

categoriesRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = catSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  try {
    const id = await categories.createCategory(c.env.DB, parsed.data.name, parsed.data.color);
    const created = await categories.getCategory(c.env.DB, id);
    return c.json({ data: created }, 201);
  } catch (e) {
    if (String((e as Error).message ?? e).includes('UNIQUE')) {
      return err(c, 'VALIDATION_ERROR', '分类名已存在');
    }
    throw e;
  }
});

categoriesRoutes.patch('/:id', async (c) => {
  const idNum = Number(c.req.param('id'));
  if (!Number.isInteger(idNum) || idNum <= 0) return err(c, 'VALIDATION_ERROR', '非法的分类 ID');
  const body = await c.req.json().catch(() => null);
  const parsed = catUpdateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  const ok = await categories.updateCategory(c.env.DB, idNum, parsed.data.name, parsed.data.color);
  if (!ok) return err(c, 'NOT_FOUND', '不存在', 404);
  const updated = await categories.getCategory(c.env.DB, idNum);
  return c.json({ data: updated });
});

categoriesRoutes.delete('/:id', async (c) => {
  const idNum = Number(c.req.param('id'));
  if (!Number.isInteger(idNum) || idNum <= 0) return err(c, 'VALIDATION_ERROR', '非法的分类 ID');
  const ok = await categories.deleteCategory(c.env.DB, idNum);
  if (!ok) return err(c, 'NOT_FOUND', '不存在', 404);
  return c.body(null, 204);
});