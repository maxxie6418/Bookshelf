// 元数据兜底源：NeoDB → Open Library → Google Books（均无需密钥，匿名可读）。
// 豆瓣仍是主源（见 book-metadata.ts）；本模块仅在豆瓣抓取失败或无结果时按链兜底，
// 任一源命中即返回；单个源的网络/解析失败只记日志并继续下一源。
// 数据实测（2026-09）：NeoDB /api/catalog/search 与 /api/book/{uuid} 匿名可用，中文书籍覆盖好，
// 且 external_resources 可反查豆瓣链接；Open Library 对中文 ISBN 覆盖差；Google Books 对
// Cloudflare 出口 IP 经常触发匿名配额 429，故仅作末位兜底。
import type { KVNamespace } from '@cloudflare/workers-types';
import { fetchWithRetry } from './fetch-utils';
import {
  readMetaCache,
  writeMetaCache,
  fetchDoubanMetadataByIsbn,
  type BookMetadata,
  type FetchMetadataOptions,
} from './book-metadata';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 豆瓣评分与 NeoDB 评分同为 10 分制；Google Books 为 5 分制（×2 换算）
function firstAuthor(names: string[] | undefined | null): string | null {
  return names?.length ? names.join(', ') : null;
}

// ===== NeoDB =====

interface NeoDBEdition {
  uuid?: string;
  title?: string;
  subtitle?: string | null;
  author?: string[] | null;
  translator?: string[] | null;
  publisher?: string[] | null;
  pub_year?: number | null;
  isbn?: string | null;
  pages?: string | number | null;
  cover_image_url?: string | null;
  rating?: number | null;
  brief?: string | null;
  description?: string | null;
  external_resources?: { url: string }[] | null;
}

function mapNeoDB(d: NeoDBEdition, isbn: string): BookMetadata | null {
  if (!d?.title) return null;
  const doubanUrl = d.external_resources
    ?.map((r) => r.url)
    .find((u) => /^https:\/\/book\.douban\.com\/subject\/\d+\/?/.test(u)) ?? null;
  return {
    title: d.title,
    author: firstAuthor(d.author),
    translator: firstAuthor(d.translator),
    publisher: d.publisher?.length ? d.publisher.join(', ') : null,
    publish_year: d.pub_year ?? null,
    page_count: d.pages ? Number(String(d.pages).replace(/\D/g, '')) || null : null,
    subtitle: d.subtitle || null,
    isbn: d.isbn || isbn,
    description: d.description || d.brief || null,
    cover_url: d.cover_image_url || null,
    douban_rating: d.rating ?? null,
    source: 'neodb',
    douban_url: doubanUrl,
  };
}

async function fetchNeoDBByIsbn(isbn: string, kv?: KVNamespace, opts?: FetchMetadataOptions): Promise<BookMetadata | null> {
  const cacheKey = `meta:neodb:isbn:${isbn}`;
  if (!opts?.force) {
    const cached = await readMetaCache(kv, cacheKey);
    if (cached) return cached;
  }
  const res = await fetchWithRetry(
    `https://neodb.social/api/catalog/search?query=${encodeURIComponent(isbn)}&category=book`,
    { timeoutMs: 12000 },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: NeoDBEdition[] };
  const edition = data.data?.[0];
  if (!edition?.uuid) return null;
  const detailRes = await fetchWithRetry(`https://neodb.social/api/book/${edition.uuid}`, { timeoutMs: 12000 });
  if (!detailRes.ok) return null;
  const detail = (await detailRes.json()) as NeoDBEdition;
  const meta = mapNeoDB(detail, isbn);
  if (meta) await writeMetaCache(kv, cacheKey, meta);
  return meta;
}

// ===== Open Library =====

interface OLData {
  title?: string;
  subtitle?: string | null;
  authors?: { name: string }[] | null;
  publishers?: { name: string }[] | null;
  publish_date?: string | null;
  number_of_pages?: number | null;
  cover?: { large?: string; medium?: string; small?: string } | null;
  excerpts?: { text: string }[] | null;
  notes?: string | null;
}

