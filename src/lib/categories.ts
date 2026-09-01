import type { D1Database } from '@cloudflare/workers-types';
import { CATEGORY_COUNT_SQL } from './stats';

export interface CategoryRow {
  id: number;
  name: string;
  color: string;
  count: number;
}

export async function listCategories(db: D1Database) {
  const rows = await db.prepare(CATEGORY_COUNT_SQL).all<CategoryRow>();
  return rows.results;
}

export async function getCategory(db: D1Database, id: number) {
  return db.prepare('SELECT id, name, color FROM categories WHERE id = ?').bind(id).first<Omit<CategoryRow, 'count'>>();
}

export async function createCategory(db: D1Database, name: string, color: string) {
  const res = await db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').bind(name, color).run();
  return Number(res.meta.last_row_id);
}

export async function updateCategory(db: D1Database, id: number, name?: string, color?: string): Promise<boolean> {
  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (name !== undefined) { sets.push('name = ?'); params.push(name); }
  if (color !== undefined) { sets.push('color = ?'); params.push(color); }
  if (!sets.length) return false;
  const res = await db.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run();
  return res.meta.changes > 0;
}

export async function deleteCategory(db: D1Database, id: number): Promise<boolean> {
  // 其下书籍 category_id 置 NULL（不级联删书）
  await db.prepare('UPDATE books SET category_id = NULL, updated_at = datetime(\'now\') WHERE category_id = ?').bind(id).run();
  const res = await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return res.meta.changes > 0;
}