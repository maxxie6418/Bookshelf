// 详情抽屉
import { api } from '../api';
import type { Book } from '../types';
import { h, toast, confirmDialog, getCoverPattern, renderStars } from '../ui';
import { openBookForm } from './book-form';
import { refresh } from '../refresh';

const STATUS_LABEL: Record<string, string> = { unread: '未读', reading: '在读', finished: '读完' };

const STATUS_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  unread:   { label: '未读',   dot: 'bg-shelf-400',           bg: 'bg-shelf-100 dark:bg-shelf-700',           text: 'text-shelf-600 dark:text-shelf-400' },
  reading:  { label: '在读',   dot: 'bg-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30',  text: 'text-emerald-700 dark:text-emerald-400' },
  finished: { label: '已读完', dot: 'bg-amber-500',           bg: 'bg-amber-100 dark:bg-amber-900/30',          text: 'text-amber-700 dark:text-amber-400' },
};

function field(label: string, value: string | null | undefined): HTMLElement | null {
  if (!value) return null;
  return h('div', { class: 'text-sm' },
    h('div', { class: 'text-xs text-shelf-400 mb-1' }, label),
    h('div', { class: 'font-medium text-shelf-900 dark:text-shelf-50' }, value),
  );
}

export function renderDrawer(book: Book) {
  const modalEl = h('div', { class: 'fixed inset-0 z-50 hidden' });
  const backdrop = h('div', { class: 'modal-backdrop absolute inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-300 opacity-0' });
  const drawer = h('aside', {
    class: 'absolute top-0 right-0 h-full w-full sm:w-[480px] lg:w-[520px] bg-white dark:bg-shelf-800 shadow-2xl transform translate-x-full transition-transform duration-300 ease-out pointer-events-auto overflow-y-auto',
  });

  const meta = STATUS_META[book.status] ?? STATUS_META.unread;
  const pattern = getCoverPattern(book.title);

  // 顶部渐变封面区
  const header = h('div', { class: `relative h-56 sm:h-64 cover-pattern-${pattern} overflow-hidden` },
    h('div', { class: 'absolute inset-0 bg-black/20' }),
    h('div', { class: 'absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent' },
      h('h2', { class: 'text-2xl sm:text-3xl font-bold text-white font-serif drop-shadow-lg' }, book.title),
      book.original_title ? h('p', { class: 'text-white/80 text-sm mt-1' }, book.original_title) : undefined,
    ),
    h('button', {
      class: 'absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors backdrop-blur-sm',
      onclick: close,
    },
      h('svg', { class: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
        h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M6 18L18 6M6 6l12 12' }),
      ),
    ),
  );

  const body = h('div', { class: 'p-6 space-y-6' },
    // 状态/分类/评分行
    h('div', { class: 'flex flex-wrap items-center gap-3' },
      h('span', { class: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${meta.bg} ${meta.text}` },
        h('span', { class: `w-2 h-2 rounded-full ${meta.dot}` }),
        STATUS_LABEL[book.status],
      ),
      book.category_name && h('span', { class: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-shelf-100 dark:bg-shelf-700 text-shelf-600 dark:text-shelf-300' },
        h('span', { class: 'w-2 h-2 rounded-sm', style: `background:${book.category_color ?? '#8a8274'}` }),
        book.category_name,
      ),
      book.rating ? renderStars(book.rating, 'w-4 h-4') : null,
    ),
    // 元数据网格
    h('div', { class: 'grid grid-cols-2 gap-4 text-sm' },
      field('作者', book.author),
      field('译者', book.translator),
      field('出版社', book.publisher),
      field('出版年', book.publish_year != null ? String(book.publish_year) : null),
      field('ISBN', book.isbn),
      field('页数', book.page_count != null ? `${book.page_count} 页` : null),
    ),
    // 简介
    book.description ? h('div', {},
      h('div', { class: 'text-xs text-shelf-400 mb-2' }, '简介'),
      h('p', { class: 'text-sm leading-relaxed text-shelf-600 dark:text-shelf-300' }, book.description),
    ) : null,
    // 标签
    book.tags.length > 0 ? h('div', {},
      h('div', { class: 'text-xs text-shelf-400 mb-2' }, '标签'),
      h('div', { class: 'flex flex-wrap gap-2' },
        ...book.tags.map((t) => h('span', { class: 'px-2.5 py-1 rounded-full text-xs bg-shelf-100 dark:bg-shelf-700 text-shelf-600 dark:text-shelf-300' }, `#${t}`)),
      ),
    ) : null,
    // 豆瓣链接
    book.douban_url ? h('div', {},
      h('a', { href: book.douban_url, target: '_blank', rel: 'noreferrer', class: 'text-amber-600 dark:text-amber-400 text-sm underline' }, '豆瓣链接'),
    ) : null,
    // 操作按钮
    h('div', { class: 'flex gap-3 pt-2 pb-4' },
      h('button', {
        class: 'flex-1 px-4 py-2.5 border border-shelf-200 dark:border-shelf-600 rounded-lg text-sm font-medium hover:bg-shelf-50 dark:hover:bg-shelf-700 transition-colors',
        onclick: close,
      }, '关闭'),
      h('button', {
        class: 'flex-1 px-4 py-2.5 bg-shelf-800 dark:bg-amber-500 text-white dark:text-shelf-900 rounded-lg text-sm font-medium hover:bg-shelf-700 dark:hover:bg-amber-400 transition-colors',
        onclick: () => { close(); openBookForm(book); },
      }, '编辑'),
    ),
    // 删除按钮（放在最底部，弱化显示）
    h('div', { class: 'pt-2 border-t dark:border-shelf-700' },
      h('button', {
        class: 'px-4 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm',
        onclick: async () => {
          const ok = await confirmDialog(`把《${book.title}》移入回收站？可随时恢复。`);
          if (!ok) return;
          try {
            await api.softDelete(book.id);
            close();
            toast('已移入回收站');
            await refresh();
          } catch (e) {
            toast((e as Error).message, 'error');
          }
        },
      }, '移入回收站'),
    ),
  );

  drawer.append(header, body);
  modalEl.append(backdrop, drawer);

  function open() {
    document.body.append(modalEl);
    modalEl.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
      drawer.classList.remove('translate-x-full');
      drawer.classList.add('translate-x-0');
    });
  }

  function close() {
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('translate-x-full');
    document.body.style.overflow = '';
    setTimeout(() => { modalEl.remove(); }, 300);
  }

  backdrop.addEventListener('click', close);
  open();
}