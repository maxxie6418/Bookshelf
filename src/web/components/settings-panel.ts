// 设置面板：修改口令 / 暗色切换 / AI 配置说明
import { api } from '../api';
import { setState, state } from '../state';
import { h, toast, modal } from '../ui';

export function openSettings() {
  const oldPwd = h('input', { type: 'password', placeholder: '当前口令（可选校验）', class: 'w-full px-3.5 py-2 rounded-xl border border-shelf-200 dark:border-shelf-700 dark:bg-shelf-900 dark:text-shelf-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500' });
  const newPwd = h('input', { type: 'password', placeholder: '新口令（至少 6 位）', class: 'w-full px-3.5 py-2 mt-3 rounded-xl border border-shelf-200 dark:border-shelf-700 dark:bg-shelf-900 dark:text-shelf-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500' });
  const newPwd2 = h('input', { type: 'password', placeholder: '再次输入新口令', class: 'w-full px-3.5 py-2 mt-3 rounded-xl border border-shelf-200 dark:border-shelf-700 dark:bg-shelf-900 dark:text-shelf-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500' });

  const themeToggle = h('button', {
    class: 'px-4 py-2 rounded-xl border border-shelf-200 dark:border-shelf-700 text-sm text-shelf-700 dark:text-shelf-200 hover:bg-shelf-50 dark:hover:bg-shelf-700 transition-colors',
    onclick: () => toggleTheme(),
  }, state.theme === 'dark' ? '☀️ 切换亮色' : '🌙 切换暗色');

  const content = h('div', { class: 'space-y-5' },
    h('div', {},
      h('h3', { class: 'text-sm font-medium text-shelf-900 dark:text-shelf-50 mb-2' }, '修改口令'),
      oldPwd, newPwd, newPwd2,
      h('button', {
        class: 'mt-3 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors',
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
      h('h3', { class: 'text-sm font-medium text-shelf-900 dark:text-shelf-50 mb-2' }, '外观'),
      themeToggle,
    ),
    h('div', { class: 'text-xs text-shelf-500 dark:text-shelf-400 leading-relaxed' },
      h('h3', { class: 'text-sm font-medium text-shelf-900 dark:text-shelf-50 mb-1' }, 'AI 查询'),
      h('p', {}, 'AI 查询（M4）使用 OpenAI 兼容接口，API Key 通过部署 secret 配置，本面板不收集密钥。'),
      h('p', { class: 'mt-1' }, `当前登录：${state.user?.username ?? 'admin'}`),
    ),
  );
  modal('设置', content);
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