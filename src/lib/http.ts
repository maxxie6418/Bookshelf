// HTTP 响应与请求参数解析的公共小工具（各 API 路由复用，替代各文件重复定义的 err()）

type JsonCapable = { json: (v: unknown, s?: number) => Response };

// 统一错误响应体：{ error: { code, message } }
export function err(c: JsonCapable, code: string, message: string, status = 400): Response {
  return c.json({ error: { code, message } }, status);
}

// 解析非负整数 query 参数（limit/offset 等）；缺失或非法（含 NaN/负数/小数）返回 undefined
export function intParam(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

// 解析路径 :id（正整数）；非法返回 null，由调用方统一回 400，避免 NaN 直通 SQL 报 500
export function idParam(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
