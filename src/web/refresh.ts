// 统一的刷新入口（避免组件间循环依赖）
import { api } from './api';
import { setState, state } from './state';
import { toast } from './ui';

// 列表每页条数；翻页时 main 查询带 limit/offset，避免超过该数量被硬截断
export const PAGE_SIZE = 60;

// 竞态保护：每次发起请求自增序号，旧请求返回后若序号已过期则丢弃结果，
// 避免「搜索连续输入」「翻页快速点击」等场景下旧响应覆盖新结果。
// refreshBooks 与 refresh 复用同一序号，二者并发时也只保留最新的结果。
let seq = 0;

// 仅请求列表（含当前筛选/分页），供搜索、筛选、排序、翻页等「纯列表切换」场景调用
export async function refreshBooks(resetPage = true, showLoading = true) {
  if (resetPage) setState({ page: 1 });
  const mySeq = ++seq;
  if (showLoading) setState({ loading: true });
  const f = state.viewMode === 'trash' ? { ...state.filters, trash: true as const } : state.filters;
  try {
    const res = await api.listBooks({ ...f, limit: PAGE_SIZE, offset: (state.page - 1) * PAGE_SIZE });
    if (mySeq !== seq) return; // 已有更新的请求，丢弃本次响应
    setState({ books: res.items, total: res.total, ...(showLoading ? { loading: false } : {}) });
  } catch (e) {
    if (mySeq !== seq) return; // 过期请求的报错同样丢弃
    if (showLoading) setState({ loading: false });
    toast((e as Error).message, 'error');
  }
}

// 全量刷新：列表 + 侧栏聚合统计（含分类/标签计数），供新增/编辑/删除/恢复/导入等数据变更场景调用
export async function refresh(resetPage = true, showLoading = true) {
  if (resetPage) setState({ page: 1 });
  const mySeq = ++seq;
  if (showLoading) setState({ loading: true });
  const f = state.viewMode === 'trash' ? { ...state.filters, trash: true as const } : state.filters;
  try {
    // 主列表 + 侧栏聚合统计（含分类/标签计数）并发拉取，替代原先的主列表+全量列表+分类+标签四个请求
    const [res, stats] = await Promise.all([
      api.listBooks({ ...f, limit: PAGE_SIZE, offset: (state.page - 1) * PAGE_SIZE }),
      api.fetchStats(),
    ]);
    if (mySeq !== seq) return; // 已有更新的请求，丢弃本次响应
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
    if (mySeq !== seq) return; // 过期请求的报错同样丢弃
    if (showLoading) setState({ loading: false });
    toast((e as Error).message, 'error');
  }
}