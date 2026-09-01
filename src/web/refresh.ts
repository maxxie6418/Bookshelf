// 统一的刷新入口（避免组件间循环依赖）
import { api } from './api';
import { setState, state } from './state';
import { toast } from './ui';

// 列表每页条数；翻页时 main 查询带 limit/offset，避免超过该数量被硬截断
export const PAGE_SIZE = 60;

export async function refresh(resetPage = true, showLoading = true) {
  if (resetPage) setState({ page: 1 });
  const f = state.viewMode === 'trash' ? { ...state.filters, trash: true as const } : state.filters;
  if (showLoading) setState({ loading: true });
  try {
    // 主列表 + 侧栏聚合统计（含分类/标签计数）并发拉取，替代原先的主列表+全量列表+分类+标签四个请求
    const [res, stats] = await Promise.all([
      api.listBooks({ ...f, limit: PAGE_SIZE, offset: (state.page - 1) * PAGE_SIZE }),
      api.fetchStats(),
    ]);
    const patch: Partial<typeof state> = {
      books: res.items,
      total: res.total,
      stats,
      categories: stats.categories,
      tags: stats.tags,
    };
    if (showLoading) patch.loading = false;
    setState(patch);
  } catch (e) {
    if (showLoading) setState({ loading: false });
    toast((e as Error).message, 'error');
  }
}