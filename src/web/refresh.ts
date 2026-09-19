// 统一的刷新入口（避免组件间循环依赖）+ URL 状态同步
import { api } from './api';
import { setState, state } from './state';
import { toast } from './ui';
import type { Filters } from './types';

// 列表每页条数；翻页时 main 查询带 limit/offset，避免超过该数量被硬截断
export const PAGE_SIZE = 60;

// 竞态保护：每次发起请求自增序号，旧请求返回后若序号已过期则丢弃结果，
// 避免「搜索连续输入」「翻页快速点击」等场景下旧响应覆盖新结果。
// refreshBooks 与 refresh 复用同一序号，二者并发时也只保留最新的结果。
let seq = 0;

// ===== URL 状态同步 =====
// 视图 / 筛选 / 页码同步到 URL query：刷新不丢状态、列表可分享链接。
// 用 replaceState 写回（筛选高频操作不制造历史条目），popstate 时从 URL 恢复。

const VALID_URL_STATUS = ['unread', 'reading', 'finished', 'shelved'];

// 从当前 URL 解析视图 / 筛选 / 页码并写入全局 state（boot 与 popstate 时调用）
export function applyUrlState(): void {
  try {
    const sp = new URLSearchParams(location.search);
    const f: Filters = {};
    const status = sp.get('status');
    if (status && (VALID_URL_STATUS as string[]).includes(status)) f.status = status as Filters['status'];
    if (sp.get('favorite') === '1') f.favorite = true;
    const cat = Number(sp.get('category_id'));
    if (Number.isInteger(cat) && cat > 0) f.categoryId = cat;
    const tag = sp.get('tag');
    if (tag) f.tag = tag;
    const q = sp.get('q');
    if (q) f.q = q;
    const sort = sp.get('sort');
    if (sort) f.sort = sort;
    const viewMode = sp.get('viewmode') === 'trash' ? 'trash' : 'main';
    const view = sp.get('view') === 'table' ? 'table' : 'grid';
    const page = Math.max(1, Number(sp.get('page')) || 1);
    Object.assign(state, { viewMode, view, page, filters: f });
  } catch {
    // URL 解析失败时保持默认状态
  }
}

// 把当前 state 写回 URL（replaceState，不产生历史条目）
function syncUrl(): void {
  try {
    const sp = new URLSearchParams();
    const f = state.filters;
    if (f.status) sp.set('status', f.status);
    if (f.favorite) sp.set('favorite', '1');
    if (f.categoryId) sp.set('category_id', String(f.categoryId));
    if (f.tag) sp.set('tag', f.tag);
    if (f.q) sp.set('q', f.q);
    if (f.sort && f.sort !== 'updated_desc') sp.set('sort', f.sort);
    if (state.viewMode === 'trash') sp.set('viewmode', 'trash');
    if (state.view !== 'grid') sp.set('view', state.view);
    if (state.page > 1) sp.set('page', String(state.page));
    const qs = sp.toString();
    history.replaceState(null, '', `${location.pathname}${qs ? '?' + qs : ''}${location.hash}`);
  } catch {
    // history 不可用（如某些嵌入式 WebView）时静默跳过
  }
}

// 后退 / 前进：从 URL 恢复视图 / 筛选 / 页码并重拉列表；同步两个搜索框的显示
window.addEventListener('popstate', () => {
  applyUrlState();
  for (const id of ['search-desktop', 'search-mobile']) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = state.filters.q ?? '';
  }
  void refreshBooks(false, false);
});

// 仅请求列表（含当前筛选/分页），供搜索、筛选、排序、翻页等「纯列表切换」场景调用
export async function refreshBooks(resetPage = true, showLoading = true) {
  if (resetPage) setState({ page: 1 });
  const mySeq = ++seq;
  if (showLoading) setState({ loading: true, listError: false });
  const f = state.viewMode === 'trash' ? { ...state.filters, trash: true as const } : state.filters;
  try {
    const res = await api.listBooks({ ...f, limit: PAGE_SIZE, offset: (state.page - 1) * PAGE_SIZE });
    if (mySeq !== seq) return; // 已有更新的请求，丢弃本次响应
    setState({ books: res.items, total: res.total, listError: false, ...(showLoading ? { loading: false } : {}) });
    syncUrl();
  } catch (e) {
    if (mySeq !== seq) return; // 过期请求的报错同样丢弃
    if (showLoading) setState({ loading: false, listError: true });
    toast((e as Error).message, 'error');
  }
}

// 全量刷新：列表 + 侧栏聚合统计（含分类/标签计数），供新增/编辑/删除/恢复/导入等数据变更场景调用
export async function refresh(resetPage = true, showLoading = true) {
  if (resetPage) setState({ page: 1 });
  const mySeq = ++seq;
  if (showLoading) setState({ loading: true, listError: false });
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
      listError: false,
    };
    if (showLoading) patch.loading = false;
    setState(patch);
    syncUrl();
  } catch (e) {
    if (mySeq !== seq) return; // 过期请求的报错同样丢弃
    if (showLoading) setState({ loading: false, listError: true });
    toast((e as Error).message, 'error');
  }
}
