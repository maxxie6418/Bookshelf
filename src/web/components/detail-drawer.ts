// 详情抽屉
import { api } from '../api';
import type { Book } from '../types';
import { h, toast, confirmDialog } from '../ui';
import { openBookForm } from './book-form';
import { refresh } from '../refresh';

const STATUS_LABEL: Record<string, string> = { unread: '未读', reading: '在读', finished: '读完' };

function field(label: string, value: string | null | undefined): HTMLElement | null {
  if (!value) return null;
  return h('div', { class: 'text-sm' },
    h('span', { class: 'text-shelf-500 dark:text-shelf-400 block text-xs mb-0.5' }, label),
    h('span', { class: 'text-shelf-900 dark:text-shelf-50' }, value),
  );
}

export function renderDrawer(book: Book) {
  const overlay = h('div', { class: 'fixed inset-0 z-40 bg-shelf-900/40' });
  const drawer = h('aside', {
    class: 'fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-white dark:bg-shelf-800 shadow-2xl overflow-y-auto transition-transform',
    style: 'transform:translateX(0)',
  });

  const coverEl = book.cover_url
    ? h('img', { src: book.cover_url, class: 'w-24 h-32 object-cover rounded-xl shadow' })
    : h('div', { class: 'w-24 h-32 rounded-xl bg-shelf-100 dark:bg-shelf-700 flex items-center justify-center text-shelf-400 font-serif text-3xl' }, book.title.slice(0, 1));

  const delBtn = h('button', {
    class: 'px-4 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm',
    onclick: async () => {
      const ok = await confirmDialog(`把《${book.title}》移入回收站？可随时恢复。`);
      if (!ok) return;
      try {
        await api.softDelete(book.id);
        overlay.remove();
        toast('已移入回收站');
        await refresh();
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    },
  }, '删除');

  const editBtn = h('button', {
    class: 'px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm',
    onclick: () => openBookForm(book),
  }, '编辑');

  drawer.append(
    h('div', { class: 'p-6' },
      h('div', { class: 'flex justify-between items-start mb-4' },
        h('h2', { class: 'text-xl font-serif text-shelf-900 dark:text-shelf-50 pr-4' }, book.title),
        h('button', { class: 'text-shelf-400 hover:text-shelf-600 dark:hover:text-shelf-200 text-xl', onclick: () => overlay.remove() }, '✕'),
      ),
      h('div', { class: 'flex gap-4 mb-5' },
        coverEl,
        h('div', { class: 'space-y-1' },
          h('div', { class: 'text-shelf-900 dark:text-shelf-50 font-medium' }, book.author ?? '佚名'),
          field('译者', book.translator),
          field('出版社', book.publisher),
          field('出版年', book.publish_year != null ? String(book.publish_year) : null),
          field('页数', book.page_count != null ? `${book.page_count} 页` : null),
          field('ISBN', book.isbn),
          field('评分', book.rating != null ? book.rating.toFixed(1) : null),
        ),
      ),
      h('div', { class: 'flex flex-wrap gap-2 mb-4' },
        h('span', {
          class: 'inline-block px-2.5 py-1 rounded-full text-xs font-medium',
          style: `background:${book.status === 'reading' ? '#f59e0b' : book.status === 'finished' ? '#10b981' : '#8a8274'}1a;color:${book.status === 'reading' ? '#f59e0b' : book.status === 'finished' ? '#10b981' : '#8a8274'}`,
        }, STATUS_LABEL[book.status]),
        book.category_name && h('span', { class: 'inline-block px-2.5 py-1 rounded-full text-xs', style: `background:${book.category_color ?? '#8a8274'}22;color:${book.category_color ?? '#8a8274'}` }, book.category_name),
        ...book.tags.map((t) => h('span', { class: 'inline-block px-2.5 py-1 rounded-full text-xs bg-shelf-100 dark:bg-shelf-700 text-shelf-600 dark:text-shelf-300' }, `#${t}`)),
      ),
      field('简介', book.description),
      book.douban_url && h('div', { class: 'mt-3' },
        h('a', { href: book.douban_url, target: '_blank', rel: 'noreferrer', class: 'text-amber-600 dark:text-amber-400 text-sm underline' }, '豆瓣链接'),
      ),
      h('div', { class: 'flex gap-3 mt-6 pt-4 border-t dark:border-shelf-700' }, editBtn, delBtn),
    ),
  );

  overlay.addEventListener('click', () => overlay.remove());
  document.body.append(overlay, drawer);
}