async function fetchOpenLibraryByIsbn(isbn: string, kv?: KVNamespace, opts?: FetchMetadataOptions): Promise<BookMetadata | null> {
  const cacheKey = `meta:openlibrary:isbn:${isbn}`;
  if (!opts?.force) {
    const cached = await readMetaCache(kv, cacheKey);
    if (cached) return cached;
  }
  const res = await fetchWithRetry(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`,
    { timeoutMs: 12000 },
  );
  if (!res.ok) return null;
  const raw = (await res.json()) as Record<string, OLData>;
  const d = raw?.[`ISBN:${isbn}`];
  if (!d?.title) return null;
  const year = d.publish_date?.match(/\d{4}/)?.[0];
  const cover = d.cover?.large ?? d.cover?.medium ?? d.cover?.small ?? null;
  const meta: BookMetadata = {
    title: d.title,
    author: firstAuthor(d.authors?.map((a) => a.name)),
    translator: null,
    publisher: firstAuthor(d.publishers?.map((p) => p.name)),
    publish_year: year ? Number(year) : null,
    page_count: d.number_of_pages ?? null,
    subtitle: d.subtitle || null,
    isbn,
    description: d.excerpts?.[0]?.text || d.notes || null,
    cover_url: cover,
    douban_rating: null,
    source: 'openlibrary',
  };
  await writeMetaCache(kv, cacheKey, meta);
  return meta;
}

// ===== Google Books =====

interface GBVolumeInfo {
  title?: string;
  subtitle?: string | null;
  authors?: string[] | null;
  publisher?: string | null;
  publishedDate?: string | null;
  description?: string | null;
  pageCount?: number | null;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string } | null;
  averageRating?: number | null;
}

async function fetchGoogleBooksByIsbn(isbn: string, kv?: KVNamespace, opts?: FetchMetadataOptions): Promise<BookMetadata | null> {
  const cacheKey = `meta:googlebooks:isbn:${isbn}`;
  if (!opts?.force) {
    const cached = await readMetaCache(kv, cacheKey);
    if (cached) return cached;
  }
  const res = await fetchWithRetry(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`,
    { timeoutMs: 12000 },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { volumeInfo?: GBVolumeInfo }[] };
  const v = data.items?.[0]?.volumeInfo;
  if (!v?.title) return null;
  const year = v.publishedDate?.match(/\d{4}/)?.[0];
  const cover = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? null;
  const meta: BookMetadata = {
    title: v.title,
    author: firstAuthor(v.authors),
    translator: null,
    publisher: v.publisher ?? null,
    publish_year: year ? Number(year) : null,
    page_count: v.pageCount ?? null,
    subtitle: v.subtitle || null,
    isbn,
    description: v.description ?? null,
    cover_url: cover ? cover.replace(/^http:\/\//, 'https://') : null,
    // Google Books 评分为 0-5，统一换算到本应用的 10 分制
    douban_rating: v.averageRating != null ? Math.round(v.averageRating * 2 * 10) / 10 : null,
    source: 'googlebooks',
  };
  await writeMetaCache(kv, cacheKey, meta);
  return meta;
}

// ===== 兜底链 =====

const FALLBACK_CHAIN: {
  name: string;
  fetch: (isbn: string, kv?: KVNamespace, opts?: FetchMetadataOptions) => Promise<BookMetadata | null>;
}[] = [
  { name: 'neodb', fetch: fetchNeoDBByIsbn },
  { name: 'openlibrary', fetch: fetchOpenLibraryByIsbn },
  { name: 'googlebooks', fetch: fetchGoogleBooksByIsbn },
];

// 按链兜底抓取：任一源命中即返回；全部未命中/失败抛错（由调用方转为 400）
export async function fetchFallbackMetadataByIsbn(
  isbn: string,
  kv?: KVNamespace,
  opts?: FetchMetadataOptions,
): Promise<BookMetadata> {
  const cleaned = isbn.replace(/[^0-9Xx]/g, '');
  for (const src of FALLBACK_CHAIN) {
    try {
      const meta = await src.fetch(cleaned, kv, opts);
      if (meta) return meta;
    } catch (e) {
      console.error(`[metadata-fallback] ${src.name} 抓取失败：`, (e as Error)?.message ?? e);
    }
  }
  throw new Error('未能从任何数据源找到该 ISBN');
}

// ISBN 抓取总入口：豆瓣优先，失败或无结果时走兜底链（neodb → openlibrary → googlebooks）
export async function fetchMetadataByIsbn(
  isbn: string,
  kv?: KVNamespace,
  opts?: FetchMetadataOptions,
): Promise<BookMetadata> {
  try {
    return await fetchDoubanMetadataByIsbn(isbn, kv, opts);
  } catch (e) {
    console.error('[metadata-fallback] 豆瓣未命中，尝试兜底源：', (e as Error)?.message ?? e);
  }
  return fetchFallbackMetadataByIsbn(isbn, kv, opts);
}
