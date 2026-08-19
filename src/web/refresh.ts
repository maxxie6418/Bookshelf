// 统一的刷新入口（避免组件间循环依赖）
import { api } from './api';
import { setState, state } from './state';
import type { BookListResult } from './types';
import { toast } from './ui';

// 列表每页条数；翻页时 main 查询带 limit/offset，避免超过该数量被硬截断
export const PAGE_SIZE = 60;

export async function refresh(resetPage = true) {
  if (resetPage) setState({ page: 1 });
  const f = state.viewMode === 'trash' ? { ...state.filters, trash: true as const } : state.filters;
  setState({ loading: true });
  try {
    const mainReq = api.listBooks({ ...f, limit: PAGE_SIZE, offset: (state.page - 1) * PAGE_SIZE });
    const allReq = state.viewMode !== 'trash' ? api.listBooks({}) : null;
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
