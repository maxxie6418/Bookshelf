// 轻量 DOM 构建与通用 UI 组件

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, unknown> | null,
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K];
export function h(
  tag: string,
  attrs?: Record<string, unknown> | null,
  ...children: (Node | string | null | undefined)[]
): HTMLElement;
export function h(
  tag: string,
  attrs?: Record<string, unknown> | null,
  ...children: (Node | string | null | undefined)[]
): HTMLElement {
  const node = document.createElementNS(
    tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'rect' || tag === 'line' || tag === 'polyline' || tag === 'polygon' || tag === 'g' || tag === 'defs' || tag === 'clipPath' || tag === 'mask' || tag === 'linearGradient' || tag === 'radialGradient' || tag === 'stop' || tag === 'use' || tag === 'text' || tag === 'tspan' || tag === 'image' || tag === 'foreignObject'
      ? 'http://www.w3.org/2000/svg'
      : 'http://www.w3.org/1999/xhtml',
    tag,
  );
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.setAttribute('class', String(v));
      else if (k === 'html') node.innerHTML = String(v);
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else {
        node.setAttribute(k === 'viewBox' || k === 'strokeWidth' || k === 'strokeLinecap' || k === 'strokeLinejoin' ? k : k, v === true ? '' : String(v));
      }
    }
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node as HTMLElement;
}

export function toast(message: string, type: 'success' | 'error' = 'success') {
  let container = document.getElementById('toast-root');
  if (!container) {
    // 登录页等场景没有 toast 容器时自动创建
    container = h('div', { id: 'toast-root', class: 'fixed bottom-4 right-4 z-[60] space-y-2 pointer-events-none' });
    document.body.append(container);
  }
  const el = h(
    'div',
    {
      class:
        'pointer-events-auto max-w-sm w-full rounded-xl shadow-lg px-4 py-3 text-sm opacity-0 translate-y-2 transition-all duration-300 ease-[var(--ease-out-expo)] ' +
        (type === 'success'
          ? 'bg-[var(--accent)] text-[var(--accent-text)]'
          : 'bg-red-600 text-white'),
    },
    message,
  );
  container.append(el);
  requestAnimationFrame(() => {
    el.classList.remove('opacity-0', 'translate-y-2');
    el.classList.add('opacity-100', 'translate-y-0');
  });
  setTimeout(() => el.remove(), 2600);
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = h('div', {
      class: 'fixed inset-0 z-50 bg-[var(--overlay-bg)] flex items-center justify-center p-4 opacity-0 transition-all duration-300 ease-[var(--ease-out-expo)]',
    });
    const box = h(
      'div',
      { class: 'bg-[var(--bg-surface)] rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-[var(--border-default)] opacity-0 scale-95 transition-all duration-300 ease-[var(--ease-out-expo)]' },
      h('p', { class: 'text-[var(--text-primary)] font-medium mb-4' }, message),
      h(
        'div',
        { class: 'flex justify-end gap-3' },
        h(
          'button',
          {
            class: 'px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors',
            onclick: () => {
              overlay.remove();
              resolve(false);
            },
          },
          '取消',
        ),
        h(
          'button',
          {
            class: 'px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors',
            onclick: () => {
              overlay.remove();
              resolve(true);
            },
          },
          '确认',
        ),
      ),
    );
    overlay.append(box);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
    document.body.append(overlay);
    requestAnimationFrame(() => {
      overlay.classList.remove('opacity-0');
      box.classList.remove('opacity-0', 'scale-95');
      box.classList.add('opacity-100', 'scale-100');
    });
  });
}

// ---------- 统一 SVG 图标 ----------
const ICON_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: '20',
  height: '20',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.5',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

function svgIcon(paths: HTMLElement | HTMLElement[], size?: number): HTMLElement {
  const node = h('svg', {
    ...ICON_ATTRS,
    width: size ? String(size) : ICON_ATTRS.width,
    height: size ? String(size) : ICON_ATTRS.height,
  });
  for (const p of Array.isArray(paths) ? paths : [paths]) node.append(p);
  return node;
}

