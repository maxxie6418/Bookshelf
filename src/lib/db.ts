import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';

// Drizzle + D1 连接（M0 建连，后续里程碑经此做参数化查询）。
export function createDb(db: D1Database) {
  return drizzle(db, { schema });
}

export type DB = ReturnType<typeof createDb>;
