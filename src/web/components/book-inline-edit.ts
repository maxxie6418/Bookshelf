// 表格行内编辑：就地编辑高频字段（状态/分类/评分/收藏/标签），保存走 PATCH
import { state } from '../state';
import type { Book } from '../types';
import { api } from '../api';
import { h, toast, iconCheck, iconClose, renderCoverPlaceholder, mainDomain } from '../ui';
import type { BookMetadata } from './book-edit-form';

export interface InlineEditHandlers {
  onCancel: () => void;
  onSaved: () => void;
}

export interface InlineEditRow {
  row: HTMLTableRowElement;
  save: () => Promise<boolean>;
  saveSilent: () => Promise<boolean>;
  cancel: () => void;
  isDirty: () => boolean;
  markClean: () => void;
}

const STATUS_OPTIONS: [Book['status'], string][] = [
  ['unread', '未读'],
  ['reading', '在读'],
  ['finished', '读完'],
  ['shelved', '搁置'],
];

const inputCls =
  'px-2 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-page)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 placeholder:text-[var(--text-muted)] transition-colors';

function coverEl(b: Book): HTMLElement {
  if (b.cover_url) {
    return h('img', { src: b.cover_url, alt: b.title, class: 'w-full h-full object-cover', loading: 'lazy', decoding: 'async' });
  }
  return renderCoverPlaceholder(b, 'table');
}

// 抓取元数据 → 更新字段；合并策略：仅当「抓取到值」且「该书当前字段为空」时才写入，
// 已有内容的属性不覆盖（避免清理用户自定义内容）。想系统自动更新需先清空对应字段。
// cover_url 仅非空时更新，douban_url 不予覆盖（防拿空值清掉原链接）。
export function metaToPatch(meta: BookMetadata, book?: Book): Partial<Book> {
  const isEmpty = (v: string | number | null | undefined): boolean =>
    v == null || (typeof v === 'string' && v.trim() === '');

  const patch: Partial<Book> = {};
  if (meta.title && isEmpty(book?.title)) patch.title = meta.title;
  if (meta.author && isEmpty(book?.author)) patch.author = meta.author;
  if (meta.translator && isEmpty(book?.translator)) patch.translator = meta.translator;
  if (meta.publisher && isEmpty(book?.publisher)) patch.publisher = meta.publisher;
  if (meta.publish_year != null && isEmpty(book?.publish_year)) patch.publish_year = meta.publish_year;
  if (meta.page_count != null && isEmpty(book?.page_count)) patch.page_count = meta.page_count;
  if (meta.subtitle && isEmpty(book?.subtitle)) patch.subtitle = meta.subtitle;
  if (meta.isbn && isEmpty(book?.isbn)) patch.isbn = meta.isbn;
  if (meta.description && isEmpty(book?.description)) patch.description = meta.description;
  if (meta.douban_rating != null && isEmpty(book?.rating)) patch.rating = meta.douban_rating;
  if (meta.cover_url && isEmpty(book?.cover_url)) patch.cover_url = meta.cover_url;
  return patch;
}

