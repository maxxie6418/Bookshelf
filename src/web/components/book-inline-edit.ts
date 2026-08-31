// 表格行内编辑：就地编辑高频字段（状态/分类/评分/收藏/标签），保存走 PATCH
import { state } from '../state';
import type { Book } from '../types';
import { api } from '../api';
import { h, toast, iconCheck, iconClose, renderCoverPlaceholder } from '../ui';
import type { BookMetadata } from './book-edit-form';

export interface InlineEditHandlers {
  onCancel: () => void;
  onSaved: () => void;
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
    return h('img', { src: b.cover_url, alt: b.title, class: 'w-full h-full object-cover', loading: 'lazy' });
  }
  return renderCoverPlaceholder(b, 'table');
}

// 抓取元数据 → 更新字段；cover_url 仅非空时更新，douban_url 不予覆盖（防拿空值清掉原链接）
export function metaToPatch(meta: BookMetadata): Partial<Book> {
  const patch: Partial<Book> = {
    title: meta.title ?? undefined,
    author: meta.author ?? undefined,
    translator: meta.translator ?? undefined,
    publisher: meta.publisher ?? undefined,
    publish_year: meta.publish_year ?? undefined,
    page_count: meta.page_count ?? undefined,
    subtitle: meta.subtitle ?? undefined,
    isbn: meta.isbn ?? undefined,
    description: meta.description ?? undefined,
    rating: meta.douban_rating ?? undefined,
  };
  if (meta.cover_url) patch.cover_url = meta.cover_url;
  return patch;
}

export function createInlineEditRow(book: Book, handlers: InlineEditHandlers): HTMLTableRowElement {
  const statusSel = h('select', { class: inputCls + ' w-full' });
  for (const [v, label] of STATUS_OPTIONS) {
    statusSel.append(h('option', { value: v, selected: book.status === v ? '' : null }, label));
  }

  const catSel = h('select', { class: inputCls + ' w-full' });
  catSel.append(h('option', { value: '' }, '（无分类）'));
  for (const c of state.categories) {
    catSel.append(h('option', { value: String(c.id), selected: book.category_id === c.id ? '' : null }, c.name));
  }

  const ratingEl = h('input', {
    type: 'number', step: '0.1', min: '0', max: '10',
    class: inputCls + ' w-24', value: book.rating != null ? String(book.rating) : '', placeholder: '—',
  });

  const favEl = h('input', { type: 'checkbox', class: 'w-4 h-4 rounded accent-[var(--accent)]' });
  favEl.checked = !!book.favorite;

  const tagsEl = h('input', { class: inputCls + ' w-full mt-1.5', value: book.tags.join(', '), placeholder: '标签（逗号分隔）' });

  const saveBtn = h('button', {
    class: 'flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors',
    title: '保存',
    onclick: () => void save(),
  }, iconCheck(15));

  const cancelBtn = h('button', {
    class: 'flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors',
    title: '取消',
    onclick: () => handlers.onCancel(),
  }, iconClose(15));

  async function save() {
    const rating = ratingEl.value ? Number(ratingEl.value) : null;
    if (rating !== null && (Number.isNaN(rating) || rating < 0 || rating > 10)) {
      toast('评分需为 0–10 的数字', 'error');
      return;
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
      toast('已保存');
      handlers.onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  }

  return h('tr', { class: 'bg-[var(--accent)]/5' },
    h('td', { class: 'px-4 py-2' },
      h('div', { class: 'w-10 h-14 rounded-md overflow-hidden shadow-sm' }, coverEl(book)),
    ),
    h('td', { class: 'px-4 py-2', colspan: '2' },
      h('div', { class: 'font-medium text-sm font-display text-[var(--text-primary)]' }, book.title),
      book.author ? h('div', { class: 'text-xs text-[var(--text-muted)] mt-0.5' }, book.author) : null,
      tagsEl,
    ),
    h('td', { class: 'px-4 py-2' }, statusSel),
    h('td', { class: 'px-4 py-2' }, catSel),
    h('td', { class: 'px-4 py-2' }, ratingEl),
    h('td', { class: 'px-4 py-2 text-right whitespace-nowrap' },
      h('div', { class: 'inline-flex items-center gap-2' },
        h('label', { class: 'flex items-center gap-1 cursor-pointer' },
          favEl,
          h('span', { class: 'text-xs text-[var(--text-secondary)]' }, '收藏'),
        ),
        cancelBtn,
        saveBtn,
      ),
    ),
  );
}