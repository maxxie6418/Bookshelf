// 侧栏统计聚合：一次 D1 batch 返回总藏书/在读/收藏/回收站/分类/标签计数
import type { D1Database } from '@cloudflare/workers-types';
import type { CategoryRow } from './categories';
import type { TagRow } from './tags';

// 分类/标签计数 SQL 抽出共享，避免 category/tag 列表接口与 stats 聚合重复定义
export const CATEGORY_COUNT_SQL = `
  SELECT c.id, c.name, c.color, COUNT(b.id) AS count
  FROM categories c
  LEFT JOIN books b ON b.category_id = c.id AND b.deleted_at IS NULL
  GROUP BY c.id
  ORDER BY c.name COLLATE NOCASE
`;

export const TAG_COUNT_SQL = `
  SELECT t.id, t.name, COUNT(b.id) AS count
  FROM tags t
  LEFT JOIN book_tags bt ON bt.tag_id = t.id
  LEFT JOIN books b ON b.id = bt.book_id AND b.deleted_at IS NULL
  GROUP BY t.id
  ORDER BY t.name COLLATE NOCASE
`;

export interface BookStats {
  total: number;
  favorites: number;
  trash: number;
  byStatus: Record<string, number>;
  categories: CategoryRow[];
  tags: TagRow[];
}

function toByStatus(rows: { status: string; n: number }[]): Record<string, number> {
  const out: Record<string, number> = { unread: 0, reading: 0, finished: 0, shelved: 0 };
  for (const r of rows) {
    if (r.status in out) out[r.status] = r.n;
  }
  return out;
}

export async function getStats(db: D1Database): Promise<BookStats> {
  const [totalRes, statusRes, favRes, trashRes, catRes, tagRes] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM books WHERE deleted_at IS NULL'),
    db.prepare('SELECT status, COUNT(*) AS n FROM books WHERE deleted_at IS NULL GROUP BY status'),
    db.prepare('SELECT COUNT(*) AS n FROM books WHERE deleted_at IS NULL AND favorite = 1'),
    db.prepare('SELECT COUNT(*) AS n FROM books WHERE deleted_at IS NOT NULL'),
    db.prepare(CATEGORY_COUNT_SQL),
    db.prepare(TAG_COUNT_SQL),
  ]);
  return {
    total: (totalRes.results[0] as { n?: number } | undefined)?.n ?? 0,
    favorites: (favRes.results[0] as { n?: number } | undefined)?.n ?? 0,
    trash: (trashRes.results[0] as { n?: number } | undefined)?.n ?? 0,
    byStatus: toByStatus(statusRes.results as { status: string; n: number }[]),
    categories: catRes.results as CategoryRow[],
    tags: tagRes.results as TagRow[],
  };
}