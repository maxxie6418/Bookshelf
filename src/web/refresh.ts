// 统一的刷新入口（避免组件间循环依赖）
import { api } from './api';
import { setState, state } from './state';
import type { BookListResult } from './types';
import { toast } from './ui';

export async function refresh() {
  const f = state.viewMode === 'trash' ? { ...state.filters, trash: true as const } : state.filters;
  setState({ loading: true });
  try {
    const hasFilters = Object.keys(state.filters).some(k => k !== 'sort' && (state.filters as Record<string, unknown>)[k] !== undefined);
    const mainReq = api.listBooks(f);
    const allReq = state.viewMode !== 'trash' && hasFilters ? api.listBooks({}) : null;
    const [res, allRes] = await Promise.all([
      mainReq,
      allReq,
    ] as [Promise<BookListResult>, Promise<BookListResult> | null]);
    setState({
      books: res.items,
      total: res.total,
      allBooks: allRes?.items ?? res.items,
      loading: false,
    });
  } catch (e) {
    setState({ loading: false });
    toast((e as Error).message, 'error');
  }
}

export async function refreshSidebar() {
  try {
    const [categories, tags] = await Promise.all([api.listCategories(), api.listTags()]);
    setState({ categories, tags });
  } catch {
    /* 忽略侧栏刷新失败 */
  }
}