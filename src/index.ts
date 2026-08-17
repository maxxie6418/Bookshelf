import { Hono } from 'hono';
import type { Env } from './env';
import { authRoutes } from './api/auth';
import { healthRoutes } from './api/health';
import { booksRoutes } from './api/books';
import { categoriesRoutes } from './api/categories';
import { tagsRoutes } from './api/tags';
import { ensureAdmin } from './lib/bootstrap';

// M0–M1：health / auth / books / categories / tags；M3+ 追加 metadata / query / export / import。
const app = new Hono<{ Bindings: Env }>();
app.route('/api/health', healthRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/books', booksRoutes);
app.route('/api/categories', categoriesRoutes);
app.route('/api/tags', tagsRoutes);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      await ensureAdmin(env); // 首次运行自动 seed 初始管理员
      return app.fetch(request, env, ctx);
    }
    // 非 API 请求交给 Workers Assets 托管 SPA（含 SPA fallback）。
    return env.ASSETS.fetch(request);
  },
};