export function iconSun(size?: number) {
  return svgIcon(h('path', { d: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z' }), size);
}

export function iconMoon(size?: number) {
  return svgIcon(h('path', { d: 'M21.752 15.002A9.718 9.718 0 0 1 18 15.75 9.75 9.75 0 0 1 8.25 6c0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25 9.75 9.75 0 0 0 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z' }), size);
}

export function iconSettings(size?: number) {
  return svgIcon(h('path', { d: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' }), size);
}

export function iconLogout(size?: number) {
  return svgIcon(h('path', { d: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9' }), size);
}

export function iconTrash(size?: number) {
  return svgIcon(h('path', { d: 'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0' }), size);
}

export function iconSearch(size?: number) {
  return svgIcon(h('path', { d: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z' }), size);
}

export function iconKey(size?: number) {
  return svgIcon(h('path', { d: 'M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z' }), size);
}

export function iconPlus(size?: number) {
  return svgIcon(h('path', { d: 'M12 4.5v15m7.5-7.5h-15' }), size);
}

export function iconCopy(size?: number) {
  return svgIcon(h('path', { d: 'M15.75 17.25v3.375A1.875 1.875 0 0 1 13.875 22.5h-9.75A1.875 1.875 0 0 1 2.25 20.625v-9.75A1.875 1.875 0 0 1 4.125 9h3.375m6.75 0a1.875 1.875 0 0 1 1.875 1.875v7.5a1.875 1.875 0 0 0 1.875 1.875h3.375a1.875 1.875 0 0 0 1.875-1.875v-7.5a1.875 1.875 0 0 0-1.875-1.875H13.125a1.875 1.875 0 0 1-1.875-1.875V4.125A1.875 1.875 0 0 0 9.375 2.25h-3.75A1.875 1.875 0 0 0 3.75 4.125v13.5' }), size);
}

export function iconDownload(size?: number) {
  return svgIcon(h('path', { d: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3' }), size);
}

export function iconUpload(size?: number) {
  return svgIcon(h('path', { d: 'M12 16.5V9.75m0 0 3 3m-3-3-3 3M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5' }), size);
}

export function iconExternal(size?: number) {
  return svgIcon(h('path', { d: 'M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25' }), size);
}

// 品牌图标：填充式（不经过 stroke 封装的 svgIcon）
function brandIcon(size: number | undefined, inner: HTMLElement): HTMLElement {
  return h('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size ? String(size) : '20',
    height: size ? String(size) : '20',
    viewBox: '0 0 24 24',
    fill: 'currentColor',
  }, inner);
}

export function iconGithub(size?: number) {
  return brandIcon(size, h('path', {
    fillRule: 'evenodd',
    clipRule: 'evenodd',
    d: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z',
  }));
}

export function iconCloudflare(size?: number) {
  return brandIcon(size, h('path', {
    d: 'M11.55 3.1a3.55 3.55 0 0 1 3.5 2.93c.14-.03.29-.05.44-.05a4.1 4.1 0 0 1 2.98 1.35 4.05 4.05 0 0 1 1.02 3.14 4.35 4.35 0 0 1 1.02 8.09 4.2 4.2 0 0 1-1.78.39H7.86a5.2 5.2 0 0 1-3.84-1.7A5.22 5.22 0 0 1 4.1 14.1c-.06-.1-.11-.2-.16-.3a4.55 4.55 0 0 1-.04-5.09A4.55 4.55 0 0 1 7.6 6.4c.09 0 .18.01.27.02A5.64 5.64 0 0 1 11.55 3.1Z',
  }));
}

export function iconDouban(size?: number) {
  return brandIcon(size, h('path', {
    d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm2.09 6.38 1.8 2.4-1.35.06-.94-1.4-.34-.03v2.42l-.06.03-1.2-2.03h-1v1.5h-.8v-1.5H8.6v-1.9h2.4v-.73H8.6V6.8l2.4.19v1.02h1l.16-1.02h2.93v1.4Z',
  }));
}

export function iconEdit(size?: number) {
  return svgIcon(h('path', { d: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.125A2.625 2.625 0 0 1 15.375 21H5.625A2.625 2.625 0 0 1 3 18.375V8.625A2.625 2.625 0 0 1 5.625 6h4.125' }), size);
}

export function iconClose(size?: number) {
  return svgIcon(h('path', { d: 'M6 18 18 6M6 6l12 12' }), size);
}

export function iconBookOpen(size?: number) {
  return svgIcon(h('path', { d: 'M12 6.042A8.967 8.967 0 0 0 6 3c-1.052 0-2.062.18-3 .512v14.25A8.969 8.969 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.967 8.967 0 0 1 6-3.042c1.052 0 2.062.18 3 .512v14.25A8.969 8.969 0 0 0 18 18c-2.305 0-4.408.867-6 2.292' }), size);
}

export function iconBook(size?: number) {
  return svgIcon(h('path', { d: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }), size);
}

export function iconGrid(size?: number) {
  return svgIcon(h('path', { d: 'M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h.75c1.036 0 1.875-.84 1.875-1.875v-.75C6 3.839 5.16 3 4.125 3h-.75Zm0 6.75A1.875 1.875 0 0 0 1.5 11.625v.75c0 1.036.84 1.875 1.875 1.875h.75c1.036 0 1.875-.84 1.875-1.875v-.75A1.875 1.875 0 0 0 4.125 9.75h-.75Zm0 6.75a1.875 1.875 0 0 0-1.875 1.875v.75c0 1.036.84 1.875 1.875 1.875h.75c1.036 0 1.875-.84 1.875-1.875v-.75a1.875 1.875 0 0 0-1.875-1.875h-.75ZM13.5 4.875c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 13.5 5.625v-.75Zm0 6.75c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875v-.75Zm0 6.75c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v.75c0 1.036-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875v-.75Z' }), size);
}

export function iconList(size?: number) {
  return svgIcon(h('path', { d: 'M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5' }), size);
}

export function iconChevronRight(size?: number) {
  return svgIcon(h('path', { d: 'm8.25 4.5 7.5 7.5-7.5 7.5' }), size);
}

export function iconChevronLeft(size?: number) {
  return svgIcon(h('path', { d: 'M15.75 19.5 8.25 12l7.5-7.5' }), size);
}

export function modal(title: string, content: HTMLElement, onClose?: () => void): HTMLElement {
  const overlay = h('div', { class: 'fixed inset-0 z-40 bg-[var(--overlay-bg)] flex items-start justify-center p-4 pt-16 overflow-y-auto opacity-0 transition-all duration-300 ease-[var(--ease-out-expo)]' });
  const box = h(
    'div',
    { class: 'bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-2xl p-6 border border-[var(--border-default)] opacity-0 scale-95 transition-all duration-300 ease-[var(--ease-out-expo)]' },
    h(
      'div',
      { class: 'flex items-center justify-between mb-4' },
      h('h2', { class: 'text-lg font-semibold text-[var(--text-primary)]' }, title),
      h(
        'button',
        {
          class: 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-1 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors',
          onclick: () => {
            overlay.remove();
            onClose?.();
          },
        },
        iconClose(20),
      ),
    ),
    content,
  );
  overlay.append(box);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      onClose?.();
    }
  });
  document.body.append(overlay);
  requestAnimationFrame(() => {
    overlay.classList.remove('opacity-0');
    box.classList.remove('opacity-0', 'scale-95');
    box.classList.add('opacity-100', 'scale-100');
  });
  return overlay;
}

export function badge(text: string, color?: string): HTMLElement {
  return h(
    'span',
    {
      class: 'inline-block px-2 py-0.5 rounded-full text-xs bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]',
      style: color
        ? `background: color-mix(in srgb, ${color} 15%, var(--bg-surface-hover)); color: ${color};`
        : undefined,
    },
    text,
  );
}

// 评分星星 SVG（5 星制，10分制转5星显示）
const STAR_PATH = 'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z';

export function renderStars(rating: number | null | undefined, size = 'w-3.5 h-3.5'): HTMLElement {
  const wrap = h('div', { class: 'flex items-center gap-0.5' });
  if (rating == null) {
    wrap.append(h('span', { class: 'text-[var(--text-muted)] text-xs' }, '未评分'));
    return wrap;
  }
  const full = Math.floor(rating / 2); // 10分制转5星
  for (let i = 1; i <= 5; i++) {
    const filled = i <= full;
    wrap.append(
      h('svg', {
        class: `${size} ${filled ? 'text-[var(--accent)]' : 'text-[var(--border-default)]'} fill-current`,
        viewBox: '0 0 20 20',
      }, h('path', { d: STAR_PATH })),
    );
  }
  return wrap;
}

// 低饱和暖调封面配色板（私人图书馆 / 纸质感编辑风）
const COVER_PALETTE = [
  'hsl(18, 42%, 58%)',   // muted terracotta
  'hsl(85, 22%, 54%)',   // sage green
  'hsl(205, 26%, 56%)',  // dusty blue
  'hsl(40, 34%, 64%)',   // warm beige / tan
  'hsl(220, 12%, 36%)',  // warm charcoal
  'hsl(45, 55%, 54%)',   // mustard
  'hsl(350, 28%, 60%)',  // dusty rose
  'hsl(160, 20%, 49%)',  // muted teal
  'hsl(30, 24%, 49%)',   // taupe
  'hsl(260, 16%, 56%)',  // dusty lavender
];

function hashTitle(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// 根据书名哈希返回稳定的封面底色
export function getCoverColor(title: string): string {
  return COVER_PALETTE[hashTitle(title) % COVER_PALETTE.length];
}

// 兼容旧版：返回基于书名的 1-12 序号（供尚未迁移的组件临时使用）
export function getCoverPattern(title: string): number {
  return (hashTitle(title) % 12) + 1;
}

// 精致的书脊/封面占位图
export function renderCoverPlaceholder(
  book: { title: string; author?: string | null },
  size: 'grid' | 'table' = 'grid',
): HTMLElement {
  const color = getCoverColor(book.title);
  const hash = hashTitle(book.title);

  if (size === 'table') {
    return h(
      'div',
      {
        class: 'w-full h-full flex items-center justify-center cover-placeholder',
        style: `background:${color};`,
      },
      h(
        'span',
        { class: 'cover-title text-white/90 font-display text-xl font-bold' },
        book.title.slice(0, 2),
      ),
    );
  }

  const bandTop = hash % 2 === 0;
  return h(
    'div',
    {
      class: 'w-full h-full flex flex-col items-center justify-center relative p-4 overflow-hidden cover-placeholder',
      style: `background:${color};`,
    },
    h('div', {
      class: 'absolute left-0 right-0 h-[10%] bg-black/10',
      style: bandTop ? 'top: 24%;' : 'bottom: 24%;',
    }),
    h(
      'span',
      { class: 'cover-title relative font-display text-white/95 font-semibold text-center leading-snug line-clamp-2 px-3' },
      book.title,
    ),
  );
}
