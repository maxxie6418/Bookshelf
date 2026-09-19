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
  subtitle: string | null;
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
    subtitle: (r['副标题'] ?? r['原书名'])?.trim() || null,
    isbn: r['ISBN']?.trim() || null,
    description: r['简介']?.trim() || null,
    notes: r['记录']?.trim() || null,
    reason: r['录入理由']?.trim() || null,
    cover_url: r['封面']?.trim() || null,
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

// CSV 原文与解析行数上限：与产品「≤1000 本」的规模约定对齐，防止超大输入耗尽 Worker CPU
const CSV_MAX_BYTES = 2_000_000;
const CSV_MAX_ROWS = 1000;
const BATCH_MAX_ITEMS = 50;

// 批量写入条目的完整校验：字段与 preview 生成的 PreparedBook 对齐，长度上限与书籍创建 schema 一致。
// 此前 batch 端点零校验（z.record(z.any()) 直通），非法 status/超长字段会打到 D1 约束异常变 500。
const importBookSchema = z.object({
  title: z.string().min(1, '书名必填').max(500, '书名过长'),
  author: z.string().max(300).nullable(),
  translator: z.string().max(300).nullable(),
  publisher: z.string().max(300).nullable(),
  publish_year: z.number().int().nullable(),
  page_count: z.number().int().nullable(),
  subtitle: z.string().max(500).nullable(),
  isbn: z.string().max(20).nullable(),
  description: z.string().max(10000, '简介过长').nullable(),
  notes: z.string().max(2000, '记录最多 2000 字').nullable(),
  reason: z.string().max(1000, '录入理由最多 1000 字').nullable(),
  cover_url: z.string().max(2048).regex(/^(https?:\/\/|\/api\/covers\/)/, '封面需为 http(s) 链接或站内封面路径').nullable(),
  douban_url: z.string().max(2048).regex(/^https?:\/\//, '链接需以 http(s):// 开头').nullable(),
  rating: z.number().min(0).max(10, '评分为 0-10').nullable(),
  status: z.enum(['unread', 'reading', 'finished', 'shelved']),
  favorite: z.union([z.literal(0), z.literal(1)]),
  category: z.string().max(100).nullable(),
  tags: z.array(z.string().min(1).max(50)).max(20, '标签最多 20 个'),
  created_at: z.string().max(30).nullable(),
});

// POST /api/import/books/preview —— 解析 CSV，逐行规范化 + 重复检测
importRoutes.post('/books/preview', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ csv: z.string().max(CSV_MAX_BYTES, 'CSV 内容过大（上限约 2MB）') }).safeParse(body);
  if (!parsed.success) return err(c, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '缺少或者非法的 csv 内容');

  const rows = parseCsvRows(parsed.data.csv);
  if (rows.length > CSV_MAX_ROWS) {
    return err(c, 'VALIDATION_ERROR', `单次最多导入 ${CSV_MAX_ROWS} 行，请拆分文件`);
  }
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

// POST /api/import/books/batch —— 写入一批（≤50）选中的书籍（逐条完整校验）
importRoutes.post('/books/batch', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ imports: z.array(importBookSchema).max(BATCH_MAX_ITEMS, `单批最多 ${BATCH_MAX_ITEMS} 条`) }).safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // path 形如 ['imports', 0, 'status']：取其中的数组下标定位第几条
    const idx = issue?.path?.find((seg) => typeof seg === 'number');
    const where = idx != null ? `第 ${idx + 1} 条：` : '';
    return err(c, 'VALIDATION_ERROR', `非法的导入数据（${where}${issue?.message ?? '字段校验失败'}）`);
  }

  const imps: PreparedBook[] = parsed.data.imports;
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
      subtitle: imp.subtitle,
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