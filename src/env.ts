/// <reference types="@cloudflare/workers-types" />

// Worker 绑定与 secret 的集中类型定义。
export interface Env {
  // 绑定（wrangler.toml）
  DB: D1Database;
  COVERS: R2Bucket;
  KV: KVNamespace;
  ASSETS: Fetcher;
  APP_NAME?: string;

  // Secrets（wrangler secret put，不入库）
  SESSION_SECRET: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  INITIAL_ADMIN_PASSWORD?: string;
}
