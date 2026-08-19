// 设置面板：修改口令 / 数据管理（导入导出 / 回收站）
import { api } from '../api';
import { setState, state } from '../state';
import { h, toast, modal, iconTrash, iconCopy, confirmDialog } from '../ui';
import { renderImportExportButtons } from './import-export';
import { refresh } from '../refresh';

const inputCls = 'w-full px-3.5 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 placeholder:text-[var(--text-muted)] transition-colors';

// 预置①：发给外部 AI 的系统提示词（接入说明）
const PROMPT_SETUP = `你是一个帮我管理个人书架（Bookshelf）的助手，可通过 HTTP 调用我的书架 API 来查询和管理藏书。

接口 Base URL（将「你的部署地址」替换为你的实际域名，其余路径固定）：
- 你的部署地址/api/agent

鉴权（Bearer Key，每个请求都必须带）：
Authorization: Bearer <你的 Agent Key>

可用端点：
- GET  /books          查询书籍，可选参数：status=unread|reading|finished、q 关键词、tag、category_id、sort、limit、offset
- GET  /books/:id      查看单本详情
- GET  /categories     分类列表（只读）
- GET  /tags           标签列表（只读）
- POST /books          新增书籍
- PATCH /books/:id     编辑书籍
- DELETE /books/:id    删除书籍（移入回收站）
- GET  /export/books   导出全部藏书为 CSV

请礼貌、简洁地完成任务；当用户需要查询、整理或管理书单时，直接调用上述接口。`;

// 预置②：连接后具备的能力说明
const PROMPT_CAPS = `连接后，本 AI 助手具备以下能力：

一、查询
- 按状态（未读 / 在读 / 读完）、关键词、分类、标签、评分等筛选书籍
- 查看任意单本书籍详情
- 将全部藏书导出为 CSV

二、管理
- 新增书籍：书名、作者、译者、出版社、出版年、页数、ISBN、简介、记录/笔记（≤2000 字）、录入理由（≤1000 字）、封面、豆瓣链接、评分、状态、分类、标签等
- 编辑书籍：可修改任意字段
- 删除书籍：移入回收站（软删除）

三、限制与约束
- 写操作限频 10 次 / 10 分钟；删除操作加严为 10 次 / 1 小时
- 分类与标签为只读（AI 不能新建、改名或删除）
- 禁止一切回收站操作（不能恢复、彻底删除或清空回收站）`;

interface AgentKey {
  hash: string;
  label: string;
  created_at: string;
  prefix: string;
  suffix?: string;
  last_used_at?: string | null;
}

// 掩码展示：前 4 位 + 星号 + 后 4 位（老 key 无后 4 位则仅前 4 位 + 星号）
function maskKey(k: { prefix: string; suffix?: string }): string {
  const stars = '•'.repeat(8);
  return `${k.prefix}${stars}${k.suffix ?? ''}`;
}

function formatTime(t?: string | null): string {
  if (!t) return '从未使用';
  return new Date(t).toLocaleString();
}

// 新 Key 明文：独立锁定模态，不点「我已保存，关闭」不会消失，可随时复制
function showKeyPlaintext(plain: string, label: string) {
  const overlay = h('div', { class: 'fixed inset-0 z-50 bg-[var(--overlay-bg)] flex items-center justify-center p-4 opacity-0 transition-all duration-300 ease-[var(--ease-out-expo)]' });
  const copyBtn = h('button', {
    class: 'flex-1 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition-colors',
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(plain);
        copyBtn.textContent = '已复制 ✓';
        toast('Key 已复制');
      } catch {
        (codeTag as HTMLInputElement).select();
        toast('自动复制失败，已全选，请按 Ctrl/Cmd+C', 'error');
      }
    },
  }, '复制');
  const codeTag = h('code', {
    class: 'block break-all select-all bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-sm font-mono text-[var(--text-primary)]',
    textContent: plain,
  });
  const done = h('button', {
    class: 'flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors',
    onclick: () => overlay.remove(),
  }, '我已保存，关闭');
  const box = h('div', { class: 'bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-xl p-6 border border-[var(--border-accent)] dark:border-[var(--border-default)] opacity-0 scale-95 transition-all duration-300 ease-[var(--ease-out-expo)]' },
    h('div', { class: 'flex items-center justify-between mb-3' },
      h('h2', { class: 'text-lg font-semibold text-[var(--text-primary)]' }, 'Key 已生成'),
    ),
    h('p', { class: 'text-sm text-[var(--text-secondary)] mb-3' },
      `「${label || '未命名'}」的明文只在此显示以便复制；关闭后可在下方列表中随时再次复制（显示前 4 与后 4 位，中间隐藏）：`),
    codeTag,
    h('div', { class: 'flex gap-3 mt-4' }, copyBtn, done),
  );
  overlay.append(box);
  overlay.addEventListener('click', (e) => { if (e.target === overlay && box.contains(done)) return; });
  document.body.append(overlay);
  requestAnimationFrame(() => {
    overlay.classList.remove('opacity-0');
    box.classList.remove('opacity-0', 'scale-95');
    box.classList.add('opacity-100', 'scale-100');
  });
}

