// 书籍列表：表格 / 网格双视图 + 空态 + 加载态
import { api } from '../api';
import { setState, state } from '../state';
import type { Book } from '../types';
import { h, toast } from '../ui';
import { renderDrawer } from './detail-drawer';
import { openBookForm } from './book-form';
import { refresh } from '../refresh';

const STATUS_LABEL: Record<string, string> = { unread: '未读', reading: '在读', finished: '读完' };

function statusBadge(b: Book): HTMLElement {
  const colors: Record<string, string> = { unread: '#8a8274', reading: '#f59e0b', finished: '#10b981' };
  return h('span', {
    class: 'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
    style: `background:${colors[b.status]}1a;color:${colors[b.status]}`,
  }, STATUS_LABEL[b.status] ?? b.status);
}

function cover(b: Book): HTMLElement {
  if (b.cover_url) {
    return h('img', { src: b.cover_url, alt: b.title, class: 'w-full h-full object-cover', loading: 'lazy' });
  }
  return h('div', { class: 'w-full h-full flex items-center justify-center text-shelf-400 font-serif text-lg', html: b.title.slice(0, 1) });
}

// 快捷改状态
async function quickStatus(b: Book, status: string) {
  try {
    await api.updateBook(b.id, { status: status as Book['status'] });
    toast('状态已更新');
    await refresh();
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

export function renderBookList(container: HTMLElement) {
  container.replaceChildren();
  const main = h('div', { class: 'p-4 lg:p-6' });

  // 工具栏（搜索框在顶栏，避免输入时被重渲染打断）
  const sortSel = h('select', {
    class: 'px-3 py-2 rounded-xl border border-shelf-200 dark:border-shelf-700 dark:bg-shelf-900 dark:text-shelf-50 text-sm',
    onchange: () => {
      setState({ filters: { ...state.filters, sort: sortSel.value } });
      void refresh();
    },
  });
  for (const [v, label] of [['updated_desc', '最近更新'], ['updated_asc', '最早更新'], ['title_asc', '书名 ↑'], ['title_desc', '书名 ↓'], ['rating_desc', '评分 ↓']] as const) {
    sortSel.append(h('option', { value: v, selected: (state.filters.sort ?? 'updated_desc') === v ? '' : null }, label));
  }

  const viewToggle = h('div', { class: 'flex rounded-xl border border-shelf-200 dark:border-shelf-700 overflow-hidden' },
    h('button', { class: 'px-3 py-2 text-sm ' + (state.view === 'table' ? 'bg-amber-500 text-white' : 'text-shelf-600 dark:text-shelf-300'), onclick: () => setState({ view: 'table' }) }, '☰ 表格'),
    h('button', { class: 'px-3 py-2 text-sm ' + (state.view === 'grid' ? 'bg-amber-500 text-white' : 'text-shelf-600 dark:text-shelf-300'), onclick: () => setState({ view: 'grid' }) }, '▦ 网格'),
  );

  const addBtn = h('button', {
    class: 'px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium',
    onclick: () => openBookForm(),
  }, '+ 添加');

  main.append(
    h('div', { class: 'flex flex-wrap items-center gap-3 mb-4' }, sortSel, viewToggle, h('span', { class: 'ml-auto' }, addBtn)),
    h('p', { class: 'text-sm text-shelf-500 dark:text-shelf-400 mb-3' }, `共 ${state.total} 本`),
  );

  // 列表内容
  const list = h('div', { class: 'pb-24' });
  main.append(list);
  renderListContent(list);

  // 移动端 FAB
  main.append(h('button', {
    class: 'lg:hidden fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-2xl shadow-2xl',
    onclick: () => openBookForm(),
  }, '+'));
  container.append(main);
}

function renderListContent(list: HTMLElement) {
  list.replaceChildren();
  if (state.loading) {
    list.append(h('div', { class: 'text-center text-shelf-400 py-10' }, '加载中…'));
    return;
  }
  if (!state.books.length) {
    list.append(
      h('div', { class: 'text-center py-16' },
        h('p', { class: 'text-shelf-400 font-serif text-xl mb-2' }, '还没有书'),
        h('p', { class: 'text-shelf-500 text-sm mb-4' }, '点「+ 添加」录入第一本，或贴豆瓣链接'),
      ),
    );
    return;
  }
  if (state.view === 'table') list.append(renderTable());
  else list.append(renderGrid());
}

function renderTable(): HTMLElement {
  const wrap = h('div', { class: 'overflow-x-auto bg-white dark:bg-shelf-800 rounded-2xl shadow-sm' });
  const table = h('table', { class: 'w-full text-sm' });
  const thead = h('thead');
  thead.append(h('tr', { class: 'text-left text-shelf-500 dark:text-shelf-400 border-b dark:border-shelf-700' },
    h('th', { class: 'px-4 py-3 font-medium' }, '书名'),
    h('th', { class: 'px-4 py-3 font-medium' }, '作者'),
    h('th', { class: 'px-4 py-3 font-medium' }, '状态'),
    h('th', { class: 'px-4 py-3 font-medium' }, '分类'),
    h('th', { class: 'px-4 py-3 font-medium' }, '标签'),
    h('th', { class: 'px-4 py-3 font-medium' }, '评分'),
  ));
  const tbody = h('tbody');
  for (const b of state.books) {
    const row = h('tr', { class: 'border-b dark:border-shelf-700 hover:bg-shelf-50 dark:hover:bg-shelf-700/40 cursor-pointer', onclick: () => renderDrawer(b) });
    const statusSel = h('select', {
      class: 'text-xs rounded-lg border border-shelf-200 dark:border-shelf-700 dark:bg-shelf-900 dark:text-shelf-50 px-1.5 py-1',
      onclick: (e: Event) => e.stopPropagation(),
      onchange: () => quickStatus(b, statusSel.value),
    });
    for (const [v, label] of [['unread', '未读'], ['reading', '在读'], ['finished', '读完']] as const) {
      statusSel.append(h('option', { value: v, selected: b.status === v ? '' : null }, label));
    }
    row.append(
      h('td', { class: 'px-4 py-3 font-medium text-shelf-900 dark:text-shelf-50' }, b.title),
      h('td', { class: 'px-4 py-3 text-shelf-600 dark:text-shelf-300' }, b.author ?? ''),
      h('td', { class: 'px-4 py-3' }, statusSel),
      h('td', { class: 'px-4 py-3' }, b.category_name ? h('span', { style: `color:${b.category_color ?? '#8a8274'}` }, b.category_name) : ''),
      h('td', { class: 'px-4 py-3 text-shelf-500' }, b.tags.join(' · ')),
      h('td', { class: 'px-4 py-3 text-shelf-500' }, b.rating != null ? b.rating.toFixed(1) : ''),
    );
    tbody.append(row);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

function renderGrid(): HTMLElement {
  const grid = h('div', { class: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4' });
  for (const b of state.books) {
    const card = h('div', {
      class: 'bg-white dark:bg-shelf-800 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer overflow-hidden',
      onclick: () => renderDrawer(b),
    });
    card.append(
      h('div', { class: 'aspect-[3/4] bg-shelf-100 dark:bg-shelf-700' }, cover(b)),
      h('div', { class: 'p-3' },
        h('div', { class: 'flex items-start justify-between gap-2' },
          h('h3', { class: 'font-medium text-sm text-shelf-900 dark:text-shelf-50 line-clamp-2' }, b.title),
        ),
        h('p', { class: 'text-xs text-shelf-500 dark:text-shelf-400 mt-1 truncate' }, b.author ?? ''),
        h('div', { class: 'mt-2' }, statusBadge(b)),
      ),
    );
    grid.append(card);
  }
  return grid;
}