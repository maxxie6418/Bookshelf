// 书籍列表：表格 / 网格双视图 + 空态 + 加载态
import { api } from '../api';
import { setState, state } from '../state';
import type { Book } from '../types';
import { h, toast, renderCoverPlaceholder, renderStars, iconList, iconGrid, iconEdit, iconPlus, iconBookOpen } from '../ui';
import { renderDrawer } from './detail-drawer';
import { openBookForm } from './book-form';
import { refresh } from '../refresh';

const STATUS_LABEL: Record<string, string> = { unread: '未读', reading: '在读', finished: '读完' };

const STATUS_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  unread:   { label: '未读',   dot: 'bg-[var(--text-muted)]',                       bg: 'bg-[var(--bg-surface-hover)]',              text: 'text-[var(--text-secondary)]' },
  reading:  { label: '在读',   dot: 'bg-[var(--accent)] status-reading-dot',       bg: 'bg-[var(--accent)]/10',                     text: 'text-[var(--accent)]' },
  finished: { label: '已读完', dot: 'bg-[var(--accent)]',                            bg: 'bg-[var(--bg-surface-hover)]',              text: 'text-[var(--text-secondary)]' },
};

function coverEl(b: Book, size: 'grid' | 'table' = 'grid'): HTMLElement {
  if (b.cover_url) {
    return h('img', { src: b.cover_url, alt: b.title, class: 'w-full h-full object-cover', loading: 'lazy' });
  }
  return renderCoverPlaceholder(b, size);
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
    class: 'text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)]/50 outline-none',
    onchange: () => {
      setState({ filters: { ...state.filters, sort: sortSel.value } });
      void refresh();
    },
  });
  for (const [v, label] of [['updated_desc', '最近更新'], ['updated_asc', '最早更新'], ['title_asc', '书名 ↑'], ['title_desc', '书名 ↓'], ['rating_desc', '评分 ↓']] as const) {
    sortSel.append(h('option', { value: v, selected: (state.filters.sort ?? 'updated_desc') === v ? '' : null }, label));
  }

  const viewToggle = h('div', { class: 'hidden sm:flex items-center bg-[var(--bg-page)] rounded-lg p-1' },
    h('button', {
      class: 'p-1.5 rounded-md transition-all text-[var(--text-secondary)] ' + (state.view === 'table'
        ? 'bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-sm'
        : 'hover:bg-[var(--bg-surface-hover)]'),
      title: '表格视图',
      onclick: () => setState({ view: 'table' }),
    }, iconList(18)),
    h('button', {
      class: 'p-1.5 rounded-md transition-all text-[var(--text-secondary)] ' + (state.view === 'grid'
        ? 'bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-sm'
        : 'hover:bg-[var(--bg-surface-hover)]'),
      title: '网格视图',
      onclick: () => setState({ view: 'grid' }),
    }, iconGrid(18)),
  );

  const addBtn = h('button', {
    class: 'hidden sm:flex items-center gap-2 px-4 py-2 border border-[var(--accent)] text-[var(--accent)] rounded-lg hover:bg-[var(--accent)]/10 transition-all font-medium text-sm',
    onclick: () => openBookForm(),
  }, iconPlus(18), '添加书籍');

  // 当前视图标题
  const viewTitle = getViewTitle();
  const statusButtons: { value: 'all' | 'unread' | 'reading' | 'finished'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'unread', label: '未读' },
    { value: 'reading', label: '在读' },
    { value: 'finished', label: '读完' },
  ];
  const statusGroup = h('div', { class: 'hidden md:flex items-center gap-1 bg-[var(--bg-page)] rounded-lg p-0.5 border border-[var(--border-default)]' });
  for (const s of statusButtons) {
    const active = (state.filters.status ?? 'all') === s.value;
    statusGroup.append(h('button', {
      class: 'px-3 py-1 rounded-md text-sm font-medium transition-all ' +
        (active
          ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-sm'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'),
      onclick: () => {
        const v = s.value === 'all' ? undefined : s.value;
        setState({ filters: { ...state.filters, status: v as typeof state.filters.status } });
        void refresh();
      },
    }, s.label));
  }

  main.append(
    // 列表头栏
    h('div', { class: 'sticky top-16 z-30 bg-[var(--bg-page)]/80 backdrop-blur-lg border-b border-[var(--border-default)] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-4' },
      h('div', { class: 'flex items-center justify-between gap-3 flex-wrap' },
        h('div', { class: 'flex items-center gap-3 min-w-0' },
          h('h2', { class: 'text-lg font-semibold font-display text-[var(--text-primary)] whitespace-nowrap' }, viewTitle),
          h('span', { class: 'text-sm text-[var(--text-muted)] whitespace-nowrap' }, `${state.total} 本`),
          statusGroup,
        ),
        h('div', { class: 'flex items-center gap-2' },
          h('span', { class: 'text-xs text-[var(--text-muted)] hidden sm:inline' }, '排序：'),
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
    class: 'fab sm:hidden fixed bottom-6 right-6 z-30 w-14 h-14 bg-[var(--accent)] text-[var(--accent-text)] rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform',
    onclick: () => openBookForm(),
  }, iconPlus(28)));
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

function hasActiveFilters(): boolean {
  const f = state.filters;
  return !!(f.status || f.categoryId || f.tag || f.q);
}

function clearFilters() {
  setState({ filters: { sort: state.filters.sort } });
  void refresh();
}

function renderSkeletonGrid(): HTMLElement {
  const grid = h('div', { class: 'view-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3 sm:gap-4 lg:gap-5' });
  for (let i = 0; i < 12; i++) {
    grid.append(
      h('div', { class: 'flex flex-col gap-3' },
        h('div', { class: 'w-full aspect-[3/4] rounded-lg skeleton' }),
        h('div', { class: 'space-y-2' },
          h('div', { class: 'h-3 w-3/4 rounded skeleton' }),
          h('div', { class: 'h-2.5 w-1/2 rounded skeleton' }),
          h('div', { class: 'h-2.5 w-1/3 rounded skeleton' }),
        ),
      ),
    );
  }
  return grid;
}

function renderSkeletonTable(): HTMLElement {
  const wrap = h('div', { class: 'bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden shadow-paper' });
  const inner = h('div', { class: 'overflow-x-auto' });
  const table = h('table', { class: 'w-full text-sm' });
  const tbody = h('tbody');
  for (let i = 0; i < 5; i++) {
    const row = h('tr', { class: 'border-b border-[var(--border-subtle)] last:border-0' },
      h('td', { class: 'px-4 py-4' }, h('div', { class: 'w-10 h-14 rounded-md skeleton' })),
      h('td', { class: 'px-4 py-4' },
        h('div', { class: 'space-y-2' },
          h('div', { class: 'h-3 w-32 rounded skeleton' }),
          h('div', { class: 'h-2.5 w-24 rounded skeleton' }),
        ),
      ),
      h('td', { class: 'px-4 py-4' }, h('div', { class: 'h-3 w-20 rounded skeleton' })),
      h('td', { class: 'px-4 py-4' }, h('div', { class: 'h-3 w-16 rounded skeleton' })),
      h('td', { class: 'px-4 py-4' }, h('div', { class: 'h-3 w-16 rounded skeleton' })),
      h('td', { class: 'px-4 py-4' }, h('div', { class: 'h-3 w-20 rounded skeleton' })),
      h('td', { class: 'px-4 py-4 text-right' }, h('div', { class: 'inline-block h-3 w-8 rounded skeleton' })),
    );
    tbody.append(row);
  }
  table.append(tbody);
  inner.append(table);
  wrap.append(inner);
  return wrap;
}

function renderEmptyState(): HTMLElement {
  const active = hasActiveFilters();
  const isTrash = state.viewMode === 'trash';
  const title = isTrash ? '回收站是空的' : active ? '没有找到符合条件的书籍' : '书架还是空的';
  const subtitle = isTrash
    ? ''
    : active
      ? '尝试调整筛选条件，或清除当前筛选'
      : '把你喜爱的书籍添加进来，开始搭建私人图书馆';
  const actions = h('div', { class: 'flex flex-wrap items-center justify-center gap-3 mt-5' });

  if (!isTrash) {
    actions.append(
      h('button', {
        class: 'inline-flex items-center gap-2 px-4 py-2 border border-[var(--accent)] text-[var(--accent)] rounded-lg hover:bg-[var(--accent)]/10 transition-all font-medium text-sm',
        onclick: () => openBookForm(),
      }, iconPlus(18), active ? '添加书籍' : '添加第一本书'),
    );
    if (active) {
      actions.append(
        h('button', {
          class: 'px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors',
          onclick: () => clearFilters(),
        }, '清除筛选'),
      );
    }
  }

  return h('div', { class: 'flex flex-col items-center justify-center py-20 text-center' },
    h('div', { class: 'mb-5 text-[var(--text-muted)]' }, iconBookOpen(64)),
    h('h3', { class: 'text-base font-semibold font-display text-[var(--text-primary)] mb-1' }, title),
    subtitle ? h('p', { class: 'text-sm text-[var(--text-secondary)] max-w-xs' }, subtitle) : null,
    actions,
  );
}

function renderListContent(list: HTMLElement) {
  list.replaceChildren();
  if (state.loading) {
    list.append(state.view === 'table' ? renderSkeletonTable() : renderSkeletonGrid());
    return;
  }
  if (!state.books.length) {
    list.append(renderEmptyState());
    return;
  }
  if (state.view === 'table') list.append(renderTable());
  else list.append(renderGrid());
}

function renderTable(): HTMLElement {
  const wrap = h('div', { class: 'bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden shadow-paper' });
  const inner = h('div', { class: 'overflow-x-auto' });
  const table = h('table', { class: 'w-full text-sm' });
  const thead = h('thead');
  thead.append(h('tr', { class: 'border-b border-[var(--border-default)] text-left text-xs text-[var(--text-muted)] uppercase tracking-wider' },
    h('th', { class: 'px-4 py-3 font-medium' }, '封面'),
    h('th', { class: 'px-4 py-3 font-medium' }, '书名'),
    h('th', { class: 'px-4 py-3 font-medium' }, '作者'),
    h('th', { class: 'px-4 py-3 font-medium' }, '状态'),
    h('th', { class: 'px-4 py-3 font-medium' }, '分类'),
    h('th', { class: 'px-4 py-3 font-medium' }, '评分'),
    h('th', { class: 'px-4 py-3 font-medium text-right' }, '操作'),
  ));
  const tbody = h('tbody');
  const books = state.books;
  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    const meta = STATUS_META[b.status] ?? STATUS_META.unread;
    const isLast = i === books.length - 1;
    const row = h('tr', { class: 'table-row cursor-pointer', onclick: () => renderDrawer(b) });
    const coverCell = h('td', { class: 'px-4 py-4' },
      h('div', { class: 'w-10 h-14 rounded-md overflow-hidden shadow-sm' }, coverEl(b, 'table')),
    );
    row.append(
      coverCell,
      h('td', { class: 'px-4 py-4' },
        h('div', { class: 'font-medium text-sm font-display text-[var(--text-primary)]' }, b.title),
        b.original_title ? h('div', { class: 'text-xs text-[var(--text-muted)] mt-0.5' }, b.original_title) : null,
      ),
      h('td', { class: 'px-4 py-4 text-sm text-[var(--text-secondary)]' }, b.author ?? ''),
      h('td', { class: 'px-4 py-4' },
        h('span', { class: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.bg} ${meta.text}` },
          h('span', { class: `w-1.5 h-1.5 rounded-full ${meta.dot}` }),
          STATUS_LABEL[b.status] ?? b.status,
        ),
      ),
      h('td', { class: 'px-4 py-4' },
        b.category_name
          ? h('span', { class: 'inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]' },
              h('span', { class: 'w-2 h-2 rounded-sm', style: `background:${b.category_color ?? '#8a8274'}` }),
              b.category_name,
            )
          : '',
      ),
      h('td', { class: 'px-4 py-4' }, renderStars(b.rating)),
      h('td', { class: 'px-4 py-4 text-right' },
        h('button', {
          class: 'p-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
          onclick: (e: Event) => { e.stopPropagation(); openBookForm(b); },
        }, iconEdit(18)),
      ),
    );
    if (!isLast) {
      row.classList.add('border-b', 'border-[var(--border-subtle)]');
    }
    tbody.append(row);
  }
  table.append(thead, tbody);
  inner.append(table);
  wrap.append(inner);
  return wrap;
}

function renderGrid(): HTMLElement {
  const grid = h('div', { class: 'view-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3 sm:gap-4 lg:gap-5' });
  for (const b of state.books) {
    const card = h('div', {
      class: "book-card group cursor-pointer relative bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-paper hover:shadow-float hover:-translate-y-0.5 transition-all duration-300 after:content-[''] after:absolute after:left-[12.5%] after:right-[12.5%] after:-bottom-2 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[var(--border-default)] after:to-transparent",
      onclick: () => renderDrawer(b),
    });
    card.append(
      h('div', { class: 'relative aspect-[3/4] overflow-hidden rounded-t-xl shadow-md group-hover:shadow-xl transition-shadow' },
        coverEl(b),
        b.status === 'reading'
          ? h('div', { class: 'absolute top-2 right-2 w-3 h-3 rounded-full bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/50 status-reading-dot border-2 border-[var(--bg-surface)]' })
          : null,
        h('div', { class: 'absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors' }),
      ),
      h('div', { class: 'px-1.5 pb-1.5 pt-2 space-y-1' },
        h('h3', { class: 'font-display font-semibold text-[13px] leading-tight line-clamp-1 text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors' }, b.title),
        h('p', { class: 'text-[11px] text-[var(--text-secondary)] line-clamp-1' }, b.author ?? ''),
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
