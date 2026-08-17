// 应用外壳：顶栏（搜索/主题/设置/退出）+ 侧栏（筛选）+ 主区（列表/回收站）
import { api } from '../api';
import { setState, state, subscribe } from '../state';
import { h, toast, iconSun, iconMoon, iconSettings, iconLogout, iconTrash, iconSearch, iconPlus } from '../ui';
import { refresh, refreshSidebar } from '../refresh';
import { renderBookList } from './book-list';
import { renderTrash } from './trash-panel';
import { openSettings, toggleTheme } from './settings-panel';

const STATUS = [['unread', '未读'], ['reading', '在读'], ['finished', '读完']] as const;

const STATUS_META: Record<string, { label: string; dot: string; badgeBg: string; badgeText: string }> = {
  unread:   { label: '未读',   dot: 'bg-[var(--text-muted)]',                 badgeBg: 'bg-[var(--bg-surface-hover)]', badgeText: 'text-[var(--text-secondary)]' },
  reading:  { label: '在读',   dot: 'bg-[var(--accent)] status-reading-dot', badgeBg: 'bg-[var(--accent)]/10',        badgeText: 'text-[var(--accent)]' },
  finished: { label: '已读完', dot: 'bg-[var(--accent)]',                      badgeBg: 'bg-[var(--bg-surface-hover)]', badgeText: 'text-[var(--text-secondary)]' },
};

export function mountAppShell(root: HTMLElement) {
  root.replaceChildren();
  root.className = '';

  // ---------- 顶栏 ----------
  const search = h('input', {
    type: 'search',
    placeholder: '搜索书名、作者、ISBN...',
    value: state.filters.q ?? '',
    class: 'w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-page)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]',
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
    class: 'sticky top-0 z-40 bg-[var(--bg-surface)]/80 backdrop-blur-xl border-b border-[var(--border-default)] text-[var(--text-primary)] transition-colors duration-300',
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
          h('span', { class: 'text-lg font-bold tracking-tight font-display hidden sm:block' }, '我的书架'),
        ),
        // 搜索（桌面端）
        h('div', { class: 'hidden md:flex flex-1 max-w-2xl mx-8' },
          h('div', { class: 'relative w-full' },
            h('span', { class: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]' }, iconSearch(16)),
            search,
          ),
        ),
        // 右侧按钮
        h('div', { class: 'flex items-center gap-2' },
          h('button', {
            class: 'p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-secondary)]',
            title: '切换主题',
            onclick: toggleTheme,
          }, state.theme === 'dark' ? iconSun(20) : iconMoon(20)),
          h('button', {
            class: 'hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors font-medium text-sm',
            onclick: () => { import('./book-form').then(m => m.openBookForm()); },
          }, iconPlus(18), '添加书籍'),
          h('button', {
            class: 'p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-secondary)]',
            title: '设置',
            onclick: openSettings,
          }, iconSettings(20)),
          h('button', {
            class: 'hidden sm:flex p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-secondary)]',
            title: '退出',
            onclick: async () => {
              await api.logout().catch(() => undefined);
              window.location.reload();
            },
          }, iconLogout(20)),
        ),
      ),
      // 搜索（移动端）
      h('div', { class: 'md:hidden pb-3' },
        h('div', { class: 'relative' },
          h('span', { class: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]' }, iconSearch(16)),
          h('input', {
            type: 'search',
            placeholder: '搜索书名、作者...',
            value: state.filters.q ?? '',
            class: 'w-full pl-10 pr-4 py-2 rounded-xl bg-[var(--bg-page)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]',
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
  const sidebarRoot = h('aside', { class: 'w-60 shrink-0 border-r border-[var(--border-default)] p-5 overflow-y-auto hidden md:block' });
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

  const item = (label: string | HTMLElement, active: boolean, count: number | undefined, onclick: () => void, dotClass?: string) =>
    h('button', {
      class:
        'w-full flex items-center justify-between pl-3 pr-2 py-2.5 text-sm text-left transition-colors border-l-2 ' +
        (active
          ? 'border-[var(--accent)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-medium'
          : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'),
      onclick,
    },
      h('span', { class: 'flex items-center gap-2.5 truncate' },
        dotClass ? h('span', { class: `w-2 h-2 rounded-full ${dotClass}` }) : null,
        label,
      ),
      count != null ? h('span', { class: 'text-xs text-[var(--text-muted)] font-mono shrink-0' }, String(count)) : null,
    );

  const section = (title: string, children: HTMLElement[]) =>
    h('div', { class: 'mb-5' },
      h('h3', { class: 'text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 px-3' }, title),
      ...children,
    );

  const total = state.allBooks?.length ?? state.total ?? 0;

  return h('div', { class: 'space-y-6' },
    // 统计卡片
    h('div', { class: 'grid grid-cols-2 gap-3' },
      h('div', { class: 'bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-3 text-center' },
        h('div', { class: 'text-2xl font-bold text-[var(--text-primary)] font-mono' }, String(total)),
        h('div', { class: 'text-xs text-[var(--text-muted)] mt-0.5' }, '总藏书'),
      ),
      h('div', { class: 'bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-3 text-center' },
        h('div', { class: 'text-2xl font-bold text-[var(--accent)] font-mono' }, String(statusCounts.reading)),
        h('div', { class: 'text-xs text-[var(--text-muted)] mt-0.5' }, '在读'),
      ),
    ),
    // 状态筛选
    section('阅读状态', [
      item('全部书籍', !f.status && !f.categoryId && !f.tag, total, () => clickFilter({ status: undefined, categoryId: undefined, tag: undefined }), 'bg-[var(--text-muted)]'),
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
      item(h('span', { class: 'flex items-center gap-2.5' }, iconTrash(16), '回收站'), state.viewMode === 'trash', undefined, () => {
        setState({ viewMode: state.viewMode === 'trash' ? 'main' : 'trash' });
        void refresh();
      }),
    ]),
  );
}