// 应用外壳：顶栏（搜索/主题/设置/退出）+ 侧栏（筛选）+ 主区（列表/回收站）
import { api } from '../api';
import { setState, state, subscribe } from '../state';
import { h, toast } from '../ui';
import { refresh, refreshSidebar } from '../refresh';
import { renderBookList } from './book-list';
import { renderTrash } from './trash-panel';
import { openSettings, toggleTheme } from './settings-panel';

const STATUS = [['unread', '未读'], ['reading', '在读'], ['finished', '读完']] as const;

export function mountAppShell(root: HTMLElement) {
  root.replaceChildren();
  root.className = '';

  // ---------- 顶栏（只建一次，搜索框不随状态重建） ----------
  const search = h('input', {
    type: 'search',
    placeholder: '搜书名 / 作者 / ISBN…',
    value: state.filters.q ?? '',
    class: 'w-full sm:w-72 px-3.5 py-2 rounded-xl border border-shelf-200 dark:border-shelf-700 dark:bg-shelf-900 dark:text-shelf-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500',
  });
  let timer: number | undefined;
  search.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      setState({ filters: { ...state.filters, q: search.value.trim() || undefined } });
      void refresh();
    }, 300);
  });

  const navBtn = (text: string, onclick: () => void) =>
    h('button', {
      class: 'px-3 py-2 rounded-xl text-sm text-shelf-600 dark:text-shelf-300 hover:bg-shelf-100 dark:hover:bg-shelf-700',
      onclick,
    }, text);

  const navbar = h('header', {
    class: 'sticky top-0 z-30 bg-white/85 dark:bg-shelf-900/85 backdrop-blur border-b border-shelf-100 dark:border-shelf-800',
  },
    h('div', { class: 'flex items-center gap-3 px-4 lg:px-6 py-3' },
      h('h1', { class: 'font-serif text-lg text-shelf-900 dark:text-shelf-50 shrink-0' }, 'Bookshelf'),
      h('div', { class: 'flex-1 max-w-md' }, search),
      navBtn(state.theme === 'dark' ? '☀️' : '🌙', toggleTheme),
      navBtn('⚙️ 设置', openSettings),
      navBtn('退出', async () => {
        await api.logout().catch(() => undefined);
        window.location.reload();
      }),
    ),
  );

  // ---------- 侧栏 / 主区（随状态重建） ----------
  const sidebarRoot = h('aside', { class: 'w-52 shrink-0 border-r border-shelf-100 dark:border-shelf-800 p-3 overflow-y-auto hidden md:block' });
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
    h('div', { class: 'flex min-h-[calc(100vh-57px)]' }, sidebarRoot, viewRoot),
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

  const item = (label: string, active: boolean, count: number | undefined, onclick: () => void) =>
    h('button', {
      class:
        'w-full text-left px-3 py-1.5 rounded-lg text-sm flex items-center justify-between gap-2 ' +
        (active
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium'
          : 'text-shelf-600 dark:text-shelf-300 hover:bg-shelf-100 dark:hover:bg-shelf-700'),
      onclick,
    }, h('span', { class: 'truncate' }, label), count != null ? h('span', { class: 'text-xs text-shelf-400 shrink-0' }, String(count)) : null);

  const section = (title: string, children: HTMLElement[]) =>
    h('div', { class: 'mb-3' },
      h('p', { class: 'px-3 text-xs text-shelf-400 dark:text-shelf-500 mb-1' }, title),
      ...children,
    );

  return h('div', {},
    item('全部书籍', !f.status && !f.categoryId && !f.tag, undefined, () => clickFilter({ status: undefined, categoryId: undefined, tag: undefined })),
    section('状态', STATUS.map(([v, label]) => item(label, f.status === v, undefined, () => clickFilter({ status: f.status === v ? undefined : v })))),
    section('分类', state.categories.map((c) => item(c.name, f.categoryId === c.id, c.count, () => clickFilter({ categoryId: f.categoryId === c.id ? undefined : c.id })))),
    section('标签', state.tags.map((t) => item(`#${t.name}`, f.tag === t.name, t.count, () => clickFilter({ tag: f.tag === t.name ? undefined : t.name })))),
    section('管理', [
      item('🗑 回收站', state.viewMode === 'trash', undefined, () => {
        setState({ viewMode: state.viewMode === 'trash' ? 'main' : 'trash' });
        void refresh();
      }),
    ]),
  );
}