// SPA 入口
import { api } from './api';
import { setState, state } from './state';
import { renderLogin } from './components/login';
import { mountAppShell } from './components/app-shell';
import { initTheme } from './components/settings-panel';

const root = document.getElementById('app') as HTMLElement;

async function boot() {
  initTheme();
  try {
    const user = await api.me();
    setState({ authed: true, user });
    mountAppShell(root);
  } catch {
    state.authed = false;
    renderLogin(root);
  }
}

void boot();
