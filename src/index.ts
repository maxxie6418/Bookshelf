import { Hono } from 'hono';
import type { Env } from './env';
import { authRoutes } from './api/auth';
import { healthRoutes } from './api/health';
import { booksRoutes } from './api/books';
import { categoriesRoutes } from './api/categories';
import { tagsRoutes } from './api/tags';
import { metadataRoutes } from './api/metadata';
import { coversRoutes } from './api/covers';
import { agentRoutes } from './api/agent';
import { agentKeysRoutes } from './api/agent-keys';
import { exportRoutes } from './api/export';
import { importRoutes } from './api/import';
import { ensureAdmin } from './lib/bootstrap';

// M0–M1：health / auth / books / categories / tags；M3+ 追加 metadata / query / export / import。
const app = new Hono<{ Bindings: Env }>();

// 全局错误处理：把错误栈写入运行日志（需 wrangler.jsonc 的 observability 开启），便于远端排查 500。
app.onError((e, c) => {
  console.error('[error]', e?.stack || e?.message || e);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// 所有 /api/* 请求先执行首次运行引导（自动建表 + seed 初始管理员），异常会统一走上面的 onError 记录到日志。
app.use('/api/*', async (c, next) => {
  await ensureAdmin(c.env);
  await next();
});

app.route('/api/health', healthRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/books', booksRoutes);
app.route('/api/books/metadata', metadataRoutes);
app.route('/api/covers', coversRoutes);
app.route('/api/categories', categoriesRoutes);
app.route('/api/tags', tagsRoutes);
app.route('/api/agent', agentRoutes);
app.route('/api/agent-keys', agentKeysRoutes);
app.route('/api/export', exportRoutes);
app.route('/api/import', importRoutes);

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