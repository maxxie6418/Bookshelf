import { Hono } from 'hono';
import type { Env } from './env';
import { authRoutes } from './api/auth';
import { healthRoutes } from './api/health';

// M0 仅挂载 health / auth；后续里程碑按模块挂载 books / categories / tags / metadata / query / export / import。
const app = new Hono<{ Bindings: Env }>();
app.route('/api/health', healthRoutes);
app.route('/api/auth', authRoutes);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    // 非 API 请求交给 Workers Assets 托管 SPA（含 SPA fallback）。
    return env.ASSETS.fetch(request);
  },
};