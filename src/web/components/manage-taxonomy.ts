// 分类 / 标签管理：新增、删除、改名（复用 /api/categories、/api/tags）
import { api } from '../api';
import { state } from '../state';
import { h, toast, modal, iconPlus, iconEdit, iconTrash } from '../ui';
import { refresh, refreshSidebar } from '../refresh';

type Kind = 'category' | 'tag';

const CATEGORY_COLORS = ['#8b5cf6', '#06b6d4', '#f97316', '#10b981', '#ef4444', '#3b82f6', '#eab308', '#ec4899'];

function listOf(kind: Kind): { id: number; name: string; count: number; color?: string }[] {
  return kind === 'category'
    ? state.categories.map((c) => ({ id: c.id, name: c.name, count: c.count, color: c.color }))
    : state.tags.map((t) => ({ id: t.id, name: t.name, count: t.count }));
}

async function afterChange() {
  await refreshSidebar();
  await refresh();
}

// 单个条目行：名称（编辑）+ 该条目计数 + 保存改名 + 删除
function row(kind: Kind, item: { id: number; name: string; count: number; color?: string }): HTMLElement {
  const input = h('input', {
    type: 'text',
    value: item.name,
    maxlength: kind === 'category' ? 30 : 20,
    class: 'flex-1 min-w-0 px-2.5 py-1.5 text-sm bg-transparent border border-transparent rounded-lg focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/40 outline-none text-[var(--text-primary)] transition-colors',
  });

  const deleteBtn = h('button', {
    class: 'p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors',
    title: '删除',
    onclick: async () => {
      if (!confirm(`确定删除${kind === 'category' ? '分类' : '标签'}「${item.name}」吗？`)) return;
      try {
        if (kind === 'category') await api.deleteCategory(item.id);
        else await api.deleteTag(item.id);
        toast(`已删除「${item.name}」`);
        await afterChange();
        renderList();
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    },
  }, iconTrash(16));

  const editBtn = h('button', {
    class: 'p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors',
    title: '保存改名',
    onclick: async () => {
      const name = input.value.trim();
      if (!name) { toast('名称不能为空', 'error'); return; }
      if (name === item.name) return;
      try {
        if (kind === 'category') await api.updateCategory(item.id, { name });
        else await api.updateTag(item.id, name);
        toast('已改名');
        await afterChange();
        renderList();
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    },
  }, iconEdit(16));

  const nameWrap = h('div', { class: 'flex-1 min-w-0 flex items-center gap-2' },
    kind === 'category'
      ? h('span', { class: 'w-2.5 h-2.5 rounded-sm shrink-0', style: `background:${item.color ?? '#8a8274'}` })
      : h('span', { class: 'text-[var(--accent)] shrink-0' }, '#'),
    input,
  );

  const count = h('span', { class: 'text-xs text-[var(--text-muted)] font-mono shrink-0' }, String(item.count));

  // 重名校验提示由后端返回错误
  return h('div', { class: 'flex items-center gap-1.5 p-2 rounded-xl border border-[var(--border-default)]' },
    nameWrap,
    count,
    editBtn,
    deleteBtn,
  );
}

let overlay: HTMLElement | null = null;
let currentKind: Kind = 'category';

function renderList() {
  const listEl = document.getElementById('tax-list');
  if (!listEl) return;
  const items = listOf(currentKind);
  listEl.replaceChildren(...items.map((it) => row(currentKind, it)));
}

function openManage(kind: Kind) {
  currentKind = kind;

  const title = kind === 'category' ? '管理分类' : '管理标签';

  const nameInput = h('input', {
    type: 'text',
    placeholder: kind === 'category' ? '新分类名称' : '新标签名称',
    maxlength: kind === 'category' ? 30 : 20,
    class: 'flex-1 min-w-0 px-3 py-2 text-sm bg-[var(--bg-page)] border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] outline-none text-[var(--text-primary)]',
  });

  const addBtn = h('button', {
    class: 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition-colors shrink-0',
    onclick: async () => {
      const name = nameInput.value.trim();
      if (!name) { toast('请输入名称', 'error'); return; }
      try {
        if (kind === 'category') {
          const color = kind === 'category' ? CATEGORY_COLORS[state.categories.length % CATEGORY_COLORS.length] : undefined;
          await api.createCategory(name, color!);
        } else {
          await api.createTag(name);
        }
        nameInput.value = '';
        toast('已新增');
        await afterChange();
        renderList();
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    },
  }, iconPlus(16), '新增');

  const addRow = h('div', { class: 'flex items-center gap-2 mb-4' }, nameInput, addBtn);

  const listEl = h('div', { id: 'tax-list', class: 'space-y-2 max-h-[55vh] overflow-y-auto pr-1' });

  const content = h('div', null, addRow, listEl);

  const onClose = () => { overlay = null; };
  overlay = modal(title, content, onClose);
  renderList();
}

export function openManageCategories() {
  openManage('category');
}

export function openManageTags() {
  openManage('tag');
}