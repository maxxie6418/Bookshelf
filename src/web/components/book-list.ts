// 书籍列表：表格 / 网格双视图 + 空态 + 加载态
import { api } from '../api';
import { setState, state } from '../state';
import type { Book } from '../types';
import { h, toast, getCoverPattern, renderStars } from '../ui';
import { renderDrawer } from './detail-drawer';
import { openBookForm } from './book-form';
import { refresh } from '../refresh';

const STATUS_LABEL: Record<string, string> = { unread: '未读', reading: '在读', finished: '读完' };

const STATUS_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  unread:   { label: '未读',   dot: 'bg-shelf-400',           bg: 'bg-shelf-100 dark:bg-shelf-700',           text: 'text-shelf-600 dark:text-shelf-400' },
  reading:  { label: '在读',   dot: 'bg-emerald-500 status-reading-dot', bg: 'bg-emerald-100 dark:bg-emerald-900/30',  text: 'text-emerald-700 dark:text-emerald-400' },
  finished: { label: '已读完', dot: 'bg-amber-500',           bg: 'bg-amber-100 dark:bg-amber-900/30',          text: 'text-amber-700 dark:text-amber-400' },
};

function coverEl(b: Book): HTMLElement {
  if (b.cover_url) {
    return h('img', { src: b.cover_url, alt: b.title, class: 'w-full h-full object-cover', loading: 'lazy' });
  }
  const pattern = getCoverPattern(b.title);
  return h('div', { class: `cover-pattern-${pattern} w-full h-full flex items-center justify-center` },
    h('span', { class: 'text-white/90 font-serif text-lg font-bold text-center px-4 leading-relaxed drop-shadow-lg line-clamp-2' }, b.title),
  );
}

