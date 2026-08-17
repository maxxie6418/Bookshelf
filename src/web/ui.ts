// 轻量 DOM 构建与通用 UI 组件

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, unknown> | null,
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = String(v);
      else if (k === 'html') node.innerHTML = String(v);
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else {
        node.setAttribute(k, v === true ? '' : String(v));
      }
    }
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function toast(message: string, type: 'success' | 'error' = 'success') {
  const container = document.getElementById('toast-root');
  const el = h(
    'div',
    {
      class:
        'pointer-events-auto max-w-sm w-full rounded-xl shadow-lg px-4 py-3 text-sm text-white ' +
        (type === 'success' ? 'bg-emerald-600' : 'bg-red-600'),
    },
    message,
  );
  container?.append(el);
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