export function createInlineEditRow(book: Book, handlers: InlineEditHandlers, opts: { batch?: boolean } = {}): InlineEditRow {
  const batch = opts.batch === true;
  let dirty = false;
  const markDirty = () => { dirty = true; };
  const isDirty = () => dirty;
  const markClean = () => { dirty = false; };

  const statusSel = h('select', {
    class: inputCls + ' w-full',
    onchange: markDirty,
  });
  for (const [v, label] of STATUS_OPTIONS) {
    statusSel.append(h('option', { value: v, selected: book.status === v ? '' : null }, label));
  }

  const catSel = h('select', {
    class: inputCls + ' w-full',
    onchange: markDirty,
  });
  catSel.append(h('option', { value: '' }, '（无分类）'));
  for (const c of state.categories) {
    catSel.append(h('option', { value: String(c.id), selected: book.category_id === c.id ? '' : null }, c.name));
  }

  const ratingEl = h('input', {
    type: 'number', step: '0.1', min: '0', max: '10',
    class: inputCls + ' w-24', value: book.rating != null ? String(book.rating) : '', placeholder: '—',
    oninput: markDirty,
  });

  const favEl = h('input', {
    type: 'checkbox', class: 'w-4 h-4 rounded accent-[var(--accent)]',
    onchange: markDirty,
  });
  favEl.checked = !!book.favorite;

  const tagsEl = h('input', {
    class: inputCls + ' w-full', value: book.tags.join(', '), placeholder: '标签（逗号分隔）',
    oninput: markDirty,
  });

  const saveBtn = h('button', {
    class: 'flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors shrink-0',
    title: '保存',
    onclick: () => void save(),
  }, iconCheck(15));
  if (batch) saveBtn.classList.add('hidden');

  const cancelBtn = h('button', {
    class: 'flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0',
    title: '取消',
    onclick: () => handlers.onCancel(),
  }, iconClose(15));
  if (batch) cancelBtn.classList.add('hidden');

  async function doSave(): Promise<boolean> {
    const rating = ratingEl.value ? Number(ratingEl.value) : null;
    if (rating !== null && (Number.isNaN(rating) || rating < 0 || rating > 10)) {
      toast('评分需为 0–10 的数字', 'error');
      return false;
    }
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    try {
      await api.updateBook(book.id, {
        status: statusSel.value as Book['status'],
        category_id: catSel.value ? Number(catSel.value) : null,
        rating,
        favorite: favEl.checked ? 1 : 0,
        tags: tagsEl.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      });
      markClean();
      return true;
    } catch (e) {
      toast((e as Error).message, 'error');
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
      return false;
    }
  }

  // 保存当前行：成功提示并执行 handlers.onSaved（批量模式下由外部统一处理），失败返回 false
  async function save(): Promise<boolean> {
    const ok = await doSave();
    if (ok) {
      toast('已保存');
      handlers.onSaved();
    }
    return ok;
  }

  // 静默保存（不触发 onSaved），供批量「保存全部」逐行调用后统一刷新
  async function saveSilent(): Promise<boolean> {
    return doSave();
  }

  // 保持与表头一致的 9 列结构，避免 colspan 导致布局错乱
  const row = h('tr', { class: 'bg-[var(--accent)]/5' },
    // 1. 封面
    h('td', { class: 'px-4 py-2 align-middle' },
      h('div', { class: 'w-10 h-14 rounded-md overflow-hidden shadow-sm' }, coverEl(book)),
    ),
    // 2. 书名（只读）
    h('td', { class: 'px-4 py-2 align-middle' },
      h('div', { class: 'font-medium text-sm font-display text-[var(--text-primary)] truncate max-w-[240px]', title: book.title }, book.title),
      book.subtitle ? h('div', { class: 'text-xs text-[var(--text-muted)] truncate max-w-[240px]', title: book.subtitle }, book.subtitle) : null,
    ),
    // 3. 作者（只读）
    h('td', { class: 'px-4 py-2 align-middle' },
      h('span', { class: 'block text-sm text-[var(--text-secondary)] truncate max-w-[150px]', title: book.author ?? '' }, book.author ?? ''),
    ),
    // 4. 状态
    h('td', { class: 'px-4 py-2 align-middle' }, statusSel),
    // 5. 分类
    h('td', { class: 'px-4 py-2 align-middle' }, catSel),
    // 6. 评分
    h('td', { class: 'px-4 py-2 align-middle' }, ratingEl),
    // 7. 标签（原位编辑）
    h('td', { class: 'px-4 py-2 align-middle' }, tagsEl),
    // 8. 豆瓣链接（只读）
    h('td', { class: 'px-4 py-2 align-middle' },
      book.douban_url
        ? h('a', { href: book.douban_url, target: '_blank', rel: 'noreferrer', class: 'text-xs text-[var(--accent)] hover:underline break-all' }, mainDomain(book.douban_url))
        : h('span', { class: 'text-xs text-[var(--text-muted)]' }, '—'),
    ),
    // 9. 操作
    h('td', { class: 'px-4 py-2 align-middle text-right whitespace-nowrap' },
      h('div', { class: 'inline-flex items-center gap-2' },
        h('label', { class: 'flex items-center gap-1 cursor-pointer shrink-0' },
          favEl,
          h('span', { class: 'text-xs text-[var(--text-secondary)]' }, '收藏'),
        ),
        cancelBtn,
        saveBtn,
      ),
    ),
  );

  return { row, save, saveSilent, cancel: () => handlers.onCancel(), isDirty, markClean };
}