function statusBadge(b: Book): HTMLElement {
  const meta = STATUS_META[b.status] ?? STATUS_META.unread;
  return h('span', {
    class: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.bg} ${meta.text}`,
  },
    h('span', { class: `w-1 h-1 rounded-full ${meta.dot}` }),
    STATUS_LABEL[b.status] ?? b.status,
  );
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
  const main = h('div', { class: 'p-4 sm:p-6 lg:p-8' });

  // 顶栏工具栏
  const sortSel = h('select', {
    class: 'text-sm bg-white dark:bg-shelf-800 border border-shelf-200 dark:border-shelf-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500/50 outline-none',
    onchange: () => {
      setState({ filters: { ...state.filters, sort: sortSel.value } });
      void refresh();
    },
  });
  for (const [v, label] of [['updated_desc', '最近更新'], ['updated_asc', '最早更新'], ['title_asc', '书名 ↑'], ['title_desc', '书名 ↓'], ['rating_desc', '评分 ↓']] as const) {
    sortSel.append(h('option', { value: v, selected: (state.filters.sort ?? 'updated_desc') === v ? '' : null }, label));
  }

  const viewToggle = h('div', { class: 'hidden sm:flex items-center bg-shelf-100 dark:bg-shelf-700 rounded-lg p-1' },
    h('button', {
      class: 'p-1.5 rounded-md transition-all ' + (state.view === 'table'
        ? 'bg-white dark:bg-shelf-600 shadow-sm'
        : 'hover:bg-white/50 dark:hover:bg-shelf-600/50'),
      title: '表格视图',
      onclick: () => setState({ view: 'table' }),
    },
      h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' }),
      ),
    ),
    h('button', {
      class: 'p-1.5 rounded-md transition-all ' + (state.view === 'grid'
        ? 'bg-white dark:bg-shelf-600 shadow-sm'
        : 'hover:bg-white/50 dark:hover:bg-shelf-600/50'),
      title: '网格视图',
      onclick: () => setState({ view: 'grid' }),
    },
      h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' }),
      ),
    ),
  );

  const addBtn = h('button', {
    class: 'hidden sm:flex items-center gap-2 px-4 py-2 bg-shelf-800 dark:bg-amber-500 text-white dark:text-shelf-900 rounded-lg hover:bg-shelf-700 dark:hover:bg-amber-400 transition-all font-medium text-sm shadow-lg shadow-shelf-800/20',
    onclick: () => openBookForm(),
  },
    h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 4v16m8-8H4' }),
    ),
    '添加书籍',
  );

  // 当前视图标题
  const viewTitle = getViewTitle();

  main.append(
    // 列表头栏
    h('div', { class: 'sticky top-16 z-30 bg-shelf-50/80 dark:bg-shelf-900/80 backdrop-blur-lg border-b border-shelf-200 dark:border-shelf-700 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-4' },
      h('div', { class: 'flex items-center justify-between' },
        h('div', { class: 'flex items-center gap-3' },
          h('h2', { class: 'text-lg font-semibold font-serif' }, viewTitle),
          h('span', { class: 'text-sm text-shelf-400' }, `${state.total} 本`),
        ),
        h('div', { class: 'flex items-center gap-2' },
          h('span', { class: 'text-xs text-shelf-400 hidden sm:inline' }, '排序：'),
          sortSel,
          viewToggle,
          addBtn,
        ),
      ),
    ),
  );

  // 列表内容
  const list = h('div', { class: 'pb-24' });
  main.append(list);
  renderListContent(list);

  // 移动端 FAB
  main.append(h('button', {
    class: 'fab sm:hidden fixed bottom-6 right-6 z-30 w-14 h-14 bg-shelf-800 dark:bg-amber-500 text-white dark:text-shelf-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform',
    onclick: () => openBookForm(),
  },
    h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 4v16m8-8H4' }),
    ),
  ));
  container.append(main);
}

function getViewTitle(): string {
  const f = state.filters;
  if (state.viewMode === 'trash') return '回收站';
  if (f.tag) return `#${f.tag}`;
  if (f.categoryId) {
    const cat = state.categories.find(c => c.id === f.categoryId);
    if (cat) return cat.name;
  }
  if (f.status) {
    const map: Record<string, string> = { unread: '未读书籍', reading: '正在阅读', finished: '已读完' };
    return map[f.status] ?? '全部书籍';
  }
  return '全部书籍';
}

function renderListContent(list: HTMLElement) {
  list.replaceChildren();
  if (state.loading) {
    list.append(h('div', { class: 'text-center text-shelf-400 py-10' }, '加载中…'));
    return;
  }
  if (!state.books.length) {
    list.append(
      h('div', { class: 'col-span-full flex flex-col items-center justify-center py-20 text-shelf-400' },
        h('svg', { class: 'w-16 h-16 mb-4 opacity-30', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
          h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.5', d: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }),
        ),
        h('p', { class: 'text-sm' }, '没有找到符合条件的书籍'),
      ),
    );
    return;
  }
  if (state.view === 'table') list.append(renderTable());
  else list.append(renderGrid());
}

function renderTable(): HTMLElement {
  const wrap = h('div', { class: 'bg-white dark:bg-shelf-800 rounded-xl border border-shelf-200 dark:border-shelf-700 overflow-hidden shadow-sm' });
  const inner = h('div', { class: 'overflow-x-auto' });
  const table = h('table', { class: 'w-full text-sm' });
  const thead = h('thead');
  thead.append(h('tr', { class: 'border-b border-shelf-200 dark:border-shelf-700 text-left text-xs text-shelf-500 dark:text-shelf-400 uppercase tracking-wider' },
    h('th', { class: 'px-4 py-3 font-medium' }, '封面'),
    h('th', { class: 'px-4 py-3 font-medium' }, '书名'),
    h('th', { class: 'px-4 py-3 font-medium' }, '作者'),
    h('th', { class: 'px-4 py-3 font-medium' }, '状态'),
    h('th', { class: 'px-4 py-3 font-medium' }, '分类'),
    h('th', { class: 'px-4 py-3 font-medium' }, '评分'),
    h('th', { class: 'px-4 py-3 font-medium text-right' }, '操作'),
  ));
  const tbody = h('tbody', { class: 'divide-y divide-shelf-100 dark:divide-shelf-700/50' });
  for (const b of state.books) {
    const meta = STATUS_META[b.status] ?? STATUS_META.unread;
    const row = h('tr', { class: 'table-row cursor-pointer', onclick: () => renderDrawer(b) });
    const coverCell = h('td', { class: 'px-4 py-3' },
      h('div', { class: 'w-10 h-14 rounded-md overflow-hidden shadow-sm' },
        b.cover_url
          ? h('img', { src: b.cover_url, class: 'w-full h-full object-cover' })
          : h('div', { class: `cover-pattern-${getCoverPattern(b.title)} w-full h-full flex items-center justify-center` },
              h('span', { class: 'text-white/80 text-[8px] font-bold text-center px-1 leading-tight' }, b.title.slice(0, 2)),
            ),
      ),
    );
    row.append(
      coverCell,
      h('td', { class: 'px-4 py-3' },
        h('div', { class: 'font-medium text-sm text-shelf-900 dark:text-shelf-50' }, b.title),
        b.original_title ? h('div', { class: 'text-xs text-shelf-400 mt-0.5' }, b.original_title) : null,
      ),
      h('td', { class: 'px-4 py-3 text-sm text-shelf-600 dark:text-shelf-300' }, b.author ?? ''),
      h('td', { class: 'px-4 py-3' },
        h('span', { class: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.bg} ${meta.text}` },
          h('span', { class: `w-1.5 h-1.5 rounded-full ${meta.dot}` }),
          STATUS_LABEL[b.status] ?? b.status,
        ),
      ),
      h('td', { class: 'px-4 py-3' },
        b.category_name
          ? h('span', { class: 'inline-flex items-center gap-1.5 text-xs' },
              h('span', { class: 'w-2 h-2 rounded-sm', style: `background:${b.category_color ?? '#8a8274'}` }),
              b.category_name,
            )
          : '',
      ),
      h('td', { class: 'px-4 py-3' }, renderStars(b.rating)),
      h('td', { class: 'px-4 py-3 text-right' },
        h('button', {
          class: 'p-1.5 rounded-lg hover:bg-shelf-100 dark:hover:bg-shelf-700 transition-colors text-shelf-400 hover:text-shelf-600',
          onclick: (e: Event) => { e.stopPropagation(); openBookForm(b); },
        },
          h('svg', { class: 'w-4 h-4', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
            h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' }),
          ),
        ),
      ),
    );
    tbody.append(row);
  }
  table.append(thead, tbody);
  inner.append(table);
  wrap.append(inner);
  return wrap;
}

function renderGrid(): HTMLElement {
  const grid = h('div', { class: 'view-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5 lg:gap-6' });
  for (const b of state.books) {
    const card = h('div', {
      class: 'book-card group cursor-pointer bg-white dark:bg-shelf-800 rounded-2xl shadow-sm hover:shadow-xl overflow-hidden',
      onclick: () => renderDrawer(b),
    });
    card.append(
      h('div', { class: 'relative aspect-[3/4] overflow-hidden shadow-md group-hover:shadow-xl transition-shadow mb-3' },
        coverEl(b),
        b.status === 'reading'
          ? h('div', { class: 'absolute top-2 right-2 w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50 status-reading-dot border-2 border-white dark:border-shelf-800' })
          : null,
        h('div', { class: 'absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors' }),
      ),
      h('div', { class: 'px-1 pb-1 space-y-1.5' },
        h('h3', { class: 'font-semibold text-sm leading-tight line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors' }, b.title),
        h('p', { class: 'text-xs text-shelf-500 dark:text-shelf-400 line-clamp-1' }, b.author ?? ''),
        h('div', { class: 'flex items-center gap-2 pt-0.5' },
          statusBadge(b),
          b.rating ? renderStars(b.rating) : null,
        ),
      ),
    );
    grid.append(card);
  }
  return grid;
}