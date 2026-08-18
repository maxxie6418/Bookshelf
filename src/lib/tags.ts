import type { D1Database } from '@cloudflare/workers-types';

export interface TagRow {
  id: number;
  name: string;
  count: number;
}

export async function listTags(db: D1Database) {
  const rows = await db
    .prepare(
      `SELECT t.id, t.name, COUNT(b.id) AS count
       FROM tags t
       LEFT JOIN book_tags bt ON bt.tag_id = t.id
       LEFT JOIN books b ON b.id = bt.book_id AND b.deleted_at IS NULL
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all<TagRow>();
  return rows.results;
}

export async function getTagByName(db: D1Database, name: string) {
  return db.prepare('SELECT id, name FROM tags WHERE name = ?').bind(name).first<{ id: number; name: string }>();
}

export async function createTag(db: D1Database, name: string): Promise<number> {
  const res = await db.prepare('INSERT INTO tags (name) VALUES (?)').bind(name).run();
  return Number(res.meta.last_row_id);
}

export async function deleteTag(db: D1Database, id: number): Promise<boolean> {
  await db.prepare('DELETE FROM book_tags WHERE tag_id = ?').bind(id).run();
  const res = await db.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
  return res.meta.changes > 0;
}

export async function renameTag(db: D1Database, id: number, name: string): Promise<boolean> {
  const res = await db.prepare('UPDATE tags SET name = ? WHERE id = ?').bind(name, id).run();
  return res.meta.changes > 0;
}

export async function getTagById(db: D1Database, id: number): Promise<{ id: number; name: string } | null> {
  return db.prepare('SELECT id, name FROM tags WHERE id = ?').bind(id).first<{ id: number; name: string }>();
}
