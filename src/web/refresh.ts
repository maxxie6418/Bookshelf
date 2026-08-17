// 统一的刷新入口（避免组件间循环依赖）
import { api } from './api';
import { setState, state } from './state';
import { toast } from './ui';

export async function refresh() {
  const f = state.viewMode === 'trash' ? { ...state.filters, trash: true } : state.filters;
  setState({ loading: true });
  try {
    const res = await api.listBooks(f);
    setState({ books: res.items, total: res.total, loading: false });
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