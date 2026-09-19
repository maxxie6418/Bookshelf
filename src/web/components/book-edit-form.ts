// 书籍编辑表单构建：供「添加/编辑」弹窗与侧滑抽屉内联编辑复用
import { state } from '../state';
import type { Book } from '../types';
import { api } from '../api';
import { h, toast, iconSearch } from '../ui';
import { STATUS_OPTIONS, INPUT_CLS } from '../constants';

const inputCls = INPUT_CLS;
export const labelCls = 'block text-xs text-[var(--text-secondary)] mb-1.5';

// 元数据抓取返回结构（与 api.fetchMetadata 一致）
export interface BookMetadata {
  title: string | null;
  author: string | null;
  translator: string | null;
  publisher: string | null;
  publish_year: number | null;
  page_count: number | null;
  subtitle: string | null;
  isbn: string | null;
  description: string | null;
  cover_url: string | null;
  douban_url: string | null;
  douban_rating: number | null;
  source: string;
}

export interface EditForm {
  els: {
    title: HTMLInputElement;
    author: HTMLInputElement;
    translator: HTMLInputElement;
    publisher: HTMLInputElement;
    publishYear: HTMLInputElement;
    pageCount: HTMLInputElement;
    subtitle: HTMLInputElement;
    isbn: HTMLInputElement;
    description: HTMLTextAreaElement;
    notes: HTMLTextAreaElement;
    reason: HTMLTextAreaElement;
    coverUrl: HTMLInputElement;
    doubanUrl: HTMLInputElement;
    rating: HTMLInputElement;
    tags: HTMLInputElement;
    statusSel: HTMLSelectElement;
    catSel: HTMLSelectElement;
    favorite: HTMLInputElement;
  };
  fetchBar: HTMLElement;
  fetchBtn: HTMLButtonElement;
  doubanUrlField: HTMLDivElement;
  uploadField: HTMLElement | null; // 编辑态可用的封面上传入口；新增书籍时为 null
  fill(meta: BookMetadata): void;
  collectPayload(): Record<string, unknown>;
  validate(): string | null;
  setFetching(fetching: boolean): void;
}

