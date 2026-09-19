// SPA 入口
// 字体策略（v1.3 减负）：标题衬线 Noto Serif SC 只保留 700 一个字重（600 请求回落 700）；
// 等宽场景改用系统等宽字体栈（见 style.css .font-mono / tailwind mono），不再打包 JetBrains Mono。
// 构建（vite 插件）剔除 @fontsource CSS 中的 .woff 回退，只发 woff2。
import '@fontsource/noto-serif-sc/700.css';
import { api } from './api';
import { state, subscribe } from './state';
import { renderLogin } from './components/login';
import { mountAppShell } from './components/app-shell';
import { initTheme } from './components/settings-panel';
import { applyUrlState } from './refresh';

const root = document.getElementById('app') as HTMLElement;
let mounted = false;

function enterApp() {
  if (mounted) return;
  mounted = true;
  mountAppShell(root);
}

async function boot() {
  initTheme();
  applyUrlState(); // 从 URL 恢复视图/筛选/页码，再挂载并触发首次刷新
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