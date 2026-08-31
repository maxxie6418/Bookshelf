// 豆瓣书籍元数据抓取与解析（基于正则，避免引入生产依赖）
import type { KVNamespace } from '@cloudflare/workers-types';
import { fetchWithRetry } from './fetch-utils';

export interface BookMetadata {
  title: string | null;
  author: string | null;
  translator: string | null;
  publisher: string | null;
  publish_year: number | null;
  page_count: number | null;
  subtitle: string | null;
  isbn: string | null;
  description: string | null;
  cover_url: string | null;
  douban_rating: number | null;
  source: 'douban';
}

// 通过正则从豆瓣书籍详情页 HTML 中提取字段。
export function parseDoubanHtml(html: string): Omit<BookMetadata, 'source'> {
  // 去掉 <style>/<script> 及注释，避免把 CSS 文本误当正文
  const body = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const txt = (re: RegExp): string | null => {
    const m = body.match(re);
    return m ? decodeEntities(m[1]).trim() : null;
  };

  // 豆瓣 info 区：<span class="pl">出版社:</span><a ...>人民文学出版社</a>
  // 值可能是超链接（作者/出版社），也可能是纯文本（出版年/页数/ISBN/定价）。
  const info = (label: string): string | null => {
    const re = new RegExp(
      `<span class="pl">\\s*${label}\\s*[:：]?\\s*<\\/span>\\s*[:：]?\\s*` +
        `(?:(?:<a[^>]*>\\s*)([^<]+?)(?:\\s*<\\/a>)|([^<\\n;]+))`,
      'i',
    );
    const m = body.match(re);
    if (!m) return null;
    const v = m[1] || m[2];
    return v ? decodeEntities(v).trim() : null;
  };

  // 书名优先取 h1 的 property 属性值，避免带上 “(豆瓣)” 后缀
  let title =
    txt(/<h1[^>]*>\s*<span[^>]*property="v:itemreviewed"[^>]*>\s*([^<]+?)\s*<\/span>/i) ??
    txt(/<h1[^>]*>\s*<span[^>]*>([^<]+?)<\/span>/i) ??
    (txt(/<title>([^<]*?)<\/title>/i) ?? '').replace(/\s*\(豆瓣\)\s*$/i, '');

  const author = info('作者');
  const translator = info('译者');
  const publisher = info('出版社');
  // 出版年可能是 “1991-2” 这类区间，取第一个 4 位年份
  const publishYear = (info('出版年') ?? '').match(/\d{4}/)?.[0] ?? null;
  const pageCount = info('页数');
  const isbn = info('ISBN');

  // 副标题（书名下的一句话简介）：
  // 优先豆瓣标准结构 <h2 class="subtitle"><span property="v:subtitle">…</span></h2>；
  // 退回信息区“副标题”行；再退回书名冒号（：或 :）后拆分
  let subtitle =
    txt(/<span[^>]*property="v:subtitle"[^>]*>\s*([^<]+?)\s*<\/span>/i) ??
    txt(/<h2[^>]*class="[^"]*subtitle[^"]*"[^>]*>\s*([^<]+?)\s*<\/h2>/i) ??
    info('副标题');
  if (!subtitle && title) {
    const parts = title.match(/^(.+?)\s*[:：]\s*(.+)$/);
    if (parts) {
      title = parts[1];
      subtitle = parts[2];
    }
  }

  const coverUrl =
    txt(/<a[^>]+class="[^"]*nbg[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"/i) ??
    txt(/<img[^>]+src="(https:\/\/img[0-9]\.doubanio\.com\/[^"]+)"[^>]*alt="[^"]*"[^>]*>/i);

  const rating = txt(/<strong[^>]*class="[^"]*rating_num[^"]*"[^>]*>\s*([\d.]+)\s*<\/strong>/i);
  const description = extractDescription(body);

  return {
    title: clean(title),
    author: clean(author),
    translator: clean(translator),
    publisher: clean(publisher),
    publish_year: publishYear ? Number(publishYear) : null,
    page_count: pageCount ? Number(pageCount.replace(/\D/g, '')) : null,
    subtitle: clean(subtitle),
    isbn: isbn ? isbn.replace(/[^0-9Xx]/g, '') : null,
    description,
    // 豆瓣封面统一取较大图（/s|m/ → /l/）
    cover_url: coverUrl
      ? coverUrl.replace(/\/(s|m)\/public\//, '/l/public/')
      : null,
    douban_rating: rating ? Number(rating) : null,
  };
}

// 从 #link-report 提取内容简介：优先“全文”span，退回“short”，剔除样式/链接后取纯文本。
function extractDescription(html: string): string | null {
  const linkReport = html.match(/<div[^>]*id="link-report"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
  const block = linkReport ? linkReport[1] : html;

  let inner = block.match(/<span class="all hidden">([\s\S]*?)<\/span>/i)?.[1]
    ?? block.match(/<span class="short">([\s\S]*?)<\/span>/i)?.[1]
    ?? block;

  inner = inner
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<a[^>]*>[\s\S]*?<\/a>/gi, '') // 去掉“(展开全部)”等链接
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const text = decodeEntities(inner);
  return text ? text : null;
}

function clean(s: string | null): string | null {
  if (!s) return null;
  return decodeEntities(s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()) || null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// 校验/规范化豆瓣链接，返回页面 URL；非法返回 null。
export function normalizeDoubanUrl(input: string): string | null {
  const m = input.trim().match(/^https?:\/\/(?:www\.)?book\.douban\.com\/subject\/(\d+)\/?/i);
  if (!m) return null;
  return `https://book.douban.com/subject/${m[1]}/`;
}

// 由豆瓣链接抓取并解析元数据。
export async function fetchDoubanMetadataByUrl(
  url: string,
  kv?: KVNamespace,
): Promise<BookMetadata> {
  const pageUrl = normalizeDoubanUrl(url);
  if (!pageUrl) throw new Error('请输入有效的豆瓣书籍链接');
  return fetchDoubanPage(pageUrl, kv);
}

// 由 ISBN 先走豆瓣搜索定位 subject，再抓详情页。
export async function fetchDoubanMetadataByIsbn(
  isbn: string,
  kv?: KVNamespace,
): Promise<BookMetadata> {
  const searchUrl = `https://www.douban.com/search?cat=1001&q=${encodeURIComponent(isbn)}`;
  const res = await fetchWithRetry(searchUrl, { kv, referer: 'https://book.douban.com/' });
  const html = await res.text();
  const m = html.match(/https:\/\/book\.douban\.com\/subject\/(\d+)\//);
  if (!m) throw new Error('豆瓣未找到该 ISBN');
  return fetchDoubanPage(`https://book.douban.com/subject/${m[1]}/`, kv);
}

async function fetchDoubanPage(pageUrl: string, kv?: KVNamespace): Promise<BookMetadata> {
  const res = await fetchWithRetry(pageUrl, { kv, referer: 'https://book.douban.com/' });
  if (res.status === 404) throw new Error('豆瓣未找到该书籍');
  const html = await res.text();
  const parsed = parseDoubanHtml(html);
  if (!parsed.title) throw new Error('解析失败，请检查链接是否为豆瓣书籍详情页');
  return { ...parsed, source: 'douban' };
}