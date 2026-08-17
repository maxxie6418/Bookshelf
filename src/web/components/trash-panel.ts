// 回收站视图：恢复 / 彻底删除（二次确认）/ 清空
import { api } from '../api';
import { state } from '../state';
import type { Book } from '../types';
import { h, toast, confirmDialog, iconTrash } from '../ui';
import { refresh } from '../refresh';

export function renderTrash(container: HTMLElement) {
  container.replaceChildren();
  const main = h('div', { class: 'p-4 sm:p-6 lg:p-8' });

  const clearBtn = h('button', {
    class: 'px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors',
    onclick: async () => {
      if (state.books.length === 0) return;
      const ok = await confirmDialog(`确定清空回收站（${state.books.length} 本）？此操作不可恢复！`);
      if (!ok) return;
      try {
        await api.clearTrash();
        toast('回收站已清空');
        await refresh();
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    },
  }, '清空回收站');

  main.append(
    h('div', { class: 'flex items-center justify-between mb-4' },
      h('div', { class: 'flex items-center gap-3' },
        h('h2', { class: 'text-lg font-semibold font-display text-[var(--text-primary)]' }, '回收站'),
        h('span', { class: 'text-sm text-[var(--text-muted)]' }, `共 ${state.total} 本，彻底删除后不可恢复`),
      ),
      clearBtn,
    ),
  );

  const list = h('div', { class: 'space-y-2' });
  if (state.loading) {
    list.append(h('div', { class: 'text-center text-[var(--text-muted)] py-10' }, '加载中…'));
  } else if (!state.books.length) {
    list.append(
      h('div', { class: 'col-span-full flex flex-col items-center justify-center py-20 text-[var(--text-muted)]' },
        h('span', { class: 'mb-4 opacity-30' }, iconTrash(64)),
        h('p', { class: 'text-sm' }, '回收站是空的'),
      ),
    );
  } else {
    for (const b of state.books) {
      list.append(trashRow(b));
    }
  }
  main.append(list);
  container.append(main);
}

function trashRow(b: Book): HTMLElement {
  return h('div', { class: 'flex items-center gap-4 bg-[var(--bg-surface)] rounded-xl p-3.5 shadow-sm border border-[var(--border-default)]' },
    h('div', { class: 'flex-1 min-w-0' },
      h('p', { class: 'font-medium text-[var(--text-primary)] truncate' }, b.title),
      h('p', { class: 'text-xs text-[var(--text-secondary)] mt-0.5' }, `${b.author ?? ''}${b.deleted_at ? ' · 删除于 ' + new Date(b.deleted_at).toLocaleDateString() : ''}`),
    ),
    h('button', {
      class: 'px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm transition-colors',
      onclick: async () => {
        try {
          await api.restore(b.id);
          toast('已恢复');
          await refresh();
        } catch (e) {
          toast((e as Error).message, 'error');
        }
      },
    }, '恢复'),
    h('button', {
      class: 'px-3.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors',
      onclick: async () => {
        const ok = await confirmDialog(`彻底删除《${b.title}》？不可恢复！`);
        if (!ok) return;
        try {
          await api.permanentDelete(b.id);
          toast('已彻底删除');
          await refresh();
        } catch (e) {
          toast((e as Error).message, 'error');
        }
      },
    }, '彻底删除'),
  );
}