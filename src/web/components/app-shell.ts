// 应用外壳：顶栏（搜索/主题/设置/退出）+ 侧栏（筛选）+ 主区（列表/回收站）
import { api } from '../api';
import { setState, state, subscribe } from '../state';
import { h, iconSun, iconMoon, iconSettings, iconLogout, iconSearch, iconKey, iconGithub, iconCloudflare, iconDouban } from '../ui';
import { refresh, refreshSidebar } from '../refresh';
import { renderBookList } from './book-list';
import { renderTrash } from './trash-panel';
import { openSettings, openAgentSettings, toggleTheme } from './settings-panel';
import { renderTaxonomyManage } from './manage-taxonomy';

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
    h('div', { class: 'px-4 sm:px-6 lg:px-8' },
      h('div', { class: 'flex items-center justify-between h-16' },
        // Logo
        h('div', { class: 'flex items-center gap-2.5 shrink-0' },
          h('div', { class: 'w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg' },
            h('svg', { class: 'w-4 h-4 text-white', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
              h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }),
            ),
          ),
          h('span', { class: 'text-lg font-bold tracking-tight font-display hidden sm:block' }, '我的书架'),
          h('span', { class: 'text-[11px] text-[var(--text-muted)] hidden sm:block leading-none mt-1' }, 'v0.0.1'),
        ),
        // 搜索（桌面端）
        h('div', { class: 'hidden md:flex flex-1 max-w-2xl mx-8' },
          h('div', { class: 'relative w-full' },
            h('span', { class: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]' }, iconSearch(16)),
            search,
          ),
        ),
        // 右侧留空（操作按钮已移至侧栏底部）
        h('div', { class: 'w-10 shrink-0' }),
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
  const sidebarRoot = h('aside', { class: 'w-60 shrink-0 border-r border-[var(--border-default)] p-5 overflow-y-auto hidden md:flex md:flex-col' });
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
    h('div', { class: 'flex min-h-[calc(100vh-64px)]' }, sidebarRoot, viewRoot),
    toastRoot,
  );

  render();
  void refresh();
  void refreshSidebar();
}

function renderSidebar(): HTMLElement {
  const f = state.filters;
  const clickFilter = (patch: Partial<typeof state.filters>) => {
    setState({ filters: { ...state.filters, ...patch }, viewMode: 'main' });
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

  const section = (title: string, children: HTMLElement[], extra?: HTMLElement) =>
    h('div', { class: 'mb-5' },
      h('div', { class: 'flex items-center justify-between px-3 mb-1.5' },
        h('h3', { class: 'text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider' }, title),
        extra ?? null,
      ),
      ...children,
    );

  // 分类/标签：管理按钮（进入/退出内联编辑态，不弹窗）
  const taxBtn = (kind: 'category' | 'tag') => {
    const editing = state.taxEdit === kind;
    return h('button', {
      class: 'text-[11px] transition-colors ' + (editing
        ? 'text-[var(--accent)] font-medium'
        : 'text-[var(--text-muted)] hover:text-[var(--accent)]'),
      onclick: () => setState({ taxEdit: editing ? null : kind }),
    }, editing ? '完成' : '管理');
  };

  // 分类/标签内容：编辑态就地显示内联管理列表，否则显示筛选列表
  const taxBody = (kind: 'category' | 'tag'): HTMLElement => {
    if (state.taxEdit === kind) {
      const box = h('div', { class: 'space-y-0.5 px-3' });
      renderTaxonomyManage(kind, box);
      return box;
    }
    const rows = kind === 'category'
      ? state.categories.map((c) => item(c.name, f.categoryId === c.id, c.count, () => clickFilter({ categoryId: f.categoryId === c.id ? undefined : c.id })))
      : state.tags.map((t) => item(`#${t.name}`, f.tag === t.name, t.count, () => clickFilter({ tag: f.tag === t.name ? undefined : t.name })));
    return h('div', { class: 'space-y-0.5' }, ...rows);
  };

  const extLink = (href: string, title: string, icon: (s?: number) => HTMLElement) =>
    h('a', {
      class: 'flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-[var(--accent)]',
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      title,
    }, icon(15));

  const total = state.allBooks?.length ?? state.total ?? 0;

  return h('div', { class: 'flex-1 flex flex-col min-h-0' },
    // 统计卡片（顶部固定）
    h('div', { class: 'shrink-0 grid grid-cols-2 gap-3 pb-4' },
      h('div', { class: 'bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-3 text-center' },
        h('div', { class: 'text-2xl font-bold text-[var(--text-primary)] font-mono' }, String(total)),
        h('div', { class: 'text-xs text-[var(--text-muted)] mt-0.5' }, '总藏书'),
      ),
      h('div', { class: 'bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-3 text-center' },
        h('div', { class: 'text-2xl font-bold text-[var(--accent)] font-mono' }, String(statusCounts.reading)),
        h('div', { class: 'text-xs text-[var(--text-muted)] mt-0.5' }, '在读'),
      ),
    ),
    // 分类区：占上半部（50% 高），独立滚动，保证标签区从侧栏中部开始
    h('div', { class: 'shrink-0 h-[50%] min-h-0 overflow-y-auto' },
      section('分类', [taxBody('category')], taxBtn('category')),
    ),
    // 分隔线：区分分类区与标签区
    h('div', { class: 'mx-3 border-t border-[var(--border-subtle)] my-2 shrink-0' }),
    // 标签区：从中部延伸至底部快捷图标前，独立滚动，不随上方分类区滚动
    h('div', { class: 'flex-1 min-h-0 overflow-y-auto' },
      section('标签', [taxBody('tag')], taxBtn('tag')),
    ),
    // 底部：书签链接（盒式卡片）+ 设置/退出（平铺，贴底）
    h('div', { class: 'pt-3 shrink-0' },
      // 书签：盒式卡片样式（与设置按钮组样式互换了位置）
      h('div', { class: 'pt-2 pb-3 border-t border-[var(--border-subtle)]' },
        h('div', { class: 'flex items-center justify-center gap-1 p-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-paper w-fit mx-auto' },
          extLink('https://github.com/maxxie6418/Bookshelf', '项目 GitHub', iconGithub),
          extLink('https://dash.cloudflare.com', 'Cloudflare', iconCloudflare),
          extLink('https://book.douban.com/', '豆瓣读书', iconDouban),
        ),
      ),
      // 设置/退出：平铺样式（与书签链接样式互换了位置）
      h('div', { class: 'pt-3 border-t border-[var(--border-subtle)]' },
        h('div', { class: 'flex items-center justify-around' },
          h('button', {
            class: 'p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-[var(--accent)]',
            title: '切换主题',
            onclick: toggleTheme,
          }, state.theme === 'dark' ? iconSun(18) : iconMoon(18)),
          h('button', {
            class: 'p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-[var(--accent)]',
            title: 'Agent 设置',
            onclick: openAgentSettings,
          }, iconKey(18)),
          h('button', {
            class: 'p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-[var(--accent)]',
            title: '设置',
            onclick: openSettings,
          }, iconSettings(18)),
          h('button', {
            class: 'p-2 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-red-500',
            title: '退出',
            onclick: async () => {
              await api.logout().catch(() => undefined);
              window.location.reload();
            },
          }, iconLogout(18)),
        ),
      ),
    ),
  );
}
