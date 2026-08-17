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
  total: 0,
  loading: false,
  categories: [] as Category[],
  tags: [] as Tag[],
  drawerBook: null as Book | null,
  formOpen: false,
  formBook: null as Book | null, // null=新增，Book=编辑
  settingsOpen: false,
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
