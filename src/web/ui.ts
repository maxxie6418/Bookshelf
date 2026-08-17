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
        'pointer-events-auto max-w-sm w-full rounded-xl shadow-lg px-4 py-3 text-sm text-white ' +
        (type === 'success' ? 'bg-emerald-600' : 'bg-red-600'),
    },
    message,
  );
  container.append(el);
  setTimeout(() => el.remove(), 2600);
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = h('div', {
      class: 'fixed inset-0 z-50 bg-shelf-900/50 flex items-center justify-center p-4',
    });
    const box = h(
      'div',
      { class: 'bg-white dark:bg-shelf-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm' },
      h('p', { class: 'text-shelf-900 dark:text-shelf-50 font-medium mb-4' }, message),
      h(
        'div',
        { class: 'flex justify-end gap-3' },
        h(
          'button',
          {
            class: 'px-4 py-2 rounded-lg text-shelf-700 dark:text-shelf-200 hover:bg-shelf-100 dark:hover:bg-shelf-700',
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
            class: 'px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700',
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
  });
}

export function modal(title: string, content: HTMLElement, onClose?: () => void): HTMLElement {
  const overlay = h('div', { class: 'fixed inset-0 z-40 bg-shelf-900/50 flex items-start justify-center p-4 pt-16 overflow-y-auto' });
  const box = h(
    'div',
    { class: 'bg-white dark:bg-shelf-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6' },
    h(
      'div',
      { class: 'flex items-center justify-between mb-4' },
      h('h2', { class: 'text-lg font-semibold text-shelf-900 dark:text-shelf-50' }, title),
      h(
        'button',
        {
          class: 'text-shelf-400 hover:text-shelf-600 dark:hover:text-shelf-200 text-xl leading-none',
          onclick: () => {
            overlay.remove();
            onClose?.();
          },
        },
        '✕',
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
  return overlay;
}

export function badge(text: string, color: string): HTMLElement {
  return h(
    'span',
    {
      class: 'inline-block px-2 py-0.5 rounded-full text-xs',
      style: `background:${color}22;color:${color}`,
    },
    text,
  );
}

// 评分星星 SVG（5 星制，10分制转5星显示）
const STAR_PATH = 'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z';

export function renderStars(rating: number | null | undefined, size = 'w-3.5 h-3.5'): HTMLElement {
  const wrap = h('div', { class: 'flex items-center gap-0.5' });
  if (rating == null) {
    wrap.append(h('span', { class: 'text-shelf-300 text-xs' }, '未评分'));
    return wrap;
  }
  const full = Math.floor(rating / 2); // 10分制转5星
  for (let i = 1; i <= 5; i++) {
    const filled = i <= full;
    wrap.append(
      h('svg', {
        class: `${size} ${filled ? 'text-amber-400' : 'text-shelf-200 dark:text-shelf-700'} fill-current`,
        viewBox: '0 0 20 20',
      }, h('path', { d: STAR_PATH })),
    );
  }
  return wrap;
}

// 根据书名哈希获取封面渐变序号（1-12）
export function getCoverPattern(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 12) + 1;
}
