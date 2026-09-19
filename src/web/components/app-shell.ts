// 应用外壳：顶栏（搜索/主题/设置/退出）+ 侧栏（筛选）+ 主区（列表/回收站）
import { api } from '../api';
import { setState, state, subscribe } from '../state';
import { h, iconSun, iconMoon, iconSettings, iconLogout, iconSearch, iconKey, iconGithub, iconCloudflare, iconDouban, iconMenu } from '../ui';
import { refresh, refreshBooks } from '../refresh';
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
    id: 'search-desktop',
    placeholder: '搜索书名、作者、ISBN...',
    value: state.filters.q ?? '',
    class: 'w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-page)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]',
  });
  let timer: number | undefined;
  let mobileTimer: number | undefined;
  let searchMobile: HTMLInputElement; // 移动端搜索框（navbar 构建时赋值）
  search.addEventListener('input', () => {
    // 桌面/移动两个搜索框显示保持同步
    searchMobile.value = search.value;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      setState({ filters: { ...state.filters, q: search.value.trim() || undefined } });
      void refreshBooks();
    }, 300);
  });

  const navbar = h('header', {
    class: 'sticky top-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border-default)] text-[var(--text-primary)] transition-colors duration-300',
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
          h('span', { class: 'text-[11px] text-[var(--text-muted)] hidden sm:block leading-none mt-1' }, 'v1.3.0'),
        ),
        // 搜索（桌面端）
        h('div', { class: 'hidden md:flex flex-1 max-w-2xl mx-8' },
          h('div', { class: 'relative w-full' },
            h('span', { class: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]' }, iconSearch(16)),
            search,
          ),
        ),
        // 右侧：移动端菜单入口（桌面端侧栏常驻，占位对齐）
        h('div', { class: 'w-10 shrink-0 flex justify-end' },
          h('button', {
            class: 'md:hidden p-2 -mr-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors',
            'aria-label': '打开菜单',
            onclick: openMobileMenu,
          }, iconMenu(20)),
        ),
      ),
      // 搜索（移动端）
      h('div', { class: 'md:hidden pb-3' },
        h('div', { class: 'relative' },
          h('span', { class: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]' }, iconSearch(16)),
          searchMobile = h('input', {
            type: 'search',
            id: 'search-mobile',
            placeholder: '搜索书名、作者...',
            value: state.filters.q ?? '',
            class: 'w-full pl-10 pr-4 py-2 rounded-xl bg-[var(--bg-page)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]',
            oninput: (e: Event) => {
              const input = e.target as HTMLInputElement;
              search.value = input.value;
              const v = input.value.trim();
              window.clearTimeout(mobileTimer);
              mobileTimer = window.setTimeout(() => {
                setState({ filters: { ...state.filters, q: v || undefined } });
                void refreshBooks();
              }, 300);
            },
          }),
        ),
      ),
    ),
  );

  // ---------- 侧栏 / 主区 ----------
  // 侧栏固定一屏高度：sticky 跟随顶栏、self-start 不随列表内容拉伸，内部分类/标签区域独立滚动
  const sidebarRoot = h('aside', { class: 'w-72 shrink-0 border-r border-[var(--border-default)] p-5 overflow-y-auto hidden md:flex md:flex-col sticky top-16 self-start h-[calc(100vh-64px)]' });
  const viewRoot = h('main', { class: 'flex-1 min-w-0' });
  const toastRoot = h('div', { id: 'toast-root', class: 'fixed bottom-4 right-4 z-[60] space-y-2 pointer-events-none' });

  // ---------- 移动端抽屉菜单（承载侧栏内容：筛选/主题/设置/退出） ----------
  const mobileMenuRoot = h('div', { class: 'fixed inset-0 z-50 hidden' });
  const mobileBackdrop = h('div', { class: 'absolute inset-0 bg-[var(--overlay-bg)] opacity-0 transition-opacity duration-200' });
  const mobilePanel = h('aside', {
    class: 'absolute top-0 left-0 h-full w-72 max-w-[85vw] bg-[var(--bg-page)] border-r border-[var(--border-default)] shadow-2xl overflow-y-auto p-5 transform -translate-x-full transition-transform duration-300 ease-[var(--ease-out-expo)]',
  });
  mobileMenuRoot.append(mobileBackdrop, mobilePanel);
  function openMobileMenu() {
    mobilePanel.replaceChildren(renderSidebar());
    mobileMenuRoot.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      mobileBackdrop.classList.remove('opacity-0');
      mobilePanel.classList.remove('-translate-x-full');
    });
  }
  function closeMobileMenu() {
    mobileBackdrop.classList.add('opacity-0');
    mobilePanel.classList.add('-translate-x-full');
    document.body.style.overflow = '';
    setTimeout(() => mobileMenuRoot.classList.add('hidden'), 200);
  }
  mobileBackdrop.addEventListener('click', closeMobileMenu);

  const render = () => {
    sidebarRoot.replaceChildren(renderSidebar());
    // 移动端菜单展开中时同步刷新其内容（如切换主题后的图标状态）
    if (!mobileMenuRoot.classList.contains('hidden')) mobilePanel.replaceChildren(renderSidebar());
    viewRoot.replaceChildren();
    if (state.viewMode === 'trash') renderTrash(viewRoot);
    else renderBookList(viewRoot);
  };
  subscribe(render);

  root.append(
    navbar,
    h('div', { class: 'flex min-h-[calc(100vh-64px)]' }, sidebarRoot, viewRoot),
    mobileMenuRoot,
    toastRoot,
  );

  render();
  void refresh();
}

