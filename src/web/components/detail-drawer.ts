// 详情抽屉
import { api } from '../api';
import type { Book } from '../types';
import { h, toast, confirmDialog, renderCoverPlaceholder, renderStars, iconClose } from '../ui';
import { createBookEditForm, labelCls } from './book-edit-form';
import { refresh, refreshSidebar } from '../refresh';

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

// 编辑态字段
function editField(label: string, el: HTMLElement): HTMLElement {
  return h('div', {}, h('label', { class: labelCls }, label), el);
}
function editGrid2(a: HTMLElement, b: HTMLElement): HTMLElement {
  return h('div', { class: 'grid grid-cols-2 gap-3' }, a, b);
}

export function renderDrawer(book: Book) {
  const modalEl = h('div', { class: 'fixed inset-0 z-50 hidden' });
  const backdrop = h('div', { class: 'modal-backdrop absolute inset-0 bg-[var(--overlay-bg)] transition-opacity duration-300 ease-[var(--ease-in-out)] opacity-0' });
  const drawer = h('aside', {
    class: 'absolute top-0 right-0 h-full w-full sm:w-[480px] lg:w-[520px] bg-[var(--bg-surface)] shadow-2xl transform translate-x-full transition-transform duration-300 ease-[var(--ease-out-expo)] pointer-events-auto overflow-y-auto',
  });
  // 内容容器：展示态 / 编辑态整体换内容
  const content = h('div', { class: 'min-h-full' });
  drawer.append(content);

  // 顶部封面头（展示态使用）
  function coverHeader(current: Book) {
    return h('div', { class: 'relative h-56 sm:h-64 overflow-hidden bg-[var(--bg-page)]' },
      h('div', { class: 'absolute inset-0 flex items-center justify-center p-8' },
        h('div', { class: 'w-28 sm:w-32 aspect-[3/4] rounded-lg overflow-hidden shadow-2xl' }, coverBlock(current)),
      ),
      h('div', { class: 'absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--bg-surface)] via-[var(--bg-surface)]/80 to-transparent' },
        h('h2', { class: 'text-2xl sm:text-3xl font-bold text-[var(--text-primary)] font-display drop-shadow-sm' }, current.title),
        current.original_title ? h('p', { class: 'text-[var(--text-secondary)] text-sm mt-1' }, current.original_title) : undefined,
      ),
      h('button', {
        class: 'absolute top-4 right-4 p-2 rounded-full bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors backdrop-blur-sm border border-[var(--border-default)]',
        onclick: close,
      }, iconClose(20)),
    );
  }

  // 展示态主体
  function displayBody(current: Book) {
    const meta = STATUS_META[current.status] ?? STATUS_META.unread;
    return h('div', { class: 'p-6 space-y-6' },
      h('div', { class: 'flex flex-wrap items-center gap-3' },
        h('span', { class: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${meta.bg} ${meta.text}` },
          h('span', { class: `w-2 h-2 rounded-full ${meta.dot}` }),
          STATUS_LABEL[current.status],
        ),
        current.category_name && h('span', { class: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]' },
          h('span', { class: 'w-2 h-2 rounded-sm', style: `background:${current.category_color ?? '#8a8274'}` }),
          current.category_name,
        ),
        current.rating ? renderStars(current.rating, 'w-4 h-4') : null,
      ),
      h('div', { class: 'grid grid-cols-2 gap-4 text-sm' },
        field('作者', current.author),
        field('译者', current.translator),
        field('出版社', current.publisher),
        field('出版年', current.publish_year != null ? String(current.publish_year) : null),
        field('ISBN', current.isbn),
        field('页数', current.page_count != null ? `${current.page_count} 页` : null),
        fieldLink('豆瓣链接', current.douban_url),
      ),
      current.description ? h('div', {},
        h('div', { class: 'text-xs text-[var(--text-muted)] mb-2' }, '简介'),
        h('p', { class: 'text-sm leading-relaxed text-[var(--text-secondary)]' }, current.description),
      ) : null,
      current.tags.length > 0 ? h('div', {},
        h('div', { class: 'text-xs text-[var(--text-muted)] mb-2' }, '标签'),
        h('div', { class: 'flex flex-wrap gap-2' },
          ...current.tags.map((t) => h('span', { class: 'px-2.5 py-1 rounded-full text-xs bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]' }, `#${t}`)),
        ),
      ) : null,
      current.notes ? h('div', {},
        h('div', { class: 'text-xs text-[var(--text-muted)] mb-2' }, '记录'),
        h('p', { class: 'text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap' }, current.notes),
      ) : null,
      h('div', { class: 'flex gap-3 pt-2 pb-4' },
        h('button', { class: 'flex-1 px-4 py-2.5 border border-[var(--border-default)] rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors', onclick: close }, '关闭'),
        h('button', { class: 'flex-1 px-4 py-2.5 bg-[var(--accent)] text-[var(--accent-text)] rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors', onclick: () => enterEdit(current) }, '编辑'),
      ),
      h('div', { class: 'pt-2 border-t border-[var(--border-subtle)]' },
        h('button', {
          class: 'px-4 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm',
          onclick: async () => {
            const ok = await confirmDialog(`把《${current.title}》移入回收站？可随时恢复。`);
            if (!ok) return;
            try {
              await api.softDelete(current.id);
              close();
              toast('已移入回收站');
              await refresh();
              await refreshSidebar();
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          },
        }, '移入回收站'),
      ),
    );
  }

  function renderDisplay(current: Book) {
    content.innerHTML = '';
    content.append(coverHeader(current), displayBody(current));
  }

  // 编辑态：抽屉内联表单（含豆瓣链接 + 更新抓取 + 保存/取消）
  function enterEdit(current: Book) {
    const f = createBookEditForm(current, { fetchLabel: '更新抓取' });
    const { els } = f;

    const editBody = h('div', { class: 'p-6 space-y-3' },
      h('div', { class: 'flex items-center justify-between mb-2' },
        h('h3', { class: 'text-lg font-bold text-[var(--text-primary)]' }, `编辑《${current.title}》`),
        h('button', { class: 'p-2 rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors', onclick: () => renderDisplay(current) }, iconClose(20)),
      ),
      f.doubanUrlField,
      h('div', { class: 'relative' },
        h('div', { class: 'absolute inset-0 flex items-center' }, h('div', { class: 'w-full border-t border-[var(--border-subtle)]' })),
        h('div', { class: 'relative flex justify-center text-xs' }, h('span', { class: 'px-2 bg-[var(--bg-surface)] text-[var(--text-muted)]' }, '或手动录入')),
      ),
      editField('书名 *', els.title),
      editGrid2(editField('作者', els.author), editField('译者', els.translator)),
      editGrid2(editField('出版社', els.publisher), editField('出版年', els.publishYear)),
      editGrid2(editField('页数', els.pageCount), editField('原作名', els.originalTitle)),
      editGrid2(editField('ISBN', els.isbn), editField('评分', els.rating)),
      editGrid2(editField('状态', els.statusSel), editField('分类', els.catSel)),
      editField('标签', els.tags),
      editField('封面 URL', els.coverUrl),
      editField('简介', els.description),
      editField('记录', els.notes),
      h('div', { class: 'flex gap-3 pt-3 pb-4' },
        h('button', { class: 'flex-1 px-4 py-2.5 border border-[var(--border-default)] rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors', onclick: () => renderDisplay(current) }, '取消'),
        h('button', {
          class: 'flex-1 px-4 py-2.5 bg-[var(--accent)] text-[var(--accent-text)] rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors',
          onclick: async () => {
            const err = f.validate();
            if (err) { toast(err, 'error'); return; }
            const payload = f.collectPayload();
            try {
              await api.updateBook(current.id, payload);
              const updated = await api.getBook(current.id);
              toast('已更新');
              await refresh();
              await refreshSidebar();
              renderDisplay(updated);
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          },
        }, '保存'),
      ),
    );

    content.innerHTML = '';
    content.append(editBody);
  }

  modalEl.append(backdrop, drawer);

  function open() {
    document.body.append(modalEl);
    modalEl.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderDisplay(book);
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
