import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import * as tags from '../lib/tags';
import { err } from '../lib/http';

export const tagsRoutes = new Hono<{ Bindings: Env }>();
tagsRoutes.use(requireAuth);

const tagSchema = z.object({ name: z.string().min(1, '标签名必填').max(50, '标签名过长') });
const tagUpdateSchema = z.object({ name: z.string().min(1, '标签名必填').max(50, '标签名过长').optional() });

tagsRoutes.get('/', async (c) => {
  const data = await tags.listTags(c.env.DB);
  return c.json({ data });
});

tagsRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = tagSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  try {
    const id = await tags.createTag(c.env.DB, parsed.data.name.trim());
    return c.json({ data: { id, name: parsed.data.name.trim() } }, 201);
  } catch (e) {
    if (String((e as Error).message ?? e).includes('UNIQUE')) {
      return err(c, 'VALIDATION_ERROR', '标签名已存在');
    }
    throw e;
  }
});

tagsRoutes.delete('/:id', async (c) => {
  const idNum = Number(c.req.param('id'));
  if (!Number.isInteger(idNum) || idNum <= 0) return err(c, 'VALIDATION_ERROR', '非法的标签 ID');
  const ok = await tags.deleteTag(c.env.DB, idNum);
  if (!ok) return err(c, 'NOT_FOUND', '不存在', 404);
  return c.body(null, 204);
});

tagsRoutes.patch('/:id', async (c) => {
  const idNum = Number(c.req.param('id'));
  if (!Number.isInteger(idNum) || idNum <= 0) return err(c, 'VALIDATION_ERROR', '非法的标签 ID');
  const body = await c.req.json().catch(() => null);
  const parsed = tagUpdateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '参数错误');
  if (!parsed.data.name) return err(c, 'VALIDATION_ERROR', '标签名必填');
  try {
    const ok = await tags.renameTag(c.env.DB, idNum, parsed.data.name.trim());
    if (!ok) return err(c, 'NOT_FOUND', '不存在', 404);
    const updated = await tags.getTagById(c.env.DB, idNum);
    if (!updated) return err(c, 'NOT_FOUND', '不存在', 404);
    return c.json({ data: updated });
  } catch (e) {
    if (String((e as Error).message ?? e).includes('UNIQUE')) {
      return err(c, 'VALIDATION_ERROR', '标签名已存在');
    }
    throw e;
  }
});