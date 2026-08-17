import { api } from '../api';
import { setState } from '../state';
import { h, toast, iconBook } from '../ui';

export function renderLogin(root: HTMLElement) {
  root.replaceChildren();
  const wrap = h('div', { class: 'min-h-screen flex items-center justify-center bg-[var(--bg-page)] p-4' });

  const err = h('p', { class: 'text-red-600 dark:text-red-400 text-sm mt-3' });
  const pwd = h('input', {
    type: 'password',
    placeholder: '输入口令',
    class: 'w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 placeholder:text-[var(--text-muted)]',
  });

  // 首登强改口令步骤
  const newPwd = h('input', { type: 'password', placeholder: '新口令（至少 6 位）', class: 'w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 placeholder:text-[var(--text-muted)]' });
  const newPwd2 = h('input', { type: 'password', placeholder: '再次输入新口令', class: 'w-full px-4 py-2.5 mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 placeholder:text-[var(--text-muted)]' });
  const changeStep = h('div', { class: 'mt-6 border-t border-[var(--border-subtle)] pt-6 hidden' },
    h('p', { class: 'text-sm text-[var(--accent)] mb-3' }, '首次登录，请设置新口令：'),
    newPwd, newPwd2,
    h('button', {
      class: 'w-full mt-4 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition-colors',
      onclick: async () => {
        if (newPwd.value.length < 6 || newPwd.value !== newPwd2.value) {
          err.textContent = '口令至少 6 位且两次输入一致';
          err.classList.remove('hidden');
          return;
        }
        try {
          await api.changePassword(newPwd.value);
          toast('口令已更新');
          setState({ authed: true, user: { ...stateUser(), must_change_password: false } });
        } catch (e) {
          err.textContent = (e as Error).message;
          err.classList.remove('hidden');
        }
      },
    }, '保存并进入'),
  );

  const doLogin = async () => {
    err.classList.add('hidden');
    try {
      const user = await api.login(pwd.value);
      if (user.must_change_password) {
        changeStep.classList.remove('hidden');
        toast('首次登录，请先设置新口令', 'success');
      } else {
        setState({ authed: true, user });
      }
    } catch (e) {
      err.textContent = (e as Error).message;
      err.classList.remove('hidden');
    }
  };
  pwd.addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());

  const card = h('div', { class: 'bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-sm p-8 border border-[var(--border-default)]' },
    // Logo
    h('div', { class: 'flex items-center justify-center gap-2.5 mb-6' },
      h('div', { class: 'w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center shadow-lg' },
        iconBook(24),
      ),
      h('h1', { class: 'text-2xl font-display font-bold text-[var(--text-primary)]' }, '我的书架'),
    ),
    h('p', { class: 'text-sm text-[var(--text-secondary)] text-center mb-6' }, '个人书单管理'),
    h('label', { class: 'block text-sm text-[var(--text-secondary)] mb-1.5' }, '口令'),
    pwd,
    h('button', {
      class: 'w-full mt-4 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition-colors',
      onclick: doLogin,
    }, '登录'),
    err,
    changeStep,
  );

  wrap.append(card);
  root.append(wrap);
  pwd.focus();
}

// 状态里缓存的 user（changePassword 成功后需要）
import { state } from '../state';
function stateUser() {
  return state.user ?? { id: 0, username: null, display_name: null, is_admin: true, must_change_password: true };
}