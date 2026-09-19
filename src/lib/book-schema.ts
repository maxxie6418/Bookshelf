// 书籍字段的共享 zod schema：/api/books 与 /api/agent/books 共用，避免两份定义漂移。
// 长度上限与 books 表 CHECK 约束（status / favorite / source）对齐，非法值在入口层返 400
// 而不是穿透到 D1 触发约束异常变 500。
import { z } from 'zod';

// source 枚举与 schema CHECK 约束一致：('douban','neodb','openlibrary','googlebooks','manual')
export const BOOK_SOURCES = ['douban', 'neodb', 'openlibrary', 'googlebooks', 'manual'] as const;

// 封面字段允许两种取值：外链 http(s) URL，或站内 R2 代理路径 /api/covers/:key（抓取落库后的常态）
const COVER_URL_RE = /^(https?:\/\/|\/api\/covers\/)/;

export const bookSchema = z.object({
  title: z.string().min(1, '书名必填').max(500, '书名过长'),
  author: z.string().max(300).nullable().optional(),
  translator: z.string().max(300).nullable().optional(),
  publisher: z.string().max(300).nullable().optional(),
  publish_year: z.number().int().nullable().optional(),
  page_count: z.number().int().nullable().optional(),
  subtitle: z.string().max(500).nullable().optional(),
  isbn: z.string().max(20).nullable().optional(),
  description: z.string().max(10000, '简介过长').nullable().optional(),
  notes: z.string().max(2000, '记录最多 2000 字').nullable().optional(),
  reason: z.string().max(1000, '录入理由最多 1000 字').nullable().optional(),
  cover_url: z
    .string()
    .max(2048)
    .regex(COVER_URL_RE, '封面需为 http(s) 链接或站内封面路径')
    .nullable()
    .optional(),
  douban_url: z.string().max(2048).regex(/^https?:\/\//, '链接需以 http(s):// 开头').nullable().optional(),
  rating: z.number().min(0).max(10, '评分为 0-10').nullable().optional(),
  status: z.enum(['unread', 'reading', 'finished', 'shelved']).optional(),
  favorite: z.union([z.literal(0), z.literal(1)]).optional(),
  category_id: z.number().int().nullable().optional(),
  source: z.enum(BOOK_SOURCES).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20, '标签最多 20 个').optional(),
});

export type BookPayload = z.infer<typeof bookSchema>;
