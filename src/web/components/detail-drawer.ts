// 详情抽屉
import { api } from '../api';
import type { Book } from '../types';
import { h, toast, confirmDialog, renderCoverPlaceholder, renderStars, iconClose, iconEdit, iconStar, mainDomain } from '../ui';
import { createBookEditForm, labelCls } from './book-edit-form';
import { refresh } from '../refresh';

const STATUS_LABEL: Record<string, string> = { unread: '未读', reading: '在读', finished: '读完', shelved: '搁置' };

const STATUS_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  unread:   { label: '未读',   dot: 'bg-[var(--text-muted)]',                 bg: 'bg-[var(--bg-surface-hover)]', text: 'text-[var(--text-secondary)]' },
  reading:  { label: '在读',   dot: 'bg-[var(--accent)] status-reading-dot', bg: 'bg-[var(--accent)]/10',        text: 'text-[var(--accent)]' },
  finished: { label: '已读完', dot: 'bg-[var(--accent)]',                      bg: 'bg-[var(--bg-surface-hover)]', text: 'text-[var(--text-secondary)]' },
  shelved:  { label: '搁置',   dot: 'bg-[var(--text-muted)]/50',               bg: 'bg-[var(--bg-surface-hover)]', text: 'text-[var(--text-secondary)]' },
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
      ? h('a', { href: url!, target: '_blank', rel: 'noreferrer', class: 'font-medium text-[var(--accent)] hover:underline break-all', title: url }, mainDomain(url!))
      : h('div', { class: 'text-[var(--text-muted)]' }, '*'),
  );
}

// 编辑态字段
function editField(label: string, el: HTMLElement): HTMLElement {
  return h('div', {}, h('label', { class: labelCls }, label), el);
}
function editGrid2(a: HTMLElement, b: HTMLElement): HTMLElement {
  return h('div', { class: 'grid grid-cols-2 gap-3' }, a, b);
}

