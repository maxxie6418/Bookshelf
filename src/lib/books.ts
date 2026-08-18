import type { D1Database } from '@cloudflare/workers-types';
import { normalizeTitle } from './csv';

// ===== 类型 =====

export interface BookInput {
  title: string;
  author?: string | null;
  translator?: string | null;
  publisher?: string | null;
  publish_year?: number | null;
  page_count?: number | null;
  original_title?: string | null;
  isbn?: string | null;
  description?: string | null;
  notes?: string | null;
  cover_url?: string | null;
  douban_url?: string | null;
  rating?: number | null;
  status?: 'unread' | 'reading' | 'finished';
  category_id?: number | null;
  source?: string;
  tags?: string[];
}

export interface BookRow {
  id: number;
  title: string;
  author: string | null;
  translator: string | null;
  publisher: string | null;
  publish_year: number | null;
  page_count: number | null;
  original_title: string | null;
  isbn: string | null;
  description: string | null;
  notes: string | null;
  cover_url: string | null;
  douban_url: string | null;
  rating: number | null;
  status: string;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  sort_order: number;
  source: string;
  started_at: string | null;
  finished_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookListItem extends BookRow {
  tags: string[];
}

export interface ListQuery {
  status?: string;
  categoryId?: number;
  tag?: string;
  q?: string;
  sort?: string;
  trash?: boolean;
  limit?: number;
  offset?: number;
}

// ===== 常量 =====

const BASE_SELECT = `
  SELECT b.*, c.name AS category_name, c.color AS category_color
  FROM books b
  LEFT JOIN categories c ON c.id = b.category_id
`;

const SORT_MAP: Record<string, string> = {
  updated_desc: 'b.updated_at DESC, b.id DESC',
  updated_asc: 'b.updated_at ASC, b.id ASC',
  title_asc: 'b.title COLLATE NOCASE ASC, b.id ASC',
  title_desc: 'b.title COLLATE NOCASE DESC, b.id DESC',
  rating_desc: 'b.rating DESC, b.id DESC',
};

const VALID_STATUS = ['unread', 'reading', 'finished'];

function nowUtc(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function statusTimes(status: string): { started_at: string | null; finished_at: string | null } {
  const now = nowUtc();
  if (status === 'reading') return { started_at: now, finished_at: null };
  if (status === 'finished') return { started_at: null, finished_at: now };
  return { started_at: null, finished_at: null };
}

function toBookJson(row: BookRow, tags: string[]): BookListItem {
  return { ...row, tags };
}

// ===== 列表 =====

export async function listBooks(db: D1Database, q: ListQuery) {
  const where: string[] = [];
  const params: (string | number | null)[] = [];

  if (q.trash) where.push('b.deleted_at IS NOT NULL');
  else where.push('b.deleted_at IS NULL');

  if (q.status && VALID_STATUS.includes(q.status)) {
    where.push('b.status = ?');
    params.push(q.status);
  }
  if (q.categoryId != null) {
    where.push('b.category_id = ?');
    params.push(q.categoryId);
  }
  if (q.tag) {
    where.push(
      'EXISTS (SELECT 1 FROM book_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.book_id = b.id AND t.name = ?)',
    );
    params.push(q.tag);
  }
  if (q.q) {
    const like = `%${q.q}%`;
    where.push('(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)');
    params.push(like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORT_MAP[q.sort ?? 'updated_desc'] ?? SORT_MAP.updated_desc;
  const limit = Math.min(Math.max(q.limit ?? 100, 1), 1000);
  const offset = Math.max(q.offset ?? 0, 0);

  const countRes = await db
    .prepare(`SELECT COUNT(*) AS total FROM books b ${whereSql}`)
    .bind(...params)
    .first<{ total: number }>();
  const listRes = await db
    .prepare(`${BASE_SELECT} ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset)
    .all<BookRow>();

  const tagMap = await tagsForBooks(
    db,
    listRes.results.map((r) => r.id),
  );

  return {
    items: listRes.results.map((r) => toBookJson(r, tagMap[r.id] ?? [])),
    total: countRes?.total ?? 0,
  };
}

// 导出用：分页拉取全部未删除书籍（每页 500，直至取完）
export async function listAllBooks(db: D1Database): Promise<BookListItem[]> {
  const out: BookListItem[] = [];
  let offset = 0;
  const pageSize = 500;
  for (;;) {
    const { items } = await listBooks(db, { trash: false, limit: pageSize, offset, sort: 'title_asc' });
    out.push(...items);
    if (items.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

// 导入前：按书名规范化 / ISBN / 豆瓣链接 批量获取现有书籍，用于去重
export async function mapExistingByKey(db: D1Database): Promise<{
  byTitleNormalized: Map<string, BookListItem[]>;
  byIsbn: Map<string, BookListItem>;
  byDouban: Map<string, BookListItem>;
}> {
  const all = await listAllBooks(db);
  const byTitleNormalized = new Map<string, BookListItem[]>();
  const byIsbn = new Map<string, BookListItem>();
  const byDouban = new Map<string, BookListItem>();
  for (const b of all) {
    const key = normalizeTitle(b.title);
    const arr = byTitleNormalized.get(key) ?? [];
    arr.push(b);
    byTitleNormalized.set(key, arr);
    if (b.isbn) byIsbn.set(b.isbn, b);
    if (b.douban_url) byDouban.set(b.douban_url, b);
  }
  return { byTitleNormalized, byIsbn, byDouban };
}

export async function getBook(db: D1Database, id: number) {
  const row = await db.prepare(`${BASE_SELECT} WHERE b.id = ?`).bind(id).first<BookRow>();
  if (!row) return null;
  const tags = (await tagsForBooks(db, [id]))[id] ?? [];
  return toBookJson(row, tags);
}

// ===== 创建 / 更新 =====

export async function createBook(db: D1Database, input: BookInput) {
  const status = input.status ?? 'unread';
  const times = statusTimes(status);
  const res = await db
    .prepare(
      `INSERT INTO books (
        title, author, translator, publisher, publish_year, page_count, original_title,
        isbn, description, notes, cover_url, douban_url, rating, status, category_id, sort_order,
        source, started_at, finished_at, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?, datetime('now'), datetime('now'))`,
    )
    .bind(
      input.title,
      input.author ?? null,
      input.translator ?? null,
      input.publisher ?? null,
      input.publish_year ?? null,
      input.page_count ?? null,
      input.original_title ?? null,
      input.isbn ?? null,
      input.description ?? null,
      input.notes ?? null,
      input.cover_url ?? null,
      input.douban_url ?? null,
      input.rating ?? null,
      status,
      input.category_id ?? null,
      input.source ?? 'manual',
      times.started_at,
      times.finished_at,
    )
    .run();
  const id = Number(res.meta.last_row_id);
  if (input.tags?.length) {
    const tagIds = await ensureTags(db, input.tags);
    await setBookTags(db, id, tagIds);
  }
  return getBook(db, id);
}

export async function updateBook(db: D1Database, id: number, input: Partial<BookInput>) {
  const existing = await db.prepare('SELECT status, started_at, finished_at FROM books WHERE id = ?').bind(id).first<{ status: string; started_at: string | null; finished_at: string | null }>();
  if (!existing) return null;

  // 状态切换时维护 started_at / finished_at
  let started_at = existing.started_at;
  let finished_at = existing.finished_at;
  if (input.status && input.status !== existing.status) {
    if (input.status === 'reading') {
      started_at = started_at ?? nowUtc();
      finished_at = null;
    } else if (input.status === 'finished') {
      finished_at = finished_at ?? nowUtc();
      started_at = started_at ?? nowUtc();
    } else {
      started_at = null;
      finished_at = null;
    }
  }

  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const params: (string | number | null)[] = [];
  const push = (col: string, val: unknown) => {
    sets.push(`${col} = ?`);
    params.push((val ?? null) as string | number | null);
  };

  if (input.title !== undefined) push('title', input.title);
  if (input.author !== undefined) push('author', input.author);
  if (input.translator !== undefined) push('translator', input.translator);
  if (input.publisher !== undefined) push('publisher', input.publisher);
  if (input.publish_year !== undefined) push('publish_year', input.publish_year);
  if (input.page_count !== undefined) push('page_count', input.page_count);
  if (input.original_title !== undefined) push('original_title', input.original_title);
  if (input.isbn !== undefined) push('isbn', input.isbn);
  if (input.description !== undefined) push('description', input.description);
  if (input.notes !== undefined) push('notes', input.notes);
  if (input.cover_url !== undefined) push('cover_url', input.cover_url);
  if (input.douban_url !== undefined) push('douban_url', input.douban_url);
  if (input.rating !== undefined) push('rating', input.rating);
  if (input.status !== undefined) {
    push('status', input.status);
    push('started_at', started_at);
    push('finished_at', finished_at);
  }
  if (input.category_id !== undefined) push('category_id', input.category_id);
  if (input.source !== undefined) push('source', input.source);

  await db
    .prepare(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params, id)
    .run();

  if (input.tags) {
    const tagIds = await ensureTags(db, input.tags);
    await setBookTags(db, id, tagIds);
  }
  return getBook(db, id);
}

// ===== 删除 / 回收站 =====

export async function softDelete(db: D1Database, id: number): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE books SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(id)
    .run();
  return res.meta.changes > 0;
}

export async function restore(db: D1Database, id: number): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE books SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();
  return res.meta.changes > 0;
}

export async function permanentDelete(db: D1Database, id: number): Promise<boolean> {
  await db.prepare('DELETE FROM book_tags WHERE book_id = ?').bind(id).run();
  const res = await db.prepare('DELETE FROM books WHERE id = ?').bind(id).run();
  return res.meta.changes > 0;
}

export async function clearTrash(db: D1Database): Promise<number> {
  const res = await db
    .prepare(`DELETE FROM books WHERE deleted_at IS NOT NULL`)
    .run();
  return res.meta.changes;
}

// ===== 标签辅助（books 模块内联，避免循环依赖） =====

export async function ensureTags(db: D1Database, names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const existing = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(name).first<{ id: number }>();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const res = await db.prepare('INSERT INTO tags (name) VALUES (?)').bind(name).run();
    ids.push(Number(res.meta.last_row_id));
  }
  return ids;
}

export async function setBookTags(db: D1Database, bookId: number, tagIds: number[]): Promise<void> {
  await db.prepare('DELETE FROM book_tags WHERE book_id = ?').bind(bookId).run();
  for (const tagId of tagIds) {
    await db.prepare('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)').bind(bookId, tagId).run();
  }
}

export async function tagsForBooks(db: D1Database, bookIds: number[]): Promise<Record<number, string[]>> {
  if (!bookIds.length) return {};
  const placeholders = bookIds.map(() => '?').join(',');
  const rows = await db
    .prepare(
      `SELECT bt.book_id AS book_id, t.name AS name
       FROM book_tags bt JOIN tags t ON t.id = bt.tag_id
       WHERE bt.book_id IN (${placeholders})
       ORDER BY t.name COLLATE NOCASE`,
    )
    .bind(...bookIds)
    .all<{ book_id: number; name: string }>();
  const map: Record<number, string[]> = {};
  for (const r of rows.results) {
    (map[r.book_id] ??= []).push(r.name);
  }
  return map;
}
