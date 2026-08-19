// 添加 / 编辑共用表单（弹窗）
import { api } from '../api';
import type { Book } from '../types';
import { h, toast, modal } from '../ui';
import { refresh, refreshSidebar } from '../refresh';
import { createBookEditForm, labelCls } from './book-edit-form';

const field = (label: string, el: HTMLElement) => h('div', {}, h('label', { class: labelCls }, label), el);
const grid2 = (a: HTMLElement, b: HTMLElement) => h('div', { class: 'grid grid-cols-2 gap-3' }, a, b);

export function openBookForm(book?: Book) {
  const isEdit = !!book;
  let overlay: HTMLElement | null = null;
  const f = createBookEditForm(book);
  const { els } = f;

  const content = h('div', { class: 'space-y-3' },
    // 豆瓣抓取
    f.doubanUrlField,
    // 分隔线
    h('div', { class: 'relative' },
      h('div', { class: 'absolute inset-0 flex items-center' }, h('div', { class: 'w-full border-t border-[var(--border-subtle)]' })),
      h('div', { class: 'relative flex justify-center text-xs' }, h('span', { class: 'px-2 bg-[var(--bg-surface)] text-[var(--text-muted)]' }, '或手动录入')),
    ),
    field('书名 *', els.title),
    grid2(field('作者', els.author), field('译者', els.translator)),
    grid2(field('出版社', els.publisher), field('出版年', els.publishYear)),
    grid2(field('页数', els.pageCount), field('原作名', els.originalTitle)),
    grid2(field('ISBN', els.isbn), field('评分', els.rating)),
    grid2(field('状态', els.statusSel), field('分类', els.catSel)),
    field('标签', els.tags),
    field('封面 URL', els.coverUrl),
    field('简介', els.description),
    field('记录', els.notes),
    field('录入理由', els.reason),
    h('div', { class: 'flex justify-end gap-3 pt-2' },
      h('button', { class: 'px-4 py-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] text-sm transition-colors', onclick: () => overlay?.remove() }, '取消'),
      h('button', {
        class: 'px-5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-text)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-[var(--accent)]/20',
        onclick: async () => {
          const err = f.validate();
          if (err) {
            toast(err, 'error');
            return;
          }
          const payload = f.collectPayload();
          try {
            if (isEdit) await api.updateBook(book!.id, payload);
            else await api.createBook(payload as never);
            overlay?.remove();
            toast(isEdit ? '已更新' : '已添加');
            await refresh();
            await refreshSidebar();
          } catch (e) {
            toast((e as Error).message, 'error');
          }
        },
      }, isEdit ? '保存' : '添加'),
    ),
  );

  overlay = modal(isEdit ? `编辑《${book!.title}》` : '添加书籍', content);
}