// 预置提示词 / 能力说明块：可一键复制后发给外部 AI
function copyablePrompt(title: string, body: string): HTMLElement {
  const copyBtn = h('button', {
    class: 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent)] transition-colors shrink-0',
    title: '复制全部内容',
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(body);
        copyBtn.textContent = '已复制 ✓';
        toast('已复制，可粘贴发给 AI');
        setTimeout(() => { copyBtn.textContent = '复制'; }, 1500);
      } catch {
        toast('复制失败，请手动选择复制', 'error');
      }
    },
  }, '复制');
  return h('div', { class: 'rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden' },
    h('div', { class: 'flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-subtle)]' },
      h('div', { class: 'text-xs font-medium text-[var(--text-primary)]' }, title),
      copyBtn,
    ),
    h('pre', { class: 'px-3 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap font-sans max-h-48 overflow-y-auto' }, body),
  );
}

async function renderAgentKeysSection(container: HTMLElement) {
  let keys: AgentKey[] = [];
  const refresh = async () => {
    try {
      keys = await api.listAgentKeys();
    } catch {
      keys = [];
    }
    render();
  };

  const render = () => {
    container.replaceChildren();
    const items = keys.length
      ? h('ul', { class: 'space-y-2' },
          ...keys.map((k) =>
            h('li', { class: 'flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] px-3 py-2' },
              h('div', { class: 'min-w-0' },
                h('div', { class: 'flex items-center gap-2 text-sm text-[var(--text-primary)]' },
                  h('span', {}, k.label || '未命名'),
                  h('code', { class: 'text-xs text-[var(--text-muted)] font-mono' }, maskKey(k)),
                ),
                h('div', { class: 'text-xs text-[var(--text-muted)] mt-0.5' },
                  `创建于 ${new Date(k.created_at).toLocaleString()} · 上次使用：${formatTime(k.last_used_at)}`),
              ),
              h('div', { class: 'flex items-center gap-1 shrink-0' },
                h('button', {
                  class: 'p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-surface-hover)] transition-colors',
                  title: '复制此 Key（明文）',
                  onclick: async (e: Event) => {
                    if (!k.suffix) {
                      toast('该 Key 为历史版本，无法回显明文，请重新生成', 'error');
                      return;
                    }
                    const btn = e.currentTarget as HTMLElement;
                    btn.style.opacity = '0.6';
                    try {
                      const { key } = await api.revealAgentKey(k.hash);
                      await navigator.clipboard.writeText(key);
                      btn.style.opacity = '1';
                      toast('已复制完整 Key');
                    } catch (err) {
                      btn.style.opacity = '1';
                      toast((err as Error).message, 'error');
                    }
                  },
                }, iconCopy(16)),
                h('button', {
                  class: 'p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--bg-surface-hover)] transition-colors',
                  title: '撤销此 Key',
                  onclick: async () => {
                    if (!(await confirmDialog(`撤销后该 Key 立即失效且无法恢复，确定撤销「${k.label || '未命名'}」？`))) return;
                    try {
                      await api.revokeAgentKey(k.hash);
                      toast('已撤销该 Key');
                      await refresh();
                    } catch (e) {
                      toast((e as Error).message, 'error');
                    }
                  },
                }, iconTrash(16)),
              ),
            ),
          ),
        )
      : h('p', { class: 'text-sm text-[var(--text-muted)]' }, '暂无活跃 Key');

    const label = h('input', { type: 'text', placeholder: '给 Key 起个名字（可选）', class: inputCls + ' flex-1' });
    const addBtn = h('button', {
      class: 'px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition-colors shrink-0',
      onclick: async () => {
        if (keys.length >= 3) {
          toast('活跃 Key 已达上限（3 个），请先撤销一个', 'error');
          return;
        }
        try {
          const created = await api.createAgentKey(label.value);
          toast('Key 已创建，请复制保存；之后仍可在列表中再次复制');
          showKeyPlaintext(created.key, created.label || label.value || '未命名');
          label.value = '';
          await refresh();
        } catch (e) {
          toast((e as Error).message, 'error');
        }
      },
    }, '生成新 Key');

    container.append(
      h('div', { class: 'text-xs text-[var(--text-secondary)] mb-2 leading-relaxed' },
        '外部 AI 通过 Bearer Key 调用 /api/agent/* 管理书籍。下方两段预置内容可一键复制后发给你的 AI：'),
      copyablePrompt('① 系统提示词（接入说明）', PROMPT_SETUP),
      copyablePrompt('② 连接后具备的能力', PROMPT_CAPS),
      h('div', { class: 'text-xs text-[var(--text-secondary)] mb-3 leading-relaxed mt-3' },
        '供外部 AI Agent 以 HTTP 调用查询/新增/编辑/删除书籍。删除仅软删至回收站，禁止 AI 操作回收站。写操作限频 10 次/10 分钟，删除限频 10 次/1 小时。'),
      items,
      h('div', { class: 'flex gap-2 mt-3' }, label, addBtn),
    );
  };

  await refresh();
}

export function openAgentSettings() {
  const wrap = h('div', {});
  const content = h('div', { class: 'space-y-4' },
    h('h3', { class: 'text-sm font-medium text-[var(--text-primary)]' }, 'AI Agent Keys'),
    wrap,
  );
  modal('AI Agent 接入', content);
  void renderAgentKeysSection(wrap);
}

export function openSettings() {
  const oldPwd = h('input', { type: 'password', placeholder: '当前口令（可选校验）', class: inputCls });
  const newPwd = h('input', { type: 'password', placeholder: '新口令（至少 6 位）', class: inputCls + ' mt-3' });
  const newPwd2 = h('input', { type: 'password', placeholder: '再次输入新口令', class: inputCls + ' mt-3' });

  let overlay: HTMLElement = h('div', {});
  const openTrash = () => {
    overlay.remove();
    setState({ viewMode: 'trash' });
    void refresh();
  };

  const dataRow = h('div', { class: 'flex items-center gap-2' },
    renderImportExportButtons(),
    h('button', {
      class: 'inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors',
      title: '回收站（管理已删除的书籍）',
      onclick: openTrash,
    }, iconTrash(16), '回收站'),
  );

  const content = h('div', { class: 'space-y-5' },
    h('div', {},
      h('h3', { class: 'text-sm font-medium text-[var(--text-primary)] mb-2' }, '修改口令'),
      oldPwd, newPwd, newPwd2,
      h('button', {
        class: 'mt-3 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition-colors',
        onclick: async () => {
          if (newPwd.value.length < 6 || newPwd.value !== newPwd2.value) {
            toast('新口令至少 6 位且两次一致', 'error');
            return;
          }
          try {
            await api.changePassword(newPwd.value);
            toast('口令已更新');
            setState({ user: state.user ? { ...state.user, must_change_password: false } : state.user });
          } catch (e) {
            toast((e as Error).message, 'error');
          }
        },
      }, '保存新口令'),
    ),
    h('div', {},
      h('h3', { class: 'text-sm font-medium text-[var(--text-primary)] mb-2' }, '数据管理'),
      dataRow,
      h('p', { class: 'text-xs text-[var(--text-secondary)] mt-2' }, '导出「模版」获取空白表头、「内容」导出全部藏书；导入支持 CSV，二次确认后写入。'),
    ),
    h('div', { class: 'text-xs text-[var(--text-secondary)] leading-relaxed' },
      h('h3', { class: 'text-sm font-medium text-[var(--text-primary)] mb-1' }, 'AI Agent'),
      h('p', {}, '外部 AI 通过 Bearer Key 调用 /api/agent/* 查询/新增/编辑/删除书籍，Key 在「Agent」面板管理，可随时复制完整明文。'),
      h('p', { class: 'mt-1' }, `当前登录：${state.user?.username ?? 'admin'}`),
    ),
  );

  overlay = modal('设置', content);
}

export function toggleTheme() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  setState({ theme: next });
  document.documentElement.classList.toggle('dark', next === 'dark');
  localStorage.setItem('bs-theme', next);
}

export function initTheme() {
  const saved = localStorage.getItem('bs-theme') as 'light' | 'dark' | null;
  const theme = saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  state.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}