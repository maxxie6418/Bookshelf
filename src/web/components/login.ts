import { api } from '../api';
import { setState } from '../state';
import { h, toast } from '../ui';

export function renderLogin(root: HTMLElement) {
  root.replaceChildren();
  const wrap = h('div', { class: 'min-h-screen flex items-center justify-center bg-shelf-50 dark:bg-shelf-900 p-4' });

  const err = h('p', { class: 'text-red-600 dark:text-red-400 text-sm mt-3' });
  const pwd = h('input', {
    type: 'password',
    placeholder: '输入口令',
    class: 'w-full px-4 py-2.5 rounded-xl border border-shelf-200 dark:border-shelf-700 dark:bg-shelf-900 dark:text-shelf-50 focus:outline-none focus:ring-2 focus:ring-amber-500',
  });

  // 首登强改口令步骤
  const newPwd = h('input', { type: 'password', placeholder: '新口令（至少 6 位）', class: 'w-full px-4 py-2.5 rounded-xl border border-shelf-200 dark:border-shelf-700 dark:bg-shelf-900 dark:text-shelf-50 focus:outline-none focus:ring-2 focus:ring-amber-500' });
  const newPwd2 = h('input', { type: 'password', placeholder: '再次输入新口令', class: 'w-full px-4 py-2.5 mt-3 rounded-xl border border-shelf-200 dark:border-shelf-700 dark:bg-shelf-900 dark:text-shelf-50 focus:outline-none focus:ring-2 focus:ring-amber-500' });
  const changeStep = h('div', { class: 'mt-6 border-t pt-6 hidden dark:border-shelf-700' },
    h('p', { class: 'text-sm text-amber-600 dark:text-amber-400 mb-3' }, '首次登录，请设置新口令：'),
    newPwd, newPwd2,
    h('button', {
      class: 'w-full mt-4 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium',
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

  const card = h('div', { class: 'bg-white dark:bg-shelf-800 rounded-2xl shadow-2xl w-full max-w-sm p-8' },
    // Logo
    h('div', { class: 'flex items-center justify-center gap-2.5 mb-6' },
      h('div', { class: 'w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg' },
        h('svg', { class: 'w-5 h-5 text-white', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
          h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }),
        ),
      ),
      h('h1', { class: 'text-2xl font-serif font-bold text-shelf-900 dark:text-shelf-50' }, '我的书架'),
    ),
    h('p', { class: 'text-sm text-shelf-500 dark:text-shelf-400 text-center mb-6' }, '个人书单管理'),
    h('label', { class: 'block text-sm text-shelf-600 dark:text-shelf-300 mb-1.5' }, '口令'),
    pwd,
    h('button', {
      class: 'w-full mt-4 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium',
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
