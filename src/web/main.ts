// SPA 入口
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/600.css';
import '@fontsource/noto-serif-sc/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import { api } from './api';
import { state, subscribe } from './state';
import { renderLogin } from './components/login';
import { mountAppShell } from './components/app-shell';
import { initTheme } from './components/settings-panel';

const root = document.getElementById('app') as HTMLElement;
let mounted = false;

function enterApp() {
  if (mounted) return;
  mounted = true;
  mountAppShell(root);
}

async function boot() {
  initTheme();
  try {
    const user = await api.me();
    state.authed = true;
    state.user = user;
    enterApp();
  } catch {
    state.authed = false;
    renderLogin(root);
  }
}

// 登录 / 首登改口令成功后，从登录页自动切换到应用外壳
subscribe(() => {
  if (state.authed) enterApp();
});

void boot();