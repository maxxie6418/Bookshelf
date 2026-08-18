// 书单导入/导出：顶栏按钮、CSV 下载、导入预览（重复检测+勾选）+ 逐批进度导入
import { api } from '../api';
import { h, toast, modal, iconDownload, iconUpload } from '../ui';
import { refresh } from '../refresh';

const BATCH_SIZE = 20;

function downloadCsv(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportTemplate() {
  try {
    const csv = await api.exportTemplate();
    downloadCsv(csv, 'books-template.csv');
    toast('已下载模版');
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

async function exportBooks() {
  try {
    const csv = await api.exportBooks();
    downloadCsv(csv, `books-${new Date().toISOString().slice(0, 10)}.csv`);
    toast('已导出全部藏书');
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

interface PreviewRow {
  index: number;
  title: string;
  author: string | null;
  isbn: string | null;
  douban_url: string | null;
  valid: boolean;
  duplicate: boolean;
  matched: { id: number; title: string }[];
  fields: unknown;
}

// 顶部工具栏按钮：导出（下拉）+ 导入
export function renderImportExportButtons(): HTMLElement {
  const wrapper = h('div', { class: 'relative hidden sm:block' });
  const menu = h('div', {
    class: 'hidden absolute right-0 top-full mt-2 w-40 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-2xl p-1 z-40 text-left',
  },
    h('button', {
      class: 'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors',
      onclick: async () => { menu.classList.add('hidden'); await exportTemplate(); },
    }, '导出模版'),
    h('button', {
      class: 'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors',
      onclick: async () => { menu.classList.add('hidden'); await exportBooks(); },
    }, '导出内容'),
  );

  const exportBtn = h('button', {
    class: 'inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-surface-hover)] transition-all text-sm',
    title: '导出',
    onclick: (e: Event) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    },
  }, iconDownload(16), '导出');

  const file = h('input', {
    type: 'file',
    accept: '.csv,text/csv',
    class: 'hidden',
    onchange: async () => {
      const f = file.files?.[0];
      file.value = '';
      if (f) await openImportFlow(f);
    },
  });

  const importBtn = h('button', {
    class: 'inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-surface-hover)] transition-all text-sm',
    title: '导入 CSV',
    onclick: () => file.click(),
  }, iconUpload(16), '导入');

  const closeMenu = (e: Event) => { if (!wrapper.contains(e.target as Node)) menu.classList.add('hidden'); };
  document.addEventListener('click', closeMenu);

  wrapper.append(exportBtn, menu, importBtn, file);
  return wrapper;
}

// 导入流程：解析预览 → 选择 → 逐批写入（带进度）
async function openImportFlow(file: File) {
  const text = await file.text();
  let res;
  try {
    res = await api.importPreview(text);
  } catch (e) {
    toast((e as Error).message, 'error');
    return;
  }
  const rows = res.rows as PreviewRow[];
  if (!rows.length) {
    toast('CSV 中未解析到有效书籍（请检查表头）', 'error');
    return;
  }

  const sel = new Map<number, boolean>();
  rows.forEach((r, i) => sel.set(i, r.valid && !r.duplicate));

  let listEl: HTMLElement;
  const list = (): HTMLElement[] =>
    rows.map((r, i) => {
      const cb = h('input', { type: 'checkbox', class: 'w-4 h-4 accent-[var(--accent)] shrink-0', checked: sel.get(i) ? 'checked' : null });
      cb.onchange = () => sel.set(i, cb.checked);
      return h('label', { class: 'flex items-start gap-3 p-2.5 rounded-xl border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer' },
        cb,
        h('div', { class: 'min-w-0 flex-1' },
          h('div', { class: 'flex items-center gap-2' },
            h('span', { class: 'text-sm font-medium text-[var(--text-primary)] line-clamp-1' }, r.title || '(空书名)'),
            r.duplicate
              ? h('span', { class: 'shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600' }, '重复')
              : h('span', { class: 'shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600' }, '新增'),
          ),
          h('div', { class: 'text-xs text-[var(--text-muted)] mt-0.5 truncate' },
            [r.author, r.isbn, r.douban_url].filter(Boolean).join(' · ') || '—'),
        ),
        r.duplicate && r.matched.length
          ? h('div', { class: 'text-[11px] text-[var(--text-muted)] shrink-0 max-w-[8rem] truncate' },
            `已存在：${r.matched.map((m) => m.title).join('、')}`)
          : null,
      );
    });

  listEl = h('div', { class: 'space-y-2 max-h-[55vh] overflow-y-auto pr-1' });
  const renderList = () => { listEl.replaceChildren(...list()); };

  const summary = h('div', { class: 'text-sm text-[var(--text-secondary)] mb-3' },
    `共 ${rows.length} 行 · 有效 ${res.summary.valid} · 重复 ${res.summary.duplicate} · `,
    h('button', {
      class: 'underline text-[var(--accent)]',
      onclick: () => {
        const allChecked = rows.every((_, i) => sel.get(i));
        rows.forEach((_, i) => sel.set(i, !allChecked));
        renderList();
      },
    }, '全选/全不选'),
  );
  renderList();

  const hint = h('div', { class: 'text-xs text-[var(--text-muted)] mt-2' },
    '默认勾选「新增」项；勾选「重复」项会新建一条（同名也可）。勾选后点「确认导入」。');

  // 进度
  const barWrap = h('div', { class: 'hidden mt-3' },
    h('div', { class: 'flex justify-between text-xs text-[var(--text-muted)] mb-1' },
      h('span', { id: 'ip-progress-text' }, '导入中…'),
      h('span', { id: 'ip-progress-pct' }, '0%'),
    ),
    h('div', { class: 'h-2 rounded-full bg-[var(--bg-surface-hover)] overflow-hidden' },
      h('div', { id: 'ip-progress-bar', class: 'h-full bg-[var(--accent)] transition-all duration-200', style: 'width:0%' }),
    ),
  );

  let importing = false;
  const confirmBtn = h('button', {
    class: 'px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition-colors',
    onclick: async () => {
      if (importing) return;
      const chosen = rows.filter((_, i) => sel.get(i) && rows[i].valid);
      if (!chosen.length) { toast('请至少勾选一项', 'error'); return; }
      importing = true;
      confirmBtn.disabled = true;
      barWrap.classList.remove('hidden');
      const bar = barWrap.querySelector('#ip-progress-bar') as HTMLElement;
      const pct = barWrap.querySelector('#ip-progress-pct') as HTMLElement;
      const txt = barWrap.querySelector('#ip-progress-text') as HTMLElement;
      let done = 0;
      try {
        for (let i = 0; i < chosen.length; i += BATCH_SIZE) {
          const batch = chosen.slice(i, i + BATCH_SIZE).map((r) => r.fields);
          await api.importBatch(batch);
          done += batch.length;
          const p = Math.round((done / chosen.length) * 100);
          bar.style.width = `${p}%`;
          pct.textContent = `${p}%`;
          txt.textContent = `已导入 ${done}/${chosen.length}`;
        }
        toast(`导入完成：${done} 本`);
        overlay.remove();
        await refresh();
      } catch (e) {
        txt.textContent = `导入中断：${(e as Error).message}`;
        confirmBtn.disabled = false;
        importing = false;
      }
    },
  }, '确认导入');

  const cancelBtn = h('button', {
    class: 'px-4 py-2 rounded-xl border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors',
    onclick: () => overlay.remove(),
  }, '取消');

  const closeBtn = h('div', { class: 'flex gap-3 mt-4' }, cancelBtn, confirmBtn);
  const content = h('div', { class: 'space-y-3' }, summary, listEl, hint, barWrap, closeBtn);

  const overlay = modal('导入书单（预览）', content);
  overlay.id = 'import-overlay';
}