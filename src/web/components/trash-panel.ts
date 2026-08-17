// 回收站视图：恢复 / 彻底删除（二次确认）/ 清空
import { api } from '../api';
import { state } from '../state';
import type { Book } from '../types';
import { h, toast, confirmDialog } from '../ui';
import { refresh } from '../refresh';

export function renderTrash(container: HTMLElement) {
  container.replaceChildren();
  const main = h('div', { class: 'p-4 lg:p-6' });

  const clearBtn = h('button', {
    class: 'px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm',
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
      h('h2', { class: 'text-lg font-semibold text-shelf-900 dark:text-shelf-50' }, '回收站'),
      clearBtn,
    ),
    h('p', { class: 'text-sm text-shelf-500 dark:text-shelf-400 mb-4' }, `共 ${state.total} 本，彻底删除后不可恢复`),
  );

  const list = h('div', { class: 'space-y-2' });
  if (state.loading) {
    list.append(h('div', { class: 'text-center text-shelf-400 py-10' }, '加载中…'));
  } else if (!state.books.length) {
    list.append(h('div', { class: 'text-center text-shelf-400 py-10' }, '回收站是空的'));
  } else {
    for (const b of state.books) {
      list.append(trashRow(b));
    }
  }
  main.append(list);
  container.append(main);
}

function trashRow(b: Book): HTMLElement {
  const row = h('div', { class: 'flex items-center gap-4 bg-white dark:bg-shelf-800 rounded-xl p-3.5 shadow-sm' },
    h('div', { class: 'flex-1 min-w-0' },
      h('p', { class: 'font-medium text-shelf-900 dark:text-shelf-50 truncate' }, b.title),
      h('p', { class: 'text-xs text-shelf-500 mt-0.5' }, `${b.author ?? ''}${b.deleted_at ? ' · 删除于 ' + b.deleted_at : ''}`),
    ),
    h('button', {
      class: 'px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm',
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
      class: 'px-3.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm',
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
  return row;
}