function renderSidebar(): HTMLElement {
  const f = state.filters;
  const clickFilter = (patch: Partial<typeof state.filters>) => {
    setState({ filters: { ...state.filters, ...patch }, viewMode: 'main' });
    void refreshBooks();
  };

  const statusCounts = { unread: 0, reading: 0, finished: 0 };
  for (const [k, v] of Object.entries(state.stats?.byStatus ?? {})) {
    if (k in statusCounts) {
      statusCounts[k as keyof typeof statusCounts] = v;
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
  // 分类保持列表行形式；标签改为紧凑按钮（chips），点击切换筛选
  const taxBody = (kind: 'category' | 'tag'): HTMLElement => {
    if (state.taxEdit === kind) {
      const box = h('div', { class: 'space-y-1 px-1.5' });
      renderTaxonomyManage(kind, box);
      return box;
    }
    if (kind === 'category') {
      const rows = state.categories.map((c) => item(c.name, f.categoryId === c.id, c.count, () => clickFilter({ categoryId: f.categoryId === c.id ? undefined : c.id })));
      return h('div', { class: 'space-y-0.5' }, ...rows);
    }
    const chips = state.tags.map((t) =>
      h('button', {
        class: 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ' +
          (f.tag === t.name
            ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-medium'
            : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]'),
        onclick: () => clickFilter({ tag: f.tag === t.name ? undefined : t.name }),
      },
        `#${t.name}`,
        t.count != null ? h('span', { class: 'text-[10px] font-mono opacity-60' }, String(t.count)) : null,
      ),
    );
    return h('div', { class: 'flex flex-wrap gap-1.5 px-1.5' }, ...chips);
  };

  const extLink = (href: string, title: string, icon: (s?: number) => HTMLElement) =>
    h('a', {
      class: 'flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-[var(--accent)]',
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      title,
    }, icon(15));

  const total = state.stats?.total ?? state.total ?? 0;

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
    // 分类区：占 2/3（flex-[2]），分类比标签多占侧栏区域；超出可滚动（此前 hidden 会裁剪掉多余分类）
    h('div', { class: 'shrink-0 flex-[2] min-h-0 overflow-y-auto pb-1' },
      section('分类', [taxBody('category')], taxBtn('category')),
    ),
    // 分隔线：区分分类区与标签区
    h('div', { class: 'mx-3 border-t border-[var(--border-subtle)] my-2 shrink-0' }),
    // 标签区：占 1/3（flex-1），独立滚动，不随上方分类区滚动
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