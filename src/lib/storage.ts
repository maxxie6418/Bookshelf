// 存储资源治理：彻底删除书籍时联动清理 KV 元数据缓存与 R2 封面；设置页手动检查/清理孤儿资源
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';

const META_PREFIX = 'meta:douban:';
const SUBJECT_PREFIX = 'meta:douban:subject:';
const ISBN_PREFIX = 'meta:douban:isbn:';
const COVER_PATH_PREFIX = '/api/covers/';

export interface ResourceTargets {
  kv?: KVNamespace;
  bucket?: R2Bucket;
}

export interface KvOrphanItem {
  key: string;
  cached_at: string;
  title: string | null;
}

export interface CoverOrphanItem {
  key: string;
  size: number;
  uploaded: string | null;
}

export interface OrphanReport {
  kv: { total: number; orphans: KvOrphanItem[] };
  covers: { total: number; orphans: CoverOrphanItem[] };
}

interface ReferenceSets {
  subjects: Set<string>;
  isbns: Set<string>;
  covers: Set<string>;
}

interface BookResourceRef {
  douban_url?: string | null;
  isbn?: string | null;
  cover_url?: string | null;
}

// ===== 引用集合（全量书籍，含回收站：资源为任何书服务就不算孤儿） =====
async function buildReferenceSets(db: D1Database): Promise<ReferenceSets> {
  const subjects = new Set<string>();
  const isbns = new Set<string>();
  const covers = new Set<string>();
  const rows = await db
    .prepare('SELECT douban_url, isbn, cover_url FROM books')
    .all<BookResourceRef>();
  for (const r of rows.results) {
    const m = r.douban_url?.match(/subject\/(\d+)/);
    if (m) subjects.add(`${SUBJECT_PREFIX}${m[1]}`);
    if (r.isbn) isbns.add(`${ISBN_PREFIX}${r.isbn}`);
    const cm = r.cover_url?.match(new RegExp(`${COVER_PATH_PREFIX}(.+)$`));
    if (cm) covers.add(decodeURIComponent(cm[1]));
  }
  return { subjects, isbns, covers };
}

// ===== 孤儿检测 =====
export async function findOrphans(
  db: D1Database,
  kv: KVNamespace | undefined,
  bucket: R2Bucket | undefined,
): Promise<OrphanReport> {
  const refs = await buildReferenceSets(db);
  const kvReport = kv ? await collectKvOrphans(kv, refs) : { total: 0, orphans: [] };
  const coverReport = bucket ? await collectCoverOrphans(bucket, refs) : { total: 0, orphans: [] };
  return { kv: kvReport, covers: coverReport };
}

