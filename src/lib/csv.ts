// CSV 工具：书单导出/导入共用。列定义、生成 CSV、解析 CSV。

// 全字段列（顺序即表头顺序）。导出与导入共用此表。
export const BOOK_COLUMNS = [
  '书名',
  '作者',
  '译者',
  '出版社',
  '出版年份',
  '页数',
  '原书名',
  'ISBN',
  '简介',
  '记录',
  '豆瓣链接',
  '评分',
  '状态',
  '分类',
  '标签',
] as const;

export type BookCsvRow = Record<string, string | number | null>;

// 单一单元格转义（含逗号/引号/换行时加引号）
function escapeCell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// 生成 CSV 文本（含表头）
export function toCsv(rows: BookCsvRow[]): string {
  const header = BOOK_COLUMNS.map(escapeCell).join(',');
  const body = rows.map((r) => BOOK_COLUMNS.map((c) => escapeCell(r[c] ?? '')).join(','));
  return '\ufeff' + [header, ...body].join('\r\n');
}

// 解析 CSV 为行数组（以第一行为表头）。兼容 BOM、CRLF/LF、引号、内嵌逗号换行。
export function parseCsvRows(text: string): Record<string, string>[] {
  const src = text.replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // 逐字符解析
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  // 末尾残余
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const trimmed = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (trimmed.length === 0) return [];
  const headerRow = trimmed[0].map((c) => c.trim());
  return trimmed.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headerRow.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim();
    });
    return obj;
  });
}

// 书名规范化，用于去重比较（小写、去空格、去常见干扰符）
export function normalizeTitle(t: string): string {
  return t
    .trim()
    .toLowerCase()
    .replace(/[\s\t\u3000·.。·《》「」『』()（）、，,]/g, '');
}

// 状态：接受内部值或中文标签，返回内部值，无法识别返回 undefined
export function normalizeStatus(v: string): string | undefined {
  const s = v.trim();
  if (s === 'unread' || s === '未读') return 'unread';
  if (s === 'reading' || s === '在读') return 'reading';
  if (s === 'finished' || s === '已读完' || s === '已读') return 'finished';
  return undefined;
}
