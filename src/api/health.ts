import { Hono } from 'hono';
import type { Env } from '../env';

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get('/', (c) => c.json({ ok: true }));
