// 添加 / 编辑共用表单（弹窗）
import { api } from '../api';
import { state } from '../state';
import type { Book } from '../types';
import { h, toast, modal } from '../ui';
import { refresh, refreshSidebar } from '../refresh';

const inputCls =
  'w-full px-3.5 py-2 rounded-xl border border-shelf-200 dark:border-shelf-700 dark:bg-shelf-900 dark:text-shelf-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';
const labelCls = 'block text-xs text-shelf-500 dark:text-shelf-400 mb-1';

export function openBookForm(book?: Book) {
  const isEdit = !!book;

  // 抓取预填（M3 接入前先留桩：可直接填字段）
  const doFetch = async (urlOrIsbn: string) => {
    // TODO(M3): 调 POST /api/books/metadata/fetch 后回填
    toast('抓取预填将在 M3 接入，当前请手动填写', 'success');
  };

  const title = h('input', { class: inputCls, value: book?.title ?? '', placeholder: '书名 *' });
  const author = h('input', { class: inputCls, value: book?.author ?? '', placeholder: '作者' });
  const translator = h('input', { class: inputCls, value: book?.translator ?? '', placeholder: '译者' });
  const publisher = h('input', { class: inputCls, value: book?.publisher ?? '', placeholder: '出版社' });
  const publishYear = h('input', { type: 'number', class: inputCls, value: book?.publish_year ?? '', placeholder: '出版年' });
  const pageCount = h('input', { type: 'number', class: inputCls, value: book?.page_count ?? '', placeholder: '页数' });
  const originalTitle = h('input', { class: inputCls, value: book?.original_title ?? '', placeholder: '原作名' });
  const isbn = h('input', { class: inputCls, value: book?.isbn ?? '', placeholder: 'ISBN' });
  const description = h('textarea', { class: inputCls + ' min-h-20', placeholder: '简介' }, book?.description ?? '');
  const coverUrl = h('input', { class: inputCls, value: book?.cover_url ?? '', placeholder: '封面 URL（留空用渐变兜底）' });
  const doubanUrl = h('input', { class: inputCls, value: book?.douban_url ?? '', placeholder: '豆瓣链接（M3 接入抓取）' });
  const rating = h('input', { type: 'number', step: '0.1', min: '0', max: '10', class: inputCls, value: book?.rating ?? '', placeholder: '评分' });
  const tags = h('input', { class: inputCls, value: book?.tags?.join(', ') ?? '', placeholder: '标签（逗号分隔）' });

  const statusSel = h('select', { class: inputCls });
  for (const [v, label] of [['unread', '未读'], ['reading', '在读'], ['finished', '读完']] as const) {
    statusSel.append(h('option', { value: v, selected: (book?.status ?? 'unread') === v ? '' : null }, label));
  }

  const catSel = h('select', { class: inputCls });
  catSel.append(h('option', { value: '' }, '（无分类）'));
  for (const c of state.categories) {
    catSel.append(h('option', { value: String(c.id), selected: book?.category_id === c.id ? '' : null }, c.name));
  }

  const fetchBar = h('div', { class: 'flex gap-2' },
    doubanUrl,
    h('button', {
      class: 'shrink-0 px-3 py-2 rounded-xl border border-shelf-200 dark:border-shelf-700 text-sm text-shelf-600 dark:text-shelf-300',
      onclick: () => void doFetch(doubanUrl.value),
    }, '抓取'),
  );

  const grid2 = (a: HTMLElement, b: HTMLElement) => h('div', { class: 'grid grid-cols-2 gap-3' }, a, b);
  const field = (label: string, el: HTMLElement) => h('div', {}, h('label', { class: labelCls }, label), el);

  const content = h('div', { class: 'space-y-3' },
    fetchBar,
    field('书名 *', title),
    grid2(field('作者', author), field('译者', translator)),
    grid2(field('出版社', publisher), field('出版年', publishYear)),
    grid2(field('页数', pageCount), field('原作名', originalTitle)),
    grid2(field('ISBN', isbn), field('评分', rating)),
    grid2(field('状态', statusSel), field('分类', catSel)),
    field('标签', tags),
    field('封面 URL', coverUrl),
    field('简介', description),
    h('div', { class: 'flex justify-end gap-3 pt-2' },
      h('button', { class: 'px-4 py-2 rounded-xl text-shelf-600 dark:text-shelf-300 hover:bg-shelf-100 dark:hover:bg-shelf-700 text-sm', onclick: () => document.body.lastElementChild?.remove() }, '取消'),
      h('button', {
        class: 'px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium',
        onclick: async () => {
          const payload: Record<string, unknown> = {
            title: title.value.trim(),
            author: author.value.trim() || null,
            translator: translator.value.trim() || null,
            publisher: publisher.value.trim() || null,
            publish_year: publishYear.value ? Number(publishYear.value) : null,
            page_count: pageCount.value ? Number(pageCount.value) : null,
            original_title: originalTitle.value.trim() || null,
            isbn: isbn.value.trim() || null,
            description: description.value.trim() || null,
            cover_url: coverUrl.value.trim() || null,
            douban_url: doubanUrl.value.trim() || null,
            rating: rating.value ? Number(rating.value) : null,
            status: statusSel.value,
            category_id: catSel.value ? Number(catSel.value) : null,
            tags: tags.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
          };
          if (!payload.title) {
            toast('书名必填', 'error');
            return;
          }
          try {
            if (isEdit) await api.updateBook(book!.id, payload);
            else await api.createBook(payload as never);
            document.body.lastElementChild?.remove();
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

  modal(isEdit ? `编辑《${book!.title}》` : '添加书籍', content);
}