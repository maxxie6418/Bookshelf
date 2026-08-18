// 书单导出端点 /api/export/*
// 鉴权：登录 session；导出全部未删除书籍（全字段 CSV）
import { Hono } from 'hono';
import type { Env } from '../env';
import { requireAuth } from '../lib/guard';
import { listAllBooks } from '../lib/books';
import { toCsv, type BookCsvRow } from '../lib/csv';

export const exportRoutes = new Hono<{ Bindings: Env }>();
exportRoutes.use(requireAuth);

const statusLabel: Record<string, string> = { unread: '未读', reading: '在读', finished: '已读完' };

// 将书籍行映射为 CSV 行（供 session 导出与 AI Agent 导出复用）
export function exportBookToRow(b: {
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
  douban_url: string | null;
  rating: number | null;
  status: string;
  category_name: string | null;
  tags: string[];
}): BookCsvRow {
  return {
    '书名': b.title,
    '作者': b.author ?? '',
    '译者': b.translator ?? '',
    '出版社': b.publisher ?? '',
    '出版年份': b.publish_year ?? '',
    '页数': b.page_count ?? '',
    '原书名': b.original_title ?? '',
    'ISBN': b.isbn ?? '',
    '简介': b.description ?? '',
    '记录': b.notes ?? '',
    '豆瓣链接': b.douban_url ?? '',
    '评分': b.rating ?? '',
    '状态': statusLabel[b.status] ?? b.status,
    '分类': b.category_name ?? '',
    '标签': b.tags.join(','),
  };
}

// GET /api/export/template —— 仅表头
exportRoutes.get('/template', async (c) => {
  const csv = toCsv([]);
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="books-template.csv"` },
  });
});

// GET /api/export/books —— 全部未删除藏书
exportRoutes.get('/books', async (c) => {
  const books = await listAllBooks(c.env.DB);
  const csv = toCsv(books.map((b) => exportBookToRow(b)));
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="books-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
});