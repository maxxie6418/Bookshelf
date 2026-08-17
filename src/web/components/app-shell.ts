// 应用外壳：顶栏（搜索/主题/设置/退出）+ 侧栏（筛选）+ 主区（列表/回收站）
import { api } from '../api';
import { setState, state, subscribe } from '../state';
import { h, toast } from '../ui';
import { refresh, refreshSidebar } from '../refresh';
import { renderBookList } from './book-list';
import { renderTrash } from './trash-panel';
import { openSettings, toggleTheme } from './settings-panel';

const STATUS = [['unread', '未读'], ['reading', '在读'], ['finished', '读完']] as const;

const STATUS_META: Record<string, { label: string; dot: string; badgeBg: string; badgeText: string }> = {
  unread:   { label: '未读',   dot: 'bg-shelf-400',           badgeBg: 'bg-shelf-100 dark:bg-shelf-700',           badgeText: 'text-shelf-600 dark:text-shelf-400' },
  reading:  { label: '在读',   dot: 'bg-emerald-500 status-reading-dot', badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30',  badgeText: 'text-emerald-700 dark:text-emerald-400' },
  finished: { label: '已读完', dot: 'bg-amber-500',           badgeBg: 'bg-amber-100 dark:bg-amber-900/30',          badgeText: 'text-amber-700 dark:text-amber-400' },
};

export function mountAppShell(root: HTMLElement) {
  root.replaceChildren();
  root.className = '';

  // ---------- 顶栏 ----------
  const search = h('input', {
    type: 'search',
    placeholder: '搜索书名、作者、ISBN...',
    value: state.filters.q ?? '',
    class: 'w-full pl-10 pr-4 py-2 rounded-xl bg-shelf-100 dark:bg-shelf-700 border-0 text-sm focus:ring-2 focus:ring-amber-500/50 focus:bg-white dark:focus:bg-shelf-600 transition-all placeholder:text-shelf-400',
  });
  let timer: number | undefined;
  search.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      setState({ filters: { ...state.filters, q: search.value.trim() || undefined } });
      void refresh();
    }, 300);
  });

  const navbar = h('header', {
    class: 'sticky top-0 z-40 bg-white/80 dark:bg-shelf-800/80 backdrop-blur-xl border-b border-shelf-200 dark:border-shelf-700 transition-colors duration-300',
  },
    h('div', { class: 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8' },
      h('div', { class: 'flex items-center justify-between h-16' },
        // Logo
        h('div', { class: 'flex items-center gap-2.5 shrink-0' },
          h('div', { class: 'w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg' },
            h('svg', { class: 'w-4 h-4 text-white', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
              h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }),
            ),
          ),
          h('span', { class: 'text-lg font-bold tracking-tight font-serif hidden sm:block' }, '我的书架'),
        ),
        // 搜索（桌面端）
        h('div', { class: 'hidden md:flex flex-1 max-w-xl mx-8' },
          h('div', { class: 'relative w-full' },
            h('svg', { class: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-shelf-400', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
              h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' }),
            ),
            search,
          ),
        ),
        // 右侧按钮
        h('div', { class: 'flex items-center gap-2' },
          h('button', {
            class: 'p-2 rounded-lg hover:bg-shelf-100 dark:hover:bg-shelf-700 transition-colors',
            title: '切换主题',
            onclick: toggleTheme,
          }, state.theme === 'dark' ? '☀️' : '🌙'),
          h('button', {
            class: 'hidden sm:flex items-center gap-2 px-4 py-2 bg-shelf-800 dark:bg-amber-500 text-white dark:text-shelf-900 rounded-lg hover:bg-shelf-700 dark:hover:bg-amber-400 transition-all font-medium text-sm shadow-lg shadow-shelf-800/20',
            onclick: () => { import('./book-form').then(m => m.openBookForm()); },
          },
            h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
              h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 4v16m8-8H4' }),
            ),
            '添加书籍',
          ),
          h('button', {
            class: 'p-2 rounded-lg hover:bg-shelf-100 dark:hover:bg-shelf-700 transition-colors text-sm',
            title: '设置',
            onclick: openSettings,
          }, '⚙️'),
          h('button', {
            class: 'p-2 rounded-lg hover:bg-shelf-100 dark:hover:bg-shelf-700 transition-colors text-sm',
            title: '退出',
            onclick: async () => {
              await api.logout().catch(() => undefined);
              window.location.reload();
            },
          }, '退出'),
        ),
      ),
      // 搜索（移动端）
      h('div', { class: 'md:hidden pb-3' },
        h('div', { class: 'relative' },
          h('svg', { class: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-shelf-400', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
            h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' }),
          ),
          h('input', {
            type: 'search',
            placeholder: '搜索书名、作者...',
            value: state.filters.q ?? '',
            class: 'w-full pl-10 pr-4 py-2 rounded-xl bg-shelf-100 dark:bg-shelf-700 border-0 text-sm focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-shelf-400',
            oninput: (e: Event) => {
              const v = (e.target as HTMLInputElement).value.trim();
              setState({ filters: { ...state.filters, q: v || undefined } });
              void refresh();
            },
          }),
        ),
      ),
    ),
  );

  // ---------- 侧栏 / 主区 ----------
  const sidebarRoot = h('aside', { class: 'w-60 shrink-0 border-r border-shelf-200 dark:border-shelf-700 p-5 overflow-y-auto hidden md:block' });
  const viewRoot = h('main', { class: 'flex-1 min-w-0' });
  const toastRoot = h('div', { id: 'toast-root', class: 'fixed bottom-4 right-4 z-[60] space-y-2 pointer-events-none' });

  const render = () => {
    sidebarRoot.replaceChildren(renderSidebar());
    viewRoot.replaceChildren();
    if (state.viewMode === 'trash') renderTrash(viewRoot);
    else renderBookList(viewRoot);
  };
  subscribe(render);

  root.append(
    navbar,
    h('div', { class: 'max-w-[1600px] mx-auto flex min-h-[calc(100vh-64px)]' }, sidebarRoot, viewRoot),
    toastRoot,
  );

  render();
  void refresh();
  void refreshSidebar();
}

