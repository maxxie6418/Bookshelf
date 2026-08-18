// 详情抽屉
import { api } from '../api';
import type { Book } from '../types';
import { h, toast, confirmDialog, renderCoverPlaceholder, renderStars, iconClose } from '../ui';
import { openBookForm } from './book-form';
import { refresh } from '../refresh';

const STATUS_LABEL: Record<string, string> = { unread: '未读', reading: '在读', finished: '读完' };

const STATUS_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  unread:   { label: '未读',   dot: 'bg-[var(--text-muted)]',                 bg: 'bg-[var(--bg-surface-hover)]', text: 'text-[var(--text-secondary)]' },
  reading:  { label: '在读',   dot: 'bg-[var(--accent)] status-reading-dot', bg: 'bg-[var(--accent)]/10',        text: 'text-[var(--accent)]' },
  finished: { label: '已读完', dot: 'bg-[var(--accent)]',                      bg: 'bg-[var(--bg-surface-hover)]', text: 'text-[var(--text-secondary)]' },
};

function field(label: string, value: string | number | null | undefined): HTMLElement {
  const text = value == null || value === '' ? '*' : String(value);
  const isEmpty = text === '*';
  return h('div', { class: 'text-sm' },
    h('div', { class: 'text-xs text-[var(--text-muted)] mb-1' }, label),
    h('div', { class: isEmpty ? 'text-[var(--text-muted)]' : 'font-medium text-[var(--text-primary)]' }, text),
  );
}

function fieldLink(label: string, url: string | null | undefined): HTMLElement {
  const has = !!url && url.trim() !== '';
  return h('div', { class: 'text-sm' },
    h('div', { class: 'text-xs text-[var(--text-muted)] mb-1' }, label),
    has
      ? h('a', { href: url!, target: '_blank', rel: 'noreferrer', class: 'font-medium text-[var(--accent)] hover:underline break-all' }, url)
      : h('div', { class: 'text-[var(--text-muted)]' }, '*'),
  );
}

function coverBlock(book: Book): HTMLElement {
  if (book.cover_url) {
    return h('img', {
      src: book.cover_url,
      alt: book.title,
      class: 'w-full h-full object-cover',
    });
  }
  return renderCoverPlaceholder(book, 'grid');
}

export function renderDrawer(book: Book) {
  const modalEl = h('div', { class: 'fixed inset-0 z-50 hidden' });
  const backdrop = h('div', { class: 'modal-backdrop absolute inset-0 bg-[var(--overlay-bg)] transition-opacity duration-300 ease-[var(--ease-in-out)] opacity-0' });
  const drawer = h('aside', {
    class: 'absolute top-0 right-0 h-full w-full sm:w-[480px] lg:w-[520px] bg-[var(--bg-surface)] shadow-2xl transform translate-x-full transition-transform duration-300 ease-[var(--ease-out-expo)] pointer-events-auto overflow-y-auto',
  });

  const meta = STATUS_META[book.status] ?? STATUS_META.unread;

  // 顶部渐变封面区
  const header = h('div', { class: 'relative h-56 sm:h-64 overflow-hidden bg-[var(--bg-page)]' },
    h('div', { class: 'absolute inset-0 flex items-center justify-center p-8' },
      h('div', { class: 'w-28 sm:w-32 aspect-[3/4] rounded-lg overflow-hidden shadow-2xl' }, coverBlock(book)),
    ),
    h('div', { class: 'absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--bg-surface)] via-[var(--bg-surface)]/80 to-transparent' },
      h('h2', { class: 'text-2xl sm:text-3xl font-bold text-[var(--text-primary)] font-display drop-shadow-sm' }, book.title),
      book.original_title ? h('p', { class: 'text-[var(--text-secondary)] text-sm mt-1' }, book.original_title) : undefined,
    ),
    h('button', {
      class: 'absolute top-4 right-4 p-2 rounded-full bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors backdrop-blur-sm border border-[var(--border-default)]',
      onclick: close,
    }, iconClose(20)),
  );

  const body = h('div', { class: 'p-6 space-y-6' },
    // 状态/分类/评分行
    h('div', { class: 'flex flex-wrap items-center gap-3' },
      h('span', { class: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${meta.bg} ${meta.text}` },
        h('span', { class: `w-2 h-2 rounded-full ${meta.dot}` }),
        STATUS_LABEL[book.status],
      ),
      book.category_name && h('span', { class: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]' },
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
      fieldLink('豆瓣链接', book.douban_url),
    ),
    // 简介
    book.description ? h('div', {},
      h('div', { class: 'text-xs text-[var(--text-muted)] mb-2' }, '简介'),
      h('p', { class: 'text-sm leading-relaxed text-[var(--text-secondary)]' }, book.description),
    ) : null,
    // 标签
    book.tags.length > 0 ? h('div', {},
      h('div', { class: 'text-xs text-[var(--text-muted)] mb-2' }, '标签'),
      h('div', { class: 'flex flex-wrap gap-2' },
        ...book.tags.map((t) => h('span', { class: 'px-2.5 py-1 rounded-full text-xs bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]' }, `#${t}`)),
      ),
    ) : null,
    // 操作按钮
    h('div', { class: 'flex gap-3 pt-2 pb-4' },
      h('button', {
        class: 'flex-1 px-4 py-2.5 border border-[var(--border-default)] rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors',
        onclick: close,
      }, '关闭'),
      h('button', {
        class: 'flex-1 px-4 py-2.5 bg-[var(--accent)] text-[var(--accent-text)] rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors',
        onclick: () => { close(); openBookForm(book); },
      }, '编辑'),
    ),
    // 删除按钮（放在最底部，弱化显示）
    h('div', { class: 'pt-2 border-t border-[var(--border-subtle)]' },
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
    drawer.style.transitionDuration = '200ms';
    backdrop.style.transitionDuration = '200ms';
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('translate-x-full');
    document.body.style.overflow = '';
    setTimeout(() => { modalEl.remove(); }, 200);
  }

  backdrop.addEventListener('click', close);
  open();
}