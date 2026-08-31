// 书单导入端点 /api/import/*
// 鉴权：登录 session。
// 流程：POST /books/preview 解析 CSV + 重复检测 → 前端勾选 → POST /books/batch 逐批写入。
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import { parseCsvRows, normalizeStatus, normalizeTitle } from '../lib/csv';
import { mapExistingByKey, createBook } from '../lib/books';
import * as categories from '../lib/categories';
import type { BookInput } from '../lib/books';

export const importRoutes = new Hono<{ Bindings: Env }>();
importRoutes.use(requireAuth);

const CATEGORY_COLORS = ['#8b5cf6', '#06b6d4', '#f97316', '#10b981', '#ef4444', '#3b82f6', '#eab308', '#ec4899'];

export interface PreparedBook {
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
  reason: string | null;
  cover_url: string | null;
  douban_url: string | null;
  rating: number | null;
  status: string;
  favorite: number;
  category: string | null;
  tags: string[];
  created_at: string | null;
}

function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^\d.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function rowToPrepared(r: Record<string, string>): PreparedBook {
  return {
    title: r['书名']?.trim() ?? '',
    author: r['作者']?.trim() || null,
    translator: r['译者']?.trim() || null,
    publisher: r['出版社']?.trim() || null,
    publish_year: num(r['出版年份']),
    page_count: num(r['页数']),
    original_title: r['原书名']?.trim() || null,
    isbn: r['ISBN']?.trim() || null,
    description: r['简介']?.trim() || null,
    notes: r['记录']?.trim() || null,
    reason: r['录入理由']?.trim() || null,
    cover_url: null,
    douban_url: r['豆瓣链接']?.trim() || null,
    rating: num(r['评分']),
    status: normalizeStatus(r['状态'] ?? '') ?? 'unread',
    favorite: ['是', '1', 'true', 'TRUE'].includes(r['收藏']?.trim() ?? '') ? 1 : 0,
    category: r['分类']?.trim() || null,
    tags: (r['标签'] ?? '').split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    created_at: r['录入时间']?.trim() || null,
  };
}

function err(c: { json: (v: unknown, s?: number) => Response }, code: string, message: string, status = 400): Response {
  return c.json({ error: { code, message } }, status);
}

// POST /api/import/books/preview —— 解析 CSV，逐行规范化 + 重复检测
importRoutes.post('/books/preview', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ csv: z.string() }).safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', '缺少或者非法的 csv 内容');

  const rows = parseCsvRows(parsed.data.csv);
  const meta = await mapExistingByKey(c.env.DB);

  const result = rows.map((r, i) => {
    const p = rowToPrepared(r);
    const matched: { id: number; title: string }[] = [];
    if (p.title) {
      const byTitle = meta.byTitleNormalized.get(normalizeTitle(p.title)) ?? [];
      byTitle.forEach((b) => matched.push({ id: b.id, title: b.title }));
    }
    if (p.isbn) {
      const b = meta.byIsbn.get(p.isbn);
      if (b) matched.push({ id: b.id, title: b.title });
    }
    if (p.douban_url) {
      const b = meta.byDouban.get(p.douban_url);
      if (b) matched.push({ id: b.id, title: b.title });
    }
    const uniq = [...new Map(matched.map((m) => [m.id, m])).values()];
    return {
      index: i,
      title: p.title,
      author: p.author,
      isbn: p.isbn,
      douban_url: p.douban_url,
      valid: !!p.title,
      duplicate: uniq.length > 0,
      matched: uniq,
      fields: p,
    };
  });

  return c.json({
    rows: result,
    summary: {
      total: result.length,
      valid: result.filter((r) => r.valid).length,
      duplicate: result.filter((r) => r.duplicate).length,
    },
  });
});

// POST /api/import/books/batch —— 写入一批（≤50）选中的书籍
importRoutes.post('/books/batch', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ imports: z.array(z.record(z.any())).max(50) }).safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', '非法的导入数据');

  const imps = parsed.data.imports as unknown as PreparedBook[];
  if (!imps.length) return c.json({ created: 0 });

  const catCache = new Map<string, number>();
  for (const cc of await categories.listCategories(c.env.DB)) {
    catCache.set(cc.name.toLowerCase(), cc.id);
  }

  let created = 0;
  for (const imp of imps) {
    if (!imp.title) continue;
    let categoryId: number | null = null;
    if (imp.category) {
      const key = imp.category.toLowerCase();
      let id = catCache.get(key);
      if (id == null) {
        const color = CATEGORY_COLORS[catCache.size % CATEGORY_COLORS.length];
        id = await categories.createCategory(c.env.DB, imp.category, color);
        catCache.set(key, id);
      }
      categoryId = id;
    }
    const input: BookInput = {
      title: imp.title,
      author: imp.author,
      translator: imp.translator,
      publisher: imp.publisher,
      publish_year: imp.publish_year,
      page_count: imp.page_count,
      original_title: imp.original_title,
      isbn: imp.isbn,
      description: imp.description,
      notes: imp.notes,
      reason: imp.reason,
      cover_url: imp.cover_url,
      douban_url: imp.douban_url,
      rating: imp.rating,
      status: imp.status as BookInput['status'],
      favorite: imp.favorite,
      category_id: categoryId,
      tags: imp.tags,
      source: 'manual',
      created_at: imp.created_at || null,
    };
    await createBook(c.env.DB, input);
    created++;
  }
  return c.json({ created });
});