function renderSidebar(): HTMLElement {
  const f = state.filters;
  const clickFilter = (patch: Partial<typeof state.filters>) => {
    setState({ filters: { ...state.filters, ...patch } });
    void refresh();
  };

  const statusCounts = { unread: 0, reading: 0, finished: 0 };
  for (const b of state.allBooks ?? []) {
    if (b.status in statusCounts) {
      statusCounts[b.status as keyof typeof statusCounts]++;
    }
  }

  const item = (label: string, active: boolean, count: number | undefined, onclick: () => void, dotClass?: string) =>
    h('button', {
      class:
        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ' +
        (active
          ? 'bg-shelf-100 dark:bg-shelf-700 font-medium'
          : 'hover:bg-shelf-50 dark:hover:bg-shelf-700/50'),
      onclick,
    },
      h('span', { class: 'flex items-center gap-2.5 truncate' },
        dotClass ? h('span', { class: `w-2 h-2 rounded-full ${dotClass}` }) : null,
        label,
      ),
      count != null ? h('span', { class: 'text-xs text-shelf-400 font-mono shrink-0' }, String(count)) : null,
    );

  const section = (title: string, children: HTMLElement[]) =>
    h('div', { class: 'mb-5' },
      h('h3', { class: 'text-xs font-semibold text-shelf-400 uppercase tracking-wider mb-3 px-3' }, title),
      ...children,
    );

  const total = state.allBooks?.length ?? state.total ?? 0;

  return h('div', { class: 'space-y-6' },
    // 统计卡片
    h('div', { class: 'grid grid-cols-2 gap-3' },
      h('div', { class: 'bg-shelf-50 dark:bg-shelf-700/50 rounded-xl p-3 text-center' },
        h('div', { class: 'text-2xl font-bold text-shelf-800 dark:text-white font-serif' }, String(total)),
        h('div', { class: 'text-xs text-shelf-500 dark:text-shelf-400 mt-0.5' }, '总藏书'),
      ),
      h('div', { class: 'bg-shelf-50 dark:bg-shelf-700/50 rounded-xl p-3 text-center' },
        h('div', { class: 'text-2xl font-bold text-amber-600 dark:text-amber-400 font-serif' }, String(statusCounts.reading)),
        h('div', { class: 'text-xs text-shelf-500 dark:text-shelf-400 mt-0.5' }, '在读'),
      ),
    ),
    // 状态筛选
    section('阅读状态', [
      item('全部书籍', !f.status && !f.categoryId && !f.tag, total, () => clickFilter({ status: undefined, categoryId: undefined, tag: undefined }), 'bg-shelf-400'),
      ...STATUS.map(([v, label]) => {
        const meta = STATUS_META[v];
        return item(label, f.status === v, statusCounts[v as keyof typeof statusCounts], () => clickFilter({ status: f.status === v ? undefined : v }), meta.dot);
      }),
    ]),
    // 分类筛选
    section('分类', state.categories.map((c) =>
      item(c.name, f.categoryId === c.id, c.count, () => clickFilter({ categoryId: f.categoryId === c.id ? undefined : c.id })),
    )),
    // 标签筛选
    section('标签', state.tags.map((t) =>
      item(`#${t.name}`, f.tag === t.name, t.count, () => clickFilter({ tag: f.tag === t.name ? undefined : t.name })),
    )),
    // 管理
    section('管理', [
      item('🗑 回收站', state.viewMode === 'trash', undefined, () => {
        setState({ viewMode: state.viewMode === 'trash' ? 'main' : 'trash' });
        void refresh();
      }),
    ]),
  );
}