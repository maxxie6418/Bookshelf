// 前端共享常量：状态元数据、状态选项、通用输入框样式、兜底色。
// 收敛自 book-list / detail-drawer / book-edit-form / book-inline-edit / settings-panel / manage-taxonomy 的重复定义。
import type { Book } from './types';

// 状态选项：value 与内部存储一致，label 用于展示
export const STATUS_OPTIONS: [Book['status'], string][] = [
  ['unread', '未读'],
  ['reading', '在读'],
  ['finished', '读完'],
  ['shelved', '搁置'],
];

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map(([v, l]) => [v, l]),
);

// 状态徽章样式（dot 为圆点、bg/text 为胶囊底色与文字色）
export const STATUS_META: Record<string, { dot: string; bg: string; text: string }> = {
  unread:   { dot: 'bg-[var(--text-muted)]',                bg: 'bg-[var(--bg-surface-hover)]', text: 'text-[var(--text-secondary)]' },
  reading:  { dot: 'bg-[var(--accent)] status-reading-dot', bg: 'bg-[var(--accent)]/10',        text: 'text-[var(--accent)]' },
  finished: { dot: 'bg-[var(--accent)]',                    bg: 'bg-[var(--bg-surface-hover)]', text: 'text-[var(--text-secondary)]' },
  shelved:  { dot: 'bg-[var(--text-muted)]/50',             bg: 'bg-[var(--bg-surface-hover)]', text: 'text-[var(--text-secondary)]' },
};

// 无分类色时的兜底灰（分类色板、书籍列表、详情抽屉共用）
export const FALLBACK_COLOR = '#8a8274';

// 标准表单输入框样式（编辑表单 / 设置面板共用；行内编辑与登录页因尺寸不同保留各自样式）
export const INPUT_CLS =
  'w-full px-3.5 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 placeholder:text-[var(--text-muted)] transition-colors';