export function createBookEditForm(book?: Book, opts: { fetchLabel?: string } = {}): EditForm {
  const fetchLabel = opts.fetchLabel ?? '抓取';
  const fetchingLabel = `${fetchLabel}中…`;
  const els = {
    title: h('input', { class: inputCls, value: book?.title ?? '', placeholder: '书名 *' }),
    author: h('input', { class: inputCls, value: book?.author ?? '', placeholder: '作者' }),
    translator: h('input', { class: inputCls, value: book?.translator ?? '', placeholder: '译者' }),
    publisher: h('input', { class: inputCls, value: book?.publisher ?? '', placeholder: '出版社' }),
    publishYear: h('input', { type: 'number', class: inputCls, value: book?.publish_year ?? '', placeholder: '出版年' }),
    pageCount: h('input', { type: 'number', class: inputCls, value: book?.page_count ?? '', placeholder: '页数' }),
    subtitle: h('input', { class: inputCls, value: book?.subtitle ?? '', placeholder: '副标题' }),
    isbn: h('input', { class: inputCls, value: book?.isbn ?? '', placeholder: 'ISBN' }),
    description: h('textarea', { class: inputCls + ' min-h-20', placeholder: '简介' }, book?.description ?? ''),
    notes: h('textarea', { class: inputCls + ' min-h-20', maxlength: '2000', placeholder: '记录（最多 2000 字）' }, book?.notes ?? ''),
    reason: h('textarea', { class: inputCls + ' min-h-16', maxlength: '1000', placeholder: '录入理由（最多 1000 字）' }, book?.reason ?? ''),
    coverUrl: h('input', { class: inputCls, value: book?.cover_url ?? '', placeholder: '封面 URL（留空用渐变兜底）' }),
    doubanUrl: h('input', { class: inputCls, value: book?.douban_url ?? '', placeholder: '豆瓣链接' }),
    rating: h('input', { type: 'number', step: '0.1', min: '0', max: '10', class: inputCls, value: book?.rating ?? '', placeholder: '评分（0-10）' }),
    tags: h('input', { class: inputCls, value: book?.tags?.join(', ') ?? '', placeholder: '标签（逗号分隔）' }),
    statusSel: h('select', { class: inputCls }),
    catSel: h('select', { class: inputCls }),
    favorite: h('input', { type: 'checkbox', class: 'w-4 h-4 rounded accent-[var(--accent)]' }),
  };

  for (const [v, label] of STATUS_OPTIONS) {
    els.statusSel.append(h('option', { value: v, selected: (book?.status ?? 'unread') === v ? '' : null }, label));
  }
  els.favorite.checked = !!book?.favorite;
  els.catSel.append(h('option', { value: '' }, '（无分类）'));
  for (const c of state.categories) {
    els.catSel.append(h('option', { value: String(c.id), selected: book?.category_id === c.id ? '' : null }, c.name));
  }

  const doFetch = async (urlOrIsbn: string) => {
    const input = urlOrIsbn.trim();
    if (!input) {
      toast('请先输入豆瓣链接', 'error');
      return;
    }
    setFetching(true);
    try {
      const d = await api.fetchMetadata(
        /^\d{10,13}[\dXx]$/.test(input) ? { isbn: input } : { url: input },
      );
      fill(d);
      toast('抓取成功，已回填');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setFetching(false);
    }
  };

  // 抓取按钮文案单独包 span：避免用 textContent 覆盖整颗按钮时抹掉内嵌的搜索图标
  const fetchLabelEl = h('span', {}, fetchLabel);
  const fetchBtn = h('button', {
    class: 'shrink-0 px-3 py-2 rounded-xl border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors inline-flex items-center gap-1.5',
    onclick: () => void doFetch(els.doubanUrl.value),
  }, iconSearch(16), fetchLabelEl);

  const fetchBar = h('div', { class: 'flex gap-2' }, els.doubanUrl, fetchBtn);
  const doubanUrlField = h('div', {},
    h('label', { class: labelCls }, '豆瓣链接'),
    fetchBar,
    h('p', { class: 'text-xs text-[var(--text-muted)] mt-1' }, '可粘贴豆瓣链接（或 ISBN）自动获取元数据'),
  );

  // 上传封面（仅编辑已有书籍时可用：上传走独立端点存 R2，把返回的站内路径填进封面 URL，随表单保存生效）
  const uploadField: HTMLElement | null = book ? createUploadField(book.id, els.coverUrl) : null;

  // 抓取回填：仅回填「当前为空」的字段，已有内容的属性不覆盖，避免清理用户自定义内容。
  // 若希望由系统自动更新某属性，需先清空该输入框再点击抓取。
  function fill(meta: BookMetadata) {
    const setIfEmpty = (el: HTMLInputElement | HTMLTextAreaElement, val: string | number | null | undefined) => {
      if (el.value.trim() === '') el.value = val == null ? '' : String(val);
    };
    setIfEmpty(els.title, meta.title);
    setIfEmpty(els.author, meta.author);
    setIfEmpty(els.translator, meta.translator);
    setIfEmpty(els.publisher, meta.publisher);
    setIfEmpty(els.publishYear, meta.publish_year);
    setIfEmpty(els.pageCount, meta.page_count);
    setIfEmpty(els.subtitle, meta.subtitle);
    setIfEmpty(els.isbn, meta.isbn);
    setIfEmpty(els.description, meta.description);
    setIfEmpty(els.coverUrl, meta.cover_url);
    setIfEmpty(els.rating, meta.douban_rating);
    if (els.doubanUrl.value.trim() === '') els.doubanUrl.value = meta.douban_url ?? '';
  }

  function collectPayload(): Record<string, unknown> {
    return {
      title: els.title.value.trim(),
      author: els.author.value.trim() || null,
      translator: els.translator.value.trim() || null,
      publisher: els.publisher.value.trim() || null,
      publish_year: els.publishYear.value ? Number(els.publishYear.value) : null,
      page_count: els.pageCount.value ? Number(els.pageCount.value) : null,
      subtitle: els.subtitle.value.trim() || null,
      isbn: els.isbn.value.trim() || null,
      description: els.description.value.trim() || null,
      notes: els.notes.value.trim() || null,
      reason: els.reason.value.trim() || null,
      cover_url: els.coverUrl.value.trim() || null,
      douban_url: els.doubanUrl.value.trim() || null,
      rating: els.rating.value ? Number(els.rating.value) : null,
      status: els.statusSel.value,
      favorite: els.favorite.checked ? 1 : 0,
      category_id: els.catSel.value ? Number(els.catSel.value) : null,
      tags: els.tags.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    };
  }

  function validate(): string | null {
    if (!els.title.value.trim()) return '书名必填';
    return null;
  }

  function setFetching(fetching: boolean) {
    fetchBtn.disabled = fetching;
    fetchLabelEl.textContent = fetching ? fetchingLabel : fetchLabel;
  }

  return { els, fetchBar, fetchBtn, doubanUrlField, uploadField, fill, collectPayload, validate, setFetching };
}

// 封面上传入口：选择文件 → POST /api/books/:id/cover → 把返回的站内封面路径填入封面 URL 输入框。
// 用强调色边框与其他中性按钮区分，避免在长表单中被忽略
function createUploadField(bookId: number, coverUrlEl: HTMLInputElement): HTMLElement {
  const label = h('span', {}, '上传封面');
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', class: 'hidden' });
  const btn = h('button', {
    class: 'shrink-0 px-3 py-2 rounded-xl border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors text-sm font-medium',
    onclick: () => file.click(),
  }, label);
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    btn.disabled = true;
    label.textContent = '上传中…';
    try {
      const { cover_url } = await api.uploadCover(bookId, f);
      coverUrlEl.value = cover_url;
      toast('封面已上传，点击「保存」生效');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      btn.disabled = false;
      label.textContent = '上传封面';
    }
  });
  return h('div', { class: 'flex items-center gap-2' }, btn, file, h('span', { class: 'text-xs text-[var(--text-muted)]' }, '或直接粘贴外链'));
}