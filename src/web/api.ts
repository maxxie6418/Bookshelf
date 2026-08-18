// API 客户端（前端唯一的数据入口）
import type { Book, BookListResult, Category, Filters, Tag, User } from './types';

const BASE = '/api';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) };
  if (init?.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { credentials: 'same-origin', ...init, headers });
  if (res.status === 204) return undefined as T;
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error?.code ?? 'ERROR', body?.error?.message ?? `请求失败(${res.status})`, res.status);
  }
  return (body?.data ?? body) as T;
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  // auth
  login: (password: string) => request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/auth/me'),
  changePassword: (new_password: string) => request<{ success: boolean }>('/auth/password', { method: 'POST', body: JSON.stringify({ new_password }) }),

  // books
  listBooks: (f: Filters & { trash?: boolean; limit?: number; offset?: number }) =>
    request<BookListResult>(`/books${qs(f)}`),
  getBook: (id: number) => request<Book>(`/books/${id}`),
  createBook: (data: Partial<Book> & { title: string }) => request<Book>('/books', { method: 'POST', body: JSON.stringify(data) }),
  updateBook: (id: number, data: Partial<Book>) => request<Book>(`/books/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDelete: (id: number) => request<{ deleted: boolean }>(`/books/${id}`, { method: 'DELETE' }),
  restore: (id: number) => request<Book>(`/books/${id}/restore`, { method: 'POST' }),
  permanentDelete: (id: number) => request<void>(`/books/trash/${id}`, { method: 'DELETE' }),
  clearTrash: () => request<{ deleted: number }>('/books/trash', { method: 'DELETE' }),

  // metadata（豆瓣抓取）
  fetchMetadata: (input: { url?: string; isbn?: string }) =>
    request<{
      title: string | null;
      author: string | null;
      translator: string | null;
      publisher: string | null;
      publish_year: number | null;
      page_count: number | null;
      original_title: string | null;
      isbn: string | null;
      description: string | null;
      cover_url: string | null;
      douban_url: string | null;
      douban_rating: number | null;
      source: string;
    }>('/books/metadata/fetch', { method: 'POST', body: JSON.stringify(input) }),

  // categories
  listCategories: () => request<Category[]>('/categories'),
  createCategory: (name: string, color: string) => request<Category>('/categories', { method: 'POST', body: JSON.stringify({ name, color }) }),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' }),

  // tags
  listTags: () => request<Tag[]>('/tags'),
  createTag: (name: string) => request<Tag>('/tags', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteTag: (id: number) => request<void>(`/tags/${id}`, { method: 'DELETE' }),

  // AI agent keys（管理）
  listAgentKeys: () => request<{ hash: string; label: string; created_at: string; prefix: string }[]>('/agent-keys'),
  createAgentKey: (label: string) => request<{ hash: string; label: string; created_at: string; prefix: string; key: string }>('/agent-keys', { method: 'POST', body: JSON.stringify({ label }) }),
  revokeAgentKey: (hash: string) => request<void>(`/agent-keys/${hash}`, { method: 'DELETE' }),
};