async function collectKvOrphans(
  kv: KVNamespace,
  refs: ReferenceSets,
): Promise<{ total: number; orphans: KvOrphanItem[] }> {
  const orphans: KvOrphanItem[] = [];
  let total = 0;
  let cursor: string | undefined;
  do {
    const list = await kv.list({ prefix: META_PREFIX, cursor });
    total += list.keys.length;
    for (const k of list.keys) {
      if (refs.subjects.has(k.name) || refs.isbns.has(k.name)) continue;
      let cached_at = '';
      let title: string | null = null;
      try {
        const raw = await kv.get(k.name);
        if (raw) {
          const parsed = JSON.parse(raw) as { cached_at?: string; meta?: { title?: string | null } };
          cached_at = parsed.cached_at ?? '';
          title = parsed.meta?.title ?? null;
        }
      } catch {
        // 解析失败仍视为孤儿，展示原始键
      }
      orphans.push({ key: k.name, cached_at, title });
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return { total, orphans };
}

async function collectCoverOrphans(
  bucket: R2Bucket,
  refs: ReferenceSets,
): Promise<{ total: number; orphans: CoverOrphanItem[] }> {
  const orphans: CoverOrphanItem[] = [];
  let total = 0;
  let cursor: string | undefined;
  do {
    const list = await bucket.list({ limit: 1000, cursor });
    total += list.objects.length;
    for (const obj of list.objects) {
      if (refs.covers.has(obj.key)) continue;
      orphans.push({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded instanceof Date ? obj.uploaded.toISOString() : null,
      });
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  return { total, orphans };
}

// ===== 按需批量删除孤儿 =====
export async function deleteOrphans(
  db: D1Database,
  kv: KVNamespace | undefined,
  bucket: R2Bucket | undefined,
  kinds: { kv?: boolean; covers?: boolean },
): Promise<{ deletedKv: number; deletedCovers: number }> {
  const report = await findOrphans(db, kv, bucket);
  let deletedKv = 0;
  let deletedCovers = 0;
  if (kinds.kv && kv) {
    for (const o of report.kv.orphans) {
      try {
        await kv.delete(o.key);
        deletedKv++;
      } catch {
        // 单键删除失败不中断整体清理
      }
    }
  }
  if (kinds.covers && bucket) {
    for (const o of report.covers.orphans) {
      try {
        await bucket.delete(o.key);
        deletedCovers++;
      } catch {
        // 同上
      }
    }
  }
  return { deletedKv, deletedCovers };
}

// ===== 删除书籍联动清理 =====
// 按被删书籍收集候选键，用引用计数保护共享资源：仍有书引用（含回收站）则不删。
export async function purgeResources(
  db: D1Database,
  targets: ResourceTargets,
  deletedBooks: BookResourceRef[],
  keepSql: string,
  keepParams: (string | number)[],
): Promise<{ kv: number; covers: number }> {
  const kvKeys: string[] = [];
  const coverKeys: string[] = [];
  for (const b of deletedBooks) {
    const m = b.douban_url?.match(/subject\/(\d+)/);
    if (m) kvKeys.push(`${SUBJECT_PREFIX}${m[1]}`);
    if (b.isbn) kvKeys.push(`${ISBN_PREFIX}${b.isbn}`);
    const cm = b.cover_url?.match(new RegExp(`${COVER_PATH_PREFIX}(.+)$`));
    if (cm) coverKeys.push(decodeURIComponent(cm[1]));
  }
  const uniqueKvKeys = [...new Set(kvKeys)];
  const uniqueCoverKeys = [...new Set(coverKeys)];

  const stmts: D1PreparedStatement[] = [];
  const plans: { kind: 'kv' | 'cover'; key: string }[] = [];
  for (const key of uniqueKvKeys) {
    if (key.startsWith(SUBJECT_PREFIX)) {
      const id = key.slice(SUBJECT_PREFIX.length);
      stmts.push(db.prepare(`SELECT COUNT(*) AS c FROM books WHERE ${keepSql} AND douban_url LIKE ?`).bind(...keepParams, `%subject/${id}%`));
      plans.push({ kind: 'kv', key });
    } else if (key.startsWith(ISBN_PREFIX)) {
      const isbn = key.slice(ISBN_PREFIX.length);
      stmts.push(db.prepare(`SELECT COUNT(*) AS c FROM books WHERE ${keepSql} AND isbn = ?`).bind(...keepParams, isbn));
      plans.push({ kind: 'kv', key });
    }
  }
  for (const key of uniqueCoverKeys) {
    stmts.push(db.prepare(`SELECT COUNT(*) AS c FROM books WHERE ${keepSql} AND cover_url = ?`).bind(...keepParams, `${COVER_PATH_PREFIX}${key}`));
    plans.push({ kind: 'cover', key });
  }

  let deletedKv = 0;
  let deletedCovers = 0;
  if (stmts.length) {
    const results = await db.batch(stmts);
    for (let i = 0; i < plans.length; i++) {
      const row = results[i]?.results?.[0] as { c?: number } | undefined;
      const count = Number(row?.c ?? 0);
      if (count > 0) continue;
      try {
        if (plans[i].kind === 'kv') {
          await targets.kv?.delete(plans[i].key);
          deletedKv++;
        } else {
          await targets.bucket?.delete(plans[i].key);
          deletedCovers++;
        }
      } catch {
        // 单资源删除失败不中断整体清理
      }
    }
  }
  return { kv: deletedKv, covers: deletedCovers };
}