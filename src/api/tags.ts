import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import * as tags from '../lib/tags';

export const tagsRoutes = new Hono<{ Bindings: Env }>();
tagsRoutes.use(requireAuth);

const tagSchema = z.object({ name: z.string().min(1, '标签名必填') });

function err(c: { json: (v: unknown, s?: number) => Response }, code: string, message: string, status = 400): Response {
  return c.json({ error: { code, message } }, status);
}

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
  const id = Number(c.req.param('id'));
  const ok = await tags.deleteTag(c.env.DB, id);
  if (!ok) return err(c, 'NOT_FOUND', '不存在', 404);
  return c.body(null, 204);
});