// 笔记 / 录入理由：内联编辑块（不进全表单编辑，头部小按钮进入编辑、直接保存）
function editableMemoBlock(
  book: Book,
  memoKey: 'notes' | 'reason',
  label: string,
  maxLen: number,
): HTMLElement {
  const wrap = h('div', { class: 'rounded-xl border border-[var(--border-default)] overflow-hidden bg-[var(--bg-surface)]' });
  const viewEl = h('div', {});
  const editEl = h('div', { class: 'hidden' });
  wrap.append(viewEl, editEl);

  const renderView = () => {
    const val = book[memoKey] || '';
    viewEl.classList.remove('hidden');
    editEl.classList.add('hidden');
    viewEl.replaceChildren(
      h('div', { class: 'flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]' },
        h('div', { class: 'text-xs font-medium text-[var(--text-muted)]' }, label),
        h('button', {
          class: 'inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors',
          onclick: () => { viewEl.classList.add('hidden'); editEl.classList.remove('hidden'); renderEdit(); },
        }, iconEdit(14), '编辑'),
      ),
      h('div', { class: 'px-3 py-2.5' },
        val
          ? h('p', { class: 'text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap' }, val)
          : h('p', { class: 'text-sm text-[var(--text-muted)]' }, '暂无内容，点击右上角「编辑」填写'),
      ),
    );
  };

  function renderEdit() {
    const ta = h('textarea', { class: 'w-full min-h-24 px-3.5 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-y', rows: 5 });
    ta.value = book[memoKey] || '';
    const charCount = h('span', { class: 'text-xs text-[var(--text-muted)]' }, `${ta.value.length}/${maxLen}`);
    ta.addEventListener('input', () => { charCount.textContent = `${ta.value.length}/${maxLen}`; });
    editEl.replaceChildren(
      h('div', { class: 'px-3 py-2' },
        h('div', { class: 'flex items-center justify-between mb-1.5' },
          h('div', { class: 'text-xs font-medium text-[var(--text-muted)]' }, label),
          charCount,
        ),
        ta,
        h('div', { class: 'flex gap-2 mt-2' },
          h('button', {
            class: 'px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] transition-colors',
            onclick: () => { editEl.classList.add('hidden'); renderView(); },
          }, '取消'),
          h('button', {
            class: 'px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors',
            onclick: async () => {
            const value = ta.value.trim();
            if (value.length > maxLen) { toast(`最多 ${maxLen} 字`, 'error'); return; }
            try {
              await api.updateBook(book.id, { [memoKey]: value || null });
              const updated = await api.getBook(book.id);
              toast('已保存');
              book = updated;
              await refresh(false, false);
              editEl.classList.add('hidden');
              renderView();
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          },
          }, '保存'),
        ),
      ),
    );
  }

  renderView();
  return wrap;
}

export function renderDrawer(book: Book) {
  const modalEl = h('div', { class: 'fixed inset-0 z-50 hidden' });
  const backdrop = h('div', { class: 'modal-backdrop absolute inset-0 bg-[var(--overlay-bg)] transition-opacity duration-300 ease-[var(--ease-in-out)] opacity-0' });
  const drawer = h('aside', {
    class: 'absolute top-0 right-0 h-full w-full sm:w-[600px] lg:w-[680px] bg-[var(--bg-surface)] shadow-2xl transform translate-x-full transition-transform duration-300 ease-[var(--ease-out-expo)] pointer-events-auto flex flex-col overflow-hidden',
  });
  // 内容容器（可滚动主体）与底部固定操作栏
  const content = h('div', { class: 'flex-1 overflow-y-auto min-h-0' });
  const footer = h('div', { class: 'shrink-0 bg-[var(--bg-surface)]' });
  drawer.append(content, footer);

  // 顶部封面头：封面放大模糊做渐变填充背景（不完整居中显示），并压缩高度让正文上移
  function coverHeader(current: Book) {
    const backLayer = current.cover_url
      ? h('img', {
          src: current.cover_url,
          alt: '',
          class: 'absolute -inset-x-10 -inset-y-6 w-[calc(100%+5rem)] h-[calc(100%+3rem)] object-cover blur-xl scale-110 opacity-70',
        })
      : h('div', { class: 'absolute -inset-x-10 -inset-y-6 overflow-hidden' },
          renderCoverPlaceholder(current, 'table'));
    return h('div', { class: 'relative h-40 sm:h-48 overflow-hidden bg-[var(--bg-page)]' },
      backLayer,
      h('div', { class: 'absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-[var(--bg-surface)]/60 to-[var(--bg-surface)]/30' }),
      h('div', { class: 'absolute bottom-0 left-0 right-0 p-5 pt-10' },
        h('h2', { class: 'text-2xl sm:text-3xl font-bold text-[var(--text-primary)] font-display drop-shadow-sm' }, current.title),
        current.subtitle ? h('p', { class: 'text-[var(--text-secondary)] text-sm mt-1' }, current.subtitle) : undefined,
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
        current.category_name ? h('span', { class: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]' },
          h('span', { class: 'w-2 h-2 rounded-sm', style: `background:${current.category_color ?? '#8a8274'}` }),
          current.category_name,
        ) : null,
        current.rating ? renderStars(current.rating, 'w-4 h-4') : null,
      ),
      // 书籍本身的属性：统一容器框起来（含简介，超 6 行滚动浏览）
      h('div', { class: 'rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4' },
        h('div', { class: 'text-xs font-medium text-[var(--text-muted)] mb-2.5' }, '书籍属性'),
        h('div', { class: 'grid grid-cols-2 gap-x-4 gap-y-3 text-sm' },
          field('作者', current.author),
          field('译者', current.translator),
          field('出版社', current.publisher),
          field('出版年', current.publish_year != null ? String(current.publish_year) : null),
          field('ISBN', current.isbn),
          field('页数', current.page_count != null ? `${current.page_count} 页` : null),
          fieldLink('豆瓣链接', current.douban_url),
          field('录入时间', current.created_at),
        ),
        h('div', { class: 'mt-3 pt-3 border-t border-[var(--border-subtle)]' },
          h('div', { class: 'text-xs font-medium text-[var(--text-muted)] mb-1.5' }, '简介'),
          current.description
            ? h('div', { class: 'text-sm leading-6 text-[var(--text-secondary)] max-h-36 overflow-y-auto pr-1 whitespace-pre-wrap' }, current.description)
            : h('div', { class: 'text-sm leading-6 text-[var(--text-muted)]' }, '暂无简介'),
        ),
      ),
      current.tags.length > 0 ? h('div', {},
        h('div', { class: 'text-xs text-[var(--text-muted)] mb-2' }, '标签'),
        h('div', { class: 'flex flex-wrap gap-2' },
          ...current.tags.map((t) => h('span', { class: 'px-2.5 py-1 rounded-full text-xs bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]' }, `#${t}`)),
        ),
      ) : null,
      // 自行填写的内容与上方属性块之间加分割线
      h('div', { class: 'flex items-center gap-3 pt-1' },
        h('div', { class: 'flex-1 border-t border-[var(--border-subtle)]' }),
        h('span', { class: 'text-xs text-[var(--text-muted)]' }, '我的记录'),
        h('div', { class: 'flex-1 border-t border-[var(--border-subtle)]' }),
      ),
      editableMemoBlock(current, 'notes', '笔记', 2000),
      editableMemoBlock(current, 'reason', '录入理由', 1000),
    );
  }

  // 底部固定操作栏：展示态（收藏/移入回收站贴左下 + 关闭/编辑）
  function renderDisplayFooter(current: Book) {
    footer.innerHTML = '';
    footer.append(h('div', { class: 'p-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3' },
      h('div', { class: 'flex items-center gap-2' },
        h('button', {
          class: 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ' +
            (current.favorite
              ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/40'
              : 'text-[var(--text-secondary)] border border-[var(--border-default)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40'),
          title: current.favorite ? '取消收藏' : '收藏',
          onclick: async () => {
            try {
              const next = current.favorite ? 0 : 1;
              await api.updateBook(current.id, { favorite: next });
              toast(current.favorite ? '已取消收藏' : '已收藏');
              current = { ...current, favorite: next };
              await refresh(false, false);
              renderDisplayFooter(current);
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          },
        }, iconStar(16), current.favorite ? '已收藏' : '收藏'),
        h('button', {
          class: 'px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm transition-colors',
          title: '移入回收站',
          onclick: async () => {
            const ok = await confirmDialog(`把《${current.title}》移入回收站？可随时恢复。`);
            if (!ok) return;
            try {
              await api.softDelete(current.id);
              close();
              toast('已移入回收站');
              await refresh();
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          },
        }, '移入回收站'),
      ),
      h('div', { class: 'flex gap-3' },
        h('button', { class: 'flex-1 px-4 py-2.5 border border-[var(--border-default)] rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors', onclick: close }, '关闭'),
        h('button', { class: 'flex-1 px-4 py-2.5 bg-[var(--accent)] text-[var(--accent-text)] rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors', onclick: () => enterEdit(current) }, '编辑'),
      ),
    ));
  }

  function renderDisplay(current: Book) {
    content.innerHTML = '';
    renderDisplayFooter(current);
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
      editGrid2(editField('页数', els.pageCount), editField('副标题', els.subtitle)),
      editGrid2(editField('ISBN', els.isbn), editField('评分', els.rating)),
      editGrid2(editField('状态', els.statusSel), editField('分类', els.catSel)),
      editField('收藏', h('label', { class: 'inline-flex items-center gap-2 cursor-pointer w-fit' }, els.favorite, h('span', { class: 'text-sm text-[var(--text-secondary)]' }, '加入收藏'))),
      editField('标签', els.tags),
      editField('封面 URL', els.coverUrl),
      editField('简介', els.description),
      editField('笔记', els.notes),
      editField('录入理由', els.reason),
    );

    // 编辑态底部操作栏：取消 / 保存
    footer.innerHTML = '';
    footer.append(h('div', { class: 'p-4 pt-3 border-t border-[var(--border-subtle)] flex gap-3' },
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
            await refresh(false, false);
            renderDisplay(updated);
          } catch (e) {
            toast((e as Error).message, 'error');
          }
        },
      }, '保存'),
    ));

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