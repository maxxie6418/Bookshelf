// 前后端共享的数据类型（与 DOCS/API接口手册.md 对齐）

export interface User {
  id: number;
  username: string | null;
  display_name: string | null;
  is_admin: boolean;
  must_change_password: boolean;
}

export interface Book {
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
  notes?: string | null;
  cover_url: string | null;
  douban_url: string | null;
  rating: number | null;
  status: 'unread' | 'reading' | 'finished';
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  tags: string[];
  source: string;
  started_at: string | null;
  finished_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  count: number;
}

export interface Tag {
  id: number;
  name: string;
  count: number;
}

export interface BookListResult {
  items: Book[];
  total: number;
}

export interface Filters {
  status?: string;
  categoryId?: number;
  tag?: string;
  q?: string;
  sort?: string;
  trash?: boolean;
}
