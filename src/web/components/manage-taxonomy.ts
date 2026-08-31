// 分类 / 标签管理：新增、删除、改名（复用 /api/categories、/api/tags）
// 以内联方式渲染进侧栏分区（替代弹窗），避免 UI 推挤：
// - 进入编辑态后，列表内条目带「改名/删除」操作；
// - 列表末尾出现一个「待命名」新增行，命名后回车/保存即创建，为空则忽略（退出时撤回归位）；
// - 行高固定、就地置换，不改动侧栏整体高度。
import { api } from '../api';
import { state } from '../state';
import { h, toast, iconPlus, iconEdit, iconTrash } from '../ui';
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

// 内联编辑态下的单个条目行（固定高度，就地置换，不做重排，避免 UI 推挤）
function row(kind: Kind, item: { id: number; name: string; count: number; color?: string }, rebuild: () => void): HTMLElement {
  const input = h('input', {
    type: 'text',
    value: item.name,
    maxlength: kind === 'category' ? 30 : 20,
    class: 'flex-1 min-w-0 px-2 py-1 text-sm bg-[var(--bg-page)] border border-[var(--border-subtle)] rounded-lg focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 focus:outline-none text-[var(--text-primary)] transition-colors',
  });
  const enterSave = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } };
  input.addEventListener('keydown', enterSave);

  const iconBtn = (icon: HTMLElement, title: string, cls: string, onclick: () => void) =>
    h('button', {
      class: `flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors ${cls}`,
      title,
      onclick,
    }, icon);

  const saveName = async () => {
    const name = input.value.trim();
    if (!name) { toast('名称不能为空', 'error'); return; }
    if (name === item.name) return;
    try {
      if (kind === 'category') await api.updateCategory(item.id, { name });
      else await api.updateTag(item.id, name);
      toast('已改名');
      await afterChange();
      rebuild();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const confirmName = `确定删除${kind === 'category' ? '分类' : '标签'}「${item.name}」吗？关联的${kind === 'category' ? '书籍将变为未分类' : '书籍标签将被移除'}。`;
  const del = async () => {
    if (!confirm(confirmName)) return;
    try {
      if (kind === 'category') await api.deleteCategory(item.id);
      else await api.deleteTag(item.id);
      toast(`已删除「${item.name}」`);
      await afterChange();
      rebuild();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return h('div', { class: 'flex items-center gap-2 px-2 py-1.5 rounded-xl border border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]/60 transition-colors' },
    kind === 'category'
      ? h('span', { class: 'w-3 h-3 rounded-md shrink-0 ring-1 ring-black/10', style: `background:${item.color ?? '#8a8274'}` })
      : h('span', { class: 'text-[var(--accent)] text-xs font-bold shrink-0' }, '#'),
    input,
    h('span', { class: 'text-[11px] text-[var(--text-muted)] font-mono shrink-0 tabular-nums', title: '关联书籍数' }, String(item.count ?? 0)),
    iconBtn(iconEdit(14), '保存改名', 'text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10', saveName),
    iconBtn(iconTrash(14), '删除', 'text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10', del),
  );
}

// 列表末尾的「待命名」新增行：命名后回车/保存创建；为空则忽略
function newRow(kind: Kind, rebuild: () => void): HTMLElement {
  const input = h('input', {
    type: 'text',
    placeholder: kind === 'category' ? '新分类名称…' : '新标签名称…',
    maxlength: kind === 'category' ? 30 : 20,
    class: 'flex-1 min-w-0 px-1.5 py-1 text-sm bg-transparent placeholder:text-[var(--text-muted)] outline-none text-[var(--text-primary)]',
  });
  const create = async () => {
    const name = input.value.trim();
    if (!name) { toast('请输入名称', 'error'); return; }
    try {
      if (kind === 'category') {
        const color = CATEGORY_COLORS[state.categories.length % CATEGORY_COLORS.length];
        await api.createCategory(name, color!);
      } else {
        await api.createTag(name);
      }
      toast('已新增');
      await afterChange();
      rebuild();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void create(); } });
  const previewColor = CATEGORY_COLORS[state.categories.length % CATEGORY_COLORS.length];
  return h('div', { class: 'flex items-center gap-2 px-2 py-1.5 rounded-xl border border-dashed border-[var(--border-subtle)] opacity-90 hover:opacity-100 transition-opacity' },
    h('span', {
      class: kind === 'category' ? 'w-3 h-3 rounded-md shrink-0 ring-1 ring-black/10' : 'text-[var(--accent)] text-xs font-bold shrink-0',
      style: kind === 'category' ? `background:${previewColor}66` : undefined,
    }, kind === 'tag' ? '#' : undefined),
    input,
    h('button', {
      class: 'flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] shrink-0 transition-colors',
      title: '保存新增',
      onclick: () => void create(),
    }, iconPlus(14)),
  );
}

// 在侧栏分区容器内渲染内联编辑管理 UI；容器由侧栏按需创建（避免推挤）
export function renderTaxonomyManage(kind: Kind, container: HTMLElement): void {
  const rebuild = () => {
    const items = listOf(kind);
    container.replaceChildren(
      ...items.map((it) => row(kind, it, rebuild)),
      newRow(kind, rebuild),
    );
  };
  rebuild();
}