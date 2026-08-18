// 设置面板：修改口令 / 暗色切换 / AI 配置说明 / AI Agent Keys 管理
import { api } from '../api';
import { setState, state } from '../state';
import { h, toast, modal, iconSun, iconMoon, iconTrash, confirmDialog } from '../ui';

const inputCls = 'w-full px-3.5 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 placeholder:text-[var(--text-muted)] transition-colors';

interface AgentKey {
  hash: string;
  label: string;
  created_at: string;
  prefix: string;
  last_used_at?: string | null;
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
      `「${label || '未命名'}」的明文只会显示这一次，关闭后无法再查看，请立即复制并妥善保存：`),
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
                  h('code', { class: 'text-xs text-[var(--text-muted)] font-mono' }, `${k.prefix}••••••••`),
                ),
                h('div', { class: 'text-xs text-[var(--text-muted)] mt-0.5' },
                  `创建于 ${new Date(k.created_at).toLocaleString()} · 上次使用：${formatTime(k.last_used_at)}`),
              ),
              h('button', {
                class: 'p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0',
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
          toast('Key 已创建，请立即复制保存（仅显示一次）');
          showKeyPlaintext(created.key, created.label || label.value || '未命名');
          label.value = '';
          await refresh();
        } catch (e) {
          toast((e as Error).message, 'error');
        }
      },
    }, '生成新 Key');

    container.append(
      h('div', { class: 'text-xs text-[var(--text-secondary)] mb-3 leading-relaxed' },
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

  const themeToggle = h('button', {
    class: 'inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors',
    onclick: () => toggleTheme(),
  }, state.theme === 'dark' ? iconSun(18) : iconMoon(18), state.theme === 'dark' ? '切换亮色' : '切换暗色');

  const agentKeysWrap = h('div', {});

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
      h('h3', { class: 'text-sm font-medium text-[var(--text-primary)] mb-2' }, '外观'),
      themeToggle,
    ),
    h('div', {},
      h('h3', { class: 'text-sm font-medium text-[var(--text-primary)] mb-2' }, 'AI Agent Keys'),
      agentKeysWrap,
    ),
    h('div', { class: 'text-xs text-[var(--text-secondary)] leading-relaxed' },
      h('h3', { class: 'text-sm font-medium text-[var(--text-primary)] mb-1' }, 'AI 查询'),
      h('p', {}, 'AI 查询（M4）使用 OpenAI 兼容接口，API Key 通过部署 secret 配置，本面板不收集密钥。'),
      h('p', { class: 'mt-1' }, `当前登录：${state.user?.username ?? 'admin'}`),
    ),
  );
  modal('设置', content);
  void renderAgentKeysSection(agentKeysWrap);
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