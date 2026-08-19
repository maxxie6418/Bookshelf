// 全局状态 + 极简发布订阅
import type { Book, Category, Filters, Tag, User } from './types';

const listeners = new Set<() => void>();

export const state = {
  authed: false,
  user: null as User | null,
  view: 'grid' as 'table' | 'grid',
  viewMode: 'main' as 'main' | 'trash',
  filters: {} as Filters,
  books: [] as Book[],
  allBooks: [] as Book[], // 无筛选的全部书籍（用于侧边栏统计）
  total: 0,
  loading: false,
  categories: [] as Category[],
  tags: [] as Tag[],
  drawerBook: null as Book | null,
  formOpen: false,
  formBook: null as Book | null, // null=新增，Book=编辑
  settingsOpen: false,
  taxEdit: null as 'category' | 'tag' | null, // 侧栏分类/标签内联编辑态
  theme: 'light',
};

export function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch: Partial<typeof state>) {
  Object.assign(state, patch);
  emit();
}
