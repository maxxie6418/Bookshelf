# 书单管理工具技术方案

> 基于 Redesk 精简版需求，对比 Cloudflare 全家桶与 Vercel + Cloudflare R2 两种部署路线
> 版本：v1.0 | 日期：2026-08-17

---

## 一、项目定位

### 1.1 核心功能

个人书单管理系统，支持通过书名/豆瓣链接或 AI Agent 指令录入书籍，自动抓取元数据，提供类 Notion 的数据库视图管理。

| 功能模块 | 具体内容 | 优先级 |
|---------|---------|--------|
| **书籍录入** | 手动填写 / 豆瓣链接解析 / AI Agent 指令 | P0 |
| **元数据管理** | 书名、作者、出版社、ISBN、简介、封面图 | P0 |
| **状态管理** | 收录 / 计划读 / 在读 / 已读 / 存档 | P0 |
| **个性化分类** | 自定义分类体系，支持颜色标识 | P0 |
| **标签系统** | 多对多标签关联 | P0 |
| **封面存储** | 自动抓取 / 手动上传 / CDN 分发 | P0 |
| **展示视图** | 表格视图（Notion 式）+ 网格视图（卡片式） | P0 |
| **响应式设计** | 桌面端 + 移动端适配 | P0 |
| **身份验证** | 单用户访问控制 | P0 |
| **单条编辑** | 完整字段编辑，无需批量操作 | P0 |
| 数据导出 | JSON / CSV 导出 | P1 |
| 暗色模式 | 全局主题切换 | P1 |
| 拖拽排序 | 分类/书籍自定义排序 | P2 |
| 阅读统计 | 年度/月度阅读数据 | P2 |

### 1.2 明确砍掉的功能

以下 Redesk 原有功能本次不实现：

- ❌ 在线 EPUB 阅读器
- ❌ 高亮/划线/笔记系统
- ❌ CFI 阅读进度追踪
- ❌ 主题阅读（跨书组织）
- ❌ AI 陪读 / RAG 问答
- ❌ 文件上传/下载（除封面外）
- ❌ OPDS 输出
- ❌ 批量操作
- ❌ 多用户系统

---

## 二、技术选型总览

### 2.1 三种路线对比

| 维度 | 路线 A：Cloudflare 全家桶 | 路线 B：Vercel + Cloudflare R2 | 路线 C：Vercel + Supabase (推荐) |
|------|--------------------------|-------------------------------|--------------------------------|
| **前端框架** | React + Vite | Next.js 14+ (App Router) | Next.js 14+ (App Router) |
| **前端托管** | Cloudflare Pages | Vercel | Vercel |
| **后端 API** | Cloudflare Workers | Vercel Serverless Functions | Vercel Serverless Functions / Supabase Edge Functions |
| **数据库** | Cloudflare D1 (SQLite) | Vercel Postgres (Neon) | **Supabase Postgres (托管)** |
| **对象存储** | Cloudflare R2 | Cloudflare R2 | **Supabase Storage (内置)** |
| **身份验证** | Cloudflare Access / JWT | NextAuth.js / Clerk | **Supabase Auth (内置)** |
| **数据库管理** | CLI + 无可视化 | CLI + 无可视化 | **Dashboard 图形化 + SQL Editor** |
| **自动生成 API** | 手动编写 | 手动编写 | **PostgREST 自动生成** |
| **实时同步** | 无 | 无 | **Supabase Realtime 原生支持** |
| **数据安全** | 应用层控制 | 应用层控制 | **RLS 行级安全策略** |
| **运行时** | V8 Isolate (边缘) | Node.js 18+ (Serverless) | Node.js 18+ (Serverless) |
| **冷启动** | < 5ms | 200-500ms | 200-500ms |
| **包大小限制** | 3MB (免费) / 10MB (付费) | 50MB (压缩后) | 50MB (压缩后) |
| **内存限制** | 128MB | 1024MB (Hobby) | 1024MB (Hobby) |
| **CPU 时间** | 10ms/请求 (免费) | 10s/请求 (Hobby) | 10s/请求 (Hobby) |
| **数据库容量** | 500MB (免费) / 10GB (付费硬上限) | 无硬上限 | 500MB (免费) / 无上限 (付费) |
| **数据库类型** | SQLite (边缘) | PostgreSQL (区域) | **PostgreSQL (托管)** |
| **部署命令** | `wrangler deploy` | `vercel --prod` | `vercel --prod` |
| **服务商数量** | 1 个 (Cloudflare) | 2 个 (Vercel + Cloudflare) | **2 个 (Vercel + Supabase)** |
| **预估月费** | $0-5 | $0-20 | **$0-25** |

### 2.2 决策矩阵

| 考量因素 | 权重 | CF 全家桶 | Vercel+R2 | **Vercel+Supabase** |
|---------|------|----------|-----------|---------------------|
| 部署简洁度 | ★★★★★ | ⭐⭐⭐⭐⭐ (一键) | ⭐⭐⭐ (需两个平台) | ⭐⭐⭐⭐ (Dashboard 省心) |
| 前端开发体验 | ★★★★☆ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ (Next.js 原生) | ⭐⭐⭐⭐⭐ (Next.js 原生) |
| 数据库功能 | ★★★★☆ | ⭐⭐⭐ (SQLite 有限) | ⭐⭐⭐⭐⭐ (Postgres 完整) | ⭐⭐⭐⭐⭐ (Postgres 完整) |
| **数据库可视化** | ★★★☆☆ | ⭐ (无) | ⭐ (无) | ⭐⭐⭐⭐⭐ (Dashboard) |
| **认证便利性** | ★★★★☆ | ⭐⭐⭐ (自建 JWT) | ⭐⭐⭐⭐ (NextAuth.js) | ⭐⭐⭐⭐⭐ (内置 Auth) |
| **存储便利性** | ★★★☆☆ | ⭐⭐⭐ (R2 需配置) | ⭐⭐⭐ (R2 需配置) | ⭐⭐⭐⭐⭐ (Storage 内置) |
| 运行时可扩展性 | ★★★☆☆ | ⭐⭐⭐ (128MB/10ms) | ⭐⭐⭐⭐⭐ (1GB/10s) | ⭐⭐⭐⭐⭐ (1GB/10s) |
| 冷启动性能 | ★★★☆☆ | ⭐⭐⭐⭐⭐ (<5ms) | ⭐⭐⭐ (200ms+) | ⭐⭐⭐ (200ms+) |
| 豆瓣抓取便利性 | ★★★★☆ | ⭐⭐⭐ (需 Browser Rendering) | ⭐⭐⭐⭐⭐ (cheerio 直用) | ⭐⭐⭐⭐⭐ (cheerio 直用) |
| 未来扩展空间 | ★★★☆☆ | ⭐⭐⭐ (D1 10GB 硬上限) | ⭐⭐⭐⭐⭐ (无上限) | ⭐⭐⭐⭐⭐ (无上限) |
| **运维监控** | ★★★☆☆ | ⭐⭐⭐ (分散) | ⭐⭐⭐⭐ (Vercel Analytics) | ⭐⭐⭐⭐⭐ (统一 Dashboard) |
| **总分** | | **34** | **38** | **43** |

---

## 三、路线 A：Cloudflare 全家桶

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器 / 手机                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              Cloudflare CDN (全球 300+ PoP)                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Cloudflare Pages (React SPA)                        │    │
│  │  - Vite + React + TypeScript                        │    │
│  │  - TanStack Table (Notion 式表格)                   │    │
│  │  - 响应式布局 + 暗色模式                            │    │
│  │  - 表格/网格视图切换                                │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Cloudflare Workers (API 网关)                       │    │
│  │  - 书单 CRUD (Hono 框架)                            │    │
│  │  - 豆瓣抓取 (Browser Rendering API)                  │    │
│  │  - 封面下载 → R2 上传                               │    │
│  │  - JWT 鉴权 (jose 库)                               │    │
│  │  - 数据导出 (JSON/CSV 生成)                         │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Cloudflare D1 (边缘 SQLite)                         │    │
│  │  - books, categories, tags, book_categories          │    │
│  │  - book_tags, status_history                         │    │
│  │  - 全文搜索 (LIKE / FTS5)                           │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Cloudflare R2 (对象存储)                            │    │
│  │  - 封面图片 (公开桶 / 自定义域名)                    │    │
│  │  - 零 egress 费用                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Cloudflare Access (零信任身份验证)                  │    │
│  │  - 邮箱策略 / OTP / 社交登录                        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 技术栈

| 层级 | 技术选型 | 版本/说明 |
|------|---------|----------|
| 前端框架 | React 18 + TypeScript | Vite 构建 |
| UI 组件 | shadcn/ui | 基于 Radix + Tailwind |
| 表格组件 | TanStack Table v8 | Notion 式数据表格 |
| 状态管理 | Zustand | 轻量全局状态 |
| 数据获取 | TanStack Query v5 | 服务端状态管理 |
| 后端框架 | Hono | 轻量 Edge 框架，类似 Express |
| ORM | Drizzle ORM | D1 适配器 |
| 鉴权 | jose (JWT) | 或 Cloudflare Access |
| 豆瓣抓取 | Browser Rendering API | Cloudflare 浏览器渲染 |
| 部署 | Wrangler CLI | `wrangler deploy` |

### 3.3 数据模型 (D1)

```sql
-- 书籍主表
CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT,
  author TEXT,
  translator TEXT,
  publisher TEXT,
  publish_date TEXT,
  isbn TEXT,
  page_count INTEGER,
  description TEXT,
  cover_key TEXT,              -- R2 文件 key
  cover_url TEXT,              -- 外部封面 URL (备用)
  status TEXT DEFAULT 'wish',  -- wish/reading/finished/dropped/archived
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  source_url TEXT,             -- 豆瓣链接
  source_type TEXT DEFAULT 'manual', -- manual/douban/ai
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 个性化分类
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3b82f6',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 书籍-分类关联 (多对多)
CREATE TABLE book_categories (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, category_id)
);

-- 标签表
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#10b981',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 书籍-标签关联 (多对多)
CREATE TABLE book_tags (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);

-- 状态变更历史 (可选)
CREATE TABLE status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_created ON books(created_at DESC);
```

### 3.4 核心 API 设计

```typescript
// Workers API 路由 (Hono)

// ===== 书籍 CRUD =====
GET    /api/books              // 列表 (支持 status/category/tag 筛选, 分页)
GET    /api/books/:id          // 详情
POST   /api/books              // 创建 (手动录入)
PUT    /api/books/:id          // 更新
DELETE /api/books/:id          // 删除 (软删除/硬删除)

// ===== 豆瓣抓取 =====
POST   /api/scrape/douban      // 传入豆瓣链接, 返回解析后的元数据
// 内部调用 Browser Rendering API 获取渲染后 HTML

// ===== 封面处理 =====
POST   /api/covers/upload      // 获取 R2 预签名上传 URL
GET    /api/covers/:key        // 获取 R2 预签名下载 URL (或直链)

// ===== AI Agent 接口 =====
POST   /api/agent/add-book     // AI Agent 调用, 传入书名/链接, 自动录入
// 请求体: { title?: string, doubanUrl?: string, agentToken: string }

// ===== 分类 & 标签 =====
GET    /api/categories         // 分类列表
POST   /api/categories         // 创建分类
PUT    /api/categories/:id     // 更新分类
DELETE /api/categories/:id     // 删除分类

GET    /api/tags               // 标签列表 (含使用次数)
POST   /api/tags               // 创建标签
DELETE /api/tags/:id           // 删除标签

// ===== 数据导出 =====
GET    /api/export/json        // 导出 JSON
GET    /api/export/csv         // 导出 CSV
```

### 3.5 豆瓣抓取实现

```typescript
// 使用 Cloudflare Browser Rendering API
// 需要先在 Workers 中绑定 browser 服务

async function scrapeDouban(url: string) {
  // 1. 调用 Browser Rendering 获取渲染后 HTML
  const browser = await puppeteer.launch(env.MYBROWSER);
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });
  const html = await page.content();
  await browser.close();

  // 2. 正则/字符串匹配提取信息
  const title = extract(html, /<span property="v:itemreviewed">([^<]+)<\/span>/);
  const author = extract(html, /作者<\/span>\s*<a[^>]*>([^<]+)<\/a>/);
  const publisher = extract(html, /出版社<\/span>\s*<a[^>]*>([^<]+)<\/a>/);
  const coverMatch = html.match(/<img src="(https:\/\/img\d+\.doubanio\.com\/view\/subject\/l\/public\/[^"]+)"/);
  const coverUrl = coverMatch ? coverMatch[1] : null;

  // 3. 下载封面到 R2
  let coverKey = null;
  if (coverUrl) {
    const imageRes = await fetch(coverUrl);
    const key = `covers/${Date.now()}-${randomString(8)}.jpg`;
    await env.BUCKET.put(key, imageRes.body);
    coverKey = key;
  }

  return { title, author, publisher, coverKey, ... };
}
```

**Browser Rendering 成本**：约 $0.001-0.005/次调用，个人使用月费 < $1。

### 3.6 前端结构

```
web/
├── src/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 基础组件
│   │   ├── BookTable.tsx       # 表格视图 (TanStack Table)
│   │   ├── BookGrid.tsx        # 网格视图 (卡片)
│   │   ├── BookCard.tsx        # 单本书卡片
│   │   ├── BookForm.tsx        # 录入/编辑表单
│   │   ├── BookDetail.tsx      # 详情抽屉/弹窗
│   │   ├── CategorySidebar.tsx # 左侧分类筛选栏
│   │   ├── TagFilter.tsx       # 标签筛选
│   │   ├── ViewToggle.tsx      # 表格/网格切换
│   │   ├── SearchBar.tsx       # 顶部搜索
│   │   └── AddBookDialog.tsx   # 添加书籍弹窗
│   ├── hooks/
│   │   ├── useBooks.ts         # 书籍数据 Query
│   │   ├── useCategories.ts    # 分类数据
│   │   ├── useTags.ts          # 标签数据
│   │   └── useDoubanScrape.ts  # 豆瓣抓取
│   ├── lib/
│   │   ├── api.ts              # API 客户端 (fetch 封装)
│   │   ├── utils.ts            # 工具函数
│   │   └── constants.ts        # 常量配置
│   ├── stores/
│   │   └── useAppStore.ts      # Zustand 全局状态 (视图模式/主题)
│   ├── types/
│   │   └── index.ts            # TypeScript 类型定义
│   ├── App.tsx                 # 根组件
│   └── main.tsx                # 入口
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 3.7 部署配置

```toml
# wrangler.toml
name = "bookshelf"
compatibility_date = "2026-08-17"

# 前端 (Pages)
[site]
bucket = "./web/dist"

# D1 数据库
[[d1_databases]]
binding = "DB"
database_name = "bookshelf-db"
database_id = "your-db-id"

# R2 存储桶
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "bookshelf-covers"

# Browser Rendering (豆瓣抓取)
[[browser]]
binding = "MYBROWSER"

# 环境变量
[vars]
JWT_SECRET = "your-secret-key"
AGENT_TOKEN = "ai-agent-access-token"
```

```bash
# 部署命令
npm run build        # 构建前端
wrangler deploy      # 一键部署 Workers + Pages
```

### 3.8 成本预估

| 项目 | 免费层限额 | 个人预估用量 | 费用 |
|------|-----------|-------------|------|
| Workers 请求 | 10 万/天 | ~200/天 | **$0** |
| Workers CPU | 10ms/请求 | ~3ms/请求 | **$0** |
| D1 存储 | 500MB | ~5MB | **$0** |
| D1 读行数 | 500 万/天 | ~2,000/天 | **$0** |
| D1 写行数 | 10 万/天 | ~50/天 | **$0** |
| R2 存储 | 10GB | ~50MB | **$0** |
| R2 Class A | 100 万/月 | ~20/月 | **$0** |
| R2 Class B | 1000 万/月 | ~500/月 | **$0** |
| Browser Rendering | 无免费层 | ~30 次/月 | **~$0.15/月** |
| **总计** | | | **≈ $0.15/月** |

---

## 四、路线 B：Vercel + Cloudflare R2

### 4.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器 / 手机                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              Vercel Edge Network (CDN)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Next.js 14+ (App Router)                            │    │
│  │  - Server Components (数据库直查)                    │    │
│  │  - Client Components (交互表格/网格)                 │    │
│  │  - API Routes (豆瓣抓取/封面上传)                    │    │
│  │  - TanStack Table (Notion 式表格)                   │    │
│  │  - 响应式布局 + 暗色模式                            │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Vercel Postgres (Neon Serverless)                   │    │
│  │  - books, categories, tags, book_categories          │    │
│  │  - book_tags, status_history                         │    │
│  │  - GIN 全文检索索引                                 │    │
│  │  - 自动扩缩容 / 分支数据库                          │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Cloudflare R2 (对象存储)                            │    │
│  │  - 封面图片 (公开桶 / 自定义域名)                    │    │
│  │  - 零 egress 费用                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  NextAuth.js / Clerk (身份验证)                      │    │
│  │  - 邮箱密码 / Magic Link / OAuth                    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 技术栈

| 层级 | 技术选型 | 版本/说明 |
|------|---------|----------|
| 前端框架 | Next.js 14+ (App Router) | React Server Components |
| 语言 | TypeScript | 严格模式 |
| UI 组件 | shadcn/ui | 基于 Radix + Tailwind |
| 表格组件 | TanStack Table v8 | Notion 式数据表格 |
| 状态管理 | Zustand / Jotai | 客户端状态 |
| 数据获取 | Server Actions + TanStack Query | Server Components 直查 |
| 数据库 | Vercel Postgres (Neon) | Serverless Postgres |
| ORM | Drizzle ORM | Postgres 适配器 |
| 鉴权 | NextAuth.js v5 (Auth.js) | 或 Clerk |
| 豆瓣抓取 | cheerio + node-fetch | 直接解析 HTML |
| 对象存储 | aws-sdk (S3 兼容) | 连接 Cloudflare R2 |
| 部署 | Vercel CLI | `vercel --prod` |

### 4.3 数据模型 (Postgres)

```sql
-- 书籍主表
CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  author TEXT,
  translator TEXT,
  publisher TEXT,
  publish_date TEXT,
  isbn TEXT,
  page_count INTEGER,
  description TEXT,
  cover_key TEXT,
  cover_url TEXT,
  status TEXT DEFAULT 'wish' CHECK (status IN ('wish', 'reading', 'finished', 'dropped', 'archived')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  source_url TEXT,
  source_type TEXT DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 个性化分类
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3b82f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 书籍-分类关联
CREATE TABLE book_categories (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, category_id)
);

-- 标签表
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#10b981',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 书籍-标签关联
CREATE TABLE book_tags (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);

-- 状态变更历史
CREATE TABLE status_history (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GIN 全文检索索引 (Postgres 优势)
CREATE INDEX idx_books_fts ON books USING GIN (to_tsvector('chinese', title || ' ' || COALESCE(author, '') || ' ' || COALESCE(description, '')));
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_created ON books(created_at DESC);
```

### 4.4 核心 API / Server Actions

```typescript
// Next.js App Router 结构

// ===== Server Actions (直接操作数据库) =====
// app/actions/books.ts
'use server'

export async function getBooks(filters: BookFilters) {
  // Server Component 中直接查询 Postgres
  const books = await db.select().from(booksTable).where(...);
  return books;
}

export async function createBook(data: CreateBookInput) {
  // 表单提交后直接插入
  const book = await db.insert(booksTable).values(data).returning();
  revalidatePath('/');
  return book;
}

export async function updateBook(id: number, data: UpdateBookInput) {
  const book = await db.update(booksTable).set(data).where(eq(booksTable.id, id)).returning();
  revalidatePath('/');
  return book;
}

export async function deleteBook(id: number) {
  await db.delete(booksTable).where(eq(booksTable.id, id));
  revalidatePath('/');
}

// ===== API Routes (外部接口) =====
// app/api/scrape/douban/route.ts
export async function POST(req: Request) {
  const { url } = await req.json();

  // 直接用 cheerio 解析，无需 Browser Rendering
  const html = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0...' }
  }).then(r => r.text());

  const $ = cheerio.load(html);
  const title = $('span[property="v:itemreviewed"]').text();
  const author = $('#info span.pl:contains("作者")').next().text().trim();
  // ...

  return Response.json({ title, author, ... });
}

// app/api/agent/add-book/route.ts
export async function POST(req: Request) {
  // AI Agent 调用接口
  const { title, doubanUrl, agentToken } = await req.json();
  // 验证 agentToken → 抓取/录入 → 返回结果
}

// app/api/covers/presigned/route.ts
export async function POST(req: Request) {
  // 生成 R2 预签名上传 URL
  const { filename, contentType } = await req.json();
  const command = new PutObjectCommand({ Bucket: 'covers', Key: filename, ContentType: contentType });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return Response.json({ uploadUrl: url, key: filename });
}
```

### 4.5 豆瓣抓取实现

```typescript
// app/api/scrape/douban/route.ts
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  const { url } = await req.json();

  // Vercel Serverless Function 直接 fetch，IP 池大且轮换
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    // Vercel 函数超时 10s，足够加载页面
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  // 提取元数据
  const title = $('span[property="v:itemreviewed"]').text().trim();
  const author = $('#info span.pl:contains("作者")').next('a').text().trim() 
    || $('#info').text().match(/作者[：:]\s*([^
]+)/)?.[1]?.trim();
  const publisher = $('#info span.pl:contains("出版社")').next().text().trim();
  const publishDate = $('#info span.pl:contains("出版年")').next().text().trim();
  const isbn = $('#info span.pl:contains("ISBN")').next().text().trim();
  const pageCount = parseInt($('#info span.pl:contains("页数")').next().text().trim()) || null;
  const description = $('#link-report .intro p').first().text().trim();

  // 封面图
  const coverUrl = $('#mainpic img').attr('src') 
    || $('.nbg img').attr('src')
    || null;

  return Response.json({
    title,
    author,
    publisher,
    publishDate,
    isbn,
    pageCount,
    description,
    coverUrl,
    sourceUrl: url,
  });
}
```

**优势**：无需 Browser Rendering API，直接用 `cheerio` 解析，成本为 $0。

### 4.6 前端结构 (Next.js App Router)

```
app/
├── page.tsx                    # 首页 (Server Component)
├── layout.tsx                  # 根布局 (主题/字体)
├── globals.css                 # 全局样式
│
├── (auth)/
│   ├── login/
│   │   └── page.tsx            # 登录页
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts    # NextAuth.js 配置
│
├── api/
│   ├── scrape/
│   │   └── douban/
│   │       └── route.ts        # 豆瓣抓取 API
│   ├── agent/
│   │   └── add-book/
│   │       └── route.ts        # AI Agent 接口
│   └── covers/
│       └── presigned/
│           └── route.ts        # R2 预签名 URL
│
├── actions/
│   └── books.ts                # Server Actions (CRUD)
│
├── components/
│   ├── ui/                     # shadcn/ui 基础组件
│   ├── BookTable.tsx           # 表格视图
│   ├── BookGrid.tsx            # 网格视图
│   ├── BookCard.tsx            # 单本书卡片
│   ├── BookForm.tsx            # 录入/编辑表单
│   ├── BookDetailSheet.tsx     # 详情抽屉 (Sheet)
│   ├── CategorySidebar.tsx     # 左侧分类栏
│   ├── TagFilter.tsx           # 标签筛选
│   ├── ViewToggle.tsx          # 视图切换
│   ├── SearchBar.tsx           # 搜索栏
│   ├── AddBookDialog.tsx       # 添加书籍弹窗
│   └── Providers.tsx           # QueryClient / ThemeProvider
│
├── hooks/
│   ├── useBooks.ts             # TanStack Query hooks
│   ├── useCategories.ts
│   └── useTags.ts
│
├── lib/
│   ├── db.ts                   # Drizzle ORM 客户端
│   ├── auth.ts                 # NextAuth 配置
│   ├── r2.ts                   # R2 S3 客户端
│   └── utils.ts                # 工具函数
│
└── types/
    └── index.ts                # TypeScript 类型
```

### 4.7 部署配置

```env
# .env.local (本地开发)
POSTGRES_URL="postgres://user:pass@host:5432/db"
POSTGRES_URL_NON_POOLING="postgres://user:pass@host:5432/db"

# R2 配置
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret"
R2_BUCKET_NAME="bookshelf-covers"
R2_PUBLIC_URL="https://covers.your-domain.com"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"

# AI Agent
AGENT_TOKEN="your-ai-agent-token"
```

```typescript
// vercel.json (可选配置)
{
  "functions": {
    "app/api/scrape/douban/route.ts": {
      "maxDuration": 10  // 豆瓣抓取需要更长时间
    }
  }
}
```

```bash
# 部署命令
vercel --prod    # 一键部署到生产环境
```

### 4.8 成本预估

| 项目 | 免费层限额 | 个人预估用量 | 费用 |
|------|-----------|-------------|------|
| Vercel 托管 | Hobby 免费 | 1 个项目 | **$0** |
| Serverless 调用 | 无限 (Hobby) | ~200/天 | **$0** |
| Serverless 超时 | 10s | 抓取 3-5s | **$0** |
| Postgres 存储 | 256MB (Vercel) / 500MB (Supabase) | ~5MB | **$0** |
| Postgres 读写 | 按量 | ~2,000 读/50 写/天 | **$0** |
| R2 存储 | 10GB | ~50MB | **$0** |
| R2 操作 | 100 万/1000 万/月 | ~20/500/月 | **$0** |
| NextAuth.js | 开源免费 | — | **$0** |
| **总计** | | | **≈ $0/月** |

---

## 五、两种路线详细对比

### 5.1 开发体验

| 维度 | Cloudflare 全家桶 | Vercel + R2 |
|------|------------------|-------------|
| **框架熟悉度** | 需学习 Workers 边缘运行时 | Next.js 生态最成熟，文档丰富 |
| **本地开发** | `wrangler dev` (模拟边缘) | `next dev` (标准 Node.js) |
| **调试体验** | Wrangler 日志 + 本地调试 | Vercel 日志 + 本地调试 |
| **类型安全** | Hono + Drizzle 类型完备 | Next.js + Drizzle 类型完备 |
| **组件生态** | shadcn/ui 完全可用 | shadcn/ui 完全可用 |
| **表格组件** | TanStack Table | TanStack Table (Next.js 集成更好) |
| **热更新** | Wrangler 支持 | Next.js 极速 HMR |

### 5.2 数据库对比

| 维度 | D1 (SQLite) | Vercel Postgres |
|------|------------|----------------|
| **容量上限** | 10GB (硬上限，不可突破) | 无硬上限 |
| **数据类型** | SQLite 有限 | Postgres 丰富 (JSONB/数组/枚举) |
| **全文检索** | FTS5 (基础) | GIN 索引 + tsvector (强大) |
| **复杂查询** | 支持有限 | CTE/窗口函数/复杂 JOIN |
| **并发写入** | 单点写入，读副本自动 | Serverless 连接池 |
| **备份恢复** | 手动导出 | 自动备份 + 时间点恢复 |
| **分支数据库** | 不支持 | Neon 支持 (开发/测试隔离) |
| **你的场景** | 5MB 数据，完全够用 | 5MB 数据，杀鸡用牛刀 |

### 5.3 运行时对比

| 维度 | Workers (V8 Isolate) | Vercel Serverless |
|------|---------------------|-------------------|
| **冷启动** | < 5ms (无敌) | 200-500ms (可接受) |
| **内存** | 128MB (硬限制) | 1024MB (Hobby) |
| **包大小** | 3MB (免费) | 50MB |
| **CPU 时间** | 10ms/请求 (免费) | 10s/请求 |
| **Node.js 兼容** | 部分 (nodejs_compat) | 完整 |
| **原生模块** | 不支持 (无 fs/crypto) | 完整支持 |
| **npm 包选择** | 受限 (轻量包) | 无限制 (可装 puppeteer) |
| **你的场景** | 书单 CRUD 够用 | 更从容，未来扩展无忧 |

### 5.4 豆瓣抓取对比

| 方案 | 实现方式 | 成本 | 稳定性 | 推荐度 |
|------|---------|------|--------|--------|
| **CF: Browser Rendering** | 真实浏览器渲染 | ~$0.005/次 | ⭐⭐⭐⭐ | 高 |
| **CF: 直接 fetch** | 被反爬，IP 易封 | $0 | ⭐ | 低 |
| **Vercel: cheerio** | 直接解析 HTML | $0 | ⭐⭐⭐⭐ | 高 |
| **Vercel: puppeteer** | 需外部 Chrome 实例 | 额外服务器 | ⭐⭐⭐⭐⭐ | 中 |
| **第三方 API** | Open Library / Google Books | $0-免费限额 | ⭐⭐⭐ | 中 |

### 5.5 运维复杂度

| 维度 | Cloudflare 全家桶 | Vercel + R2 |
|------|------------------|-------------|
| **账号数量** | 1 个 | 2 个 (Vercel + Cloudflare) |
| **部署平台** | Wrangler CLI | Vercel CLI + Wrangler CLI |
| **环境变量** | 1 处配置 | 2 处配置 |
| **监控告警** | Workers 分析 + Pages 分析 | Vercel Analytics + R2 监控 |
| **域名管理** | Cloudflare DNS 一站式 | Vercel 域名 + R2 自定义域名 |
| **SSL 证书** | 自动 | 自动 |
| **你的场景** | 极简，一个账号管所有 | 稍繁琐，但可接受 |

---

## 六、推荐决策

### 6.1 选择 Cloudflare 全家桶，如果：

- ✅ 你追求**极简运维**，一个账号搞定所有
- ✅ 你重视**冷启动性能** (<5ms)
- ✅ 你的功能**确定不会扩展**（D1 10GB 上限够用很多年）
- ✅ 你不介意**每月 $0-1** 的 Browser Rendering 费用
- ✅ 你接受**学习 Workers 边缘运行时**
- ✅ 你的 npm 依赖**足够轻量**（<3MB）

### 6.2 选择 Vercel + R2，如果：

- ✅ 你熟悉 **Next.js**，想用最顺手的前端框架
- ✅ 你希望**数据库功能完整**（Postgres > SQLite）
- ✅ 你未来可能**扩展功能**（复杂统计、全文搜索、多用户）
- ✅ 你想**零成本**抓取豆瓣（cheerio 直用，无 Browser Rendering）
- ✅ 你需要**装重型 npm 包**（如图片处理、PDF 生成）
- ✅ 你接受**管理两个平台账号**（Vercel + Cloudflare）

### 6.3 最终建议

**对于你的个人书单工具，推荐路线 B：Vercel + Cloudflare R2**

理由：
1. **开发效率最高**：Next.js App Router 的 Server Components 可以直接查询数据库，减少 API 层代码
2. **豆瓣抓取零成本**：cheerio 直接解析，无需额外付费服务
3. **未来扩展无忧**：Postgres 不会因为功能或容量限制卡住你
4. **前端体验最佳**：Next.js 的 SSR/ISR/Streaming 生态最成熟
5. **成本同样为零**：个人用量不会触及任何付费边界

**唯一的小代价**：需要维护 Vercel + Cloudflare 两个账号，但配置一次后几乎无感。

---

## 七、开发里程碑

### Phase 1: MVP (2 周)

| 任务 | 路线 A (CF) | 路线 B (Vercel) |
|------|------------|----------------|
| 项目初始化 | `npm create cloudflare@latest` | `npx create-next-app@latest` |
| 数据库搭建 | D1 创建 + Drizzle 迁移 | Vercel Postgres + Drizzle 迁移 |
| 基础 CRUD | Workers API + 前端表单 | Server Actions + 前端表单 |
| 表格视图 | TanStack Table | TanStack Table |
| 网格视图 | 卡片组件 | 卡片组件 |
| 响应式布局 | Tailwind | Tailwind |
| **交付物** | 可录入/查看/编辑/删除书单 | 同左 |

### Phase 2: 核心功能 (1 周)

| 任务 | 路线 A (CF) | 路线 B (Vercel) |
|------|------------|----------------|
| 豆瓣抓取 | Browser Rendering API | cheerio API Route |
| 封面上传 | R2 预签名 URL | R2 预签名 URL |
| 分类管理 | D1 CRUD | Postgres CRUD |
| 标签系统 | D1 CRUD | Postgres CRUD |
| 状态流转 | D1 UPDATE | Postgres UPDATE |
| **交付物** | 支持豆瓣链接自动录入 | 同左 |

### Phase 3: 体验优化 (1 周)

| 任务 | 路线 A (CF) | 路线 B (Vercel) |
|------|------------|----------------|
| 暗色模式 | CSS 变量 + localStorage | next-themes |
| 搜索筛选 | D1 LIKE / FTS5 | Postgres GIN 全文检索 |
| 数据导出 | Workers 生成 JSON/CSV | API Route 生成 |
| 移动端适配 | Tailwind 响应式 | Tailwind 响应式 |
| 身份验证 | Cloudflare Access / JWT | NextAuth.js |
| **交付物** | 完整可用的个人书单工具 | 同左 |

### Phase 4: 锦上添花 (可选)

- 拖拽排序 (dnd-kit)
- 阅读统计 (Recharts)
- AI Agent 接入 (OpenAI API)
- PWA 离线支持
- 导入导出 (Goodreads/豆瓣备份)

---

## 八、附录

### 8.1 环境变量模板

**路线 A (Cloudflare)**：

```bash
# .dev.vars (本地开发)
JWT_SECRET=your-super-secret-jwt-key
AGENT_TOKEN=your-ai-agent-secret-token
```

```toml
# wrangler.toml
name = "bookshelf"
compatibility_date = "2026-08-17"

[site]
bucket = "./web/dist"

[[d1_databases]]
binding = "DB"
database_name = "bookshelf-db"
database_id = "your-db-id"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "bookshelf-covers"

[[browser]]
binding = "MYBROWSER"
```

**路线 B (Vercel)**：

```env
# .env.local
# Database
POSTGRES_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."

# R2 (Cloudflare)
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="bookshelf-covers"
R2_PUBLIC_URL="https://covers.your-domain.com"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""

# AI Agent
AGENT_TOKEN=""
```

### 8.2 部署检查清单

**Cloudflare 全家桶**：
- [ ] 创建 Cloudflare 账号
- [ ] 创建 D1 数据库
- [ ] 创建 R2 存储桶 (公开读取)
- [ ] 绑定 Browser Rendering 服务
- [ ] 配置 wrangler.toml
- [ ] 运行 `wrangler d1 migrations apply`
- [ ] 运行 `wrangler deploy`
- [ ] 配置自定义域名 (可选)
- [ ] 配置 Cloudflare Access (可选)

**Vercel + R2**：
- [ ] 创建 Vercel 账号
- [ ] 创建 Vercel Postgres 数据库 (或 Supabase)
- [ ] 创建 Cloudflare 账号 + R2 存储桶
- [ ] 生成 R2 API Token (S3 兼容)
- [ ] 配置 .env.local
- [ ] 运行 `drizzle-kit migrate`
- [ ] 运行 `vercel --prod`
- [ ] 配置自定义域名 (Vercel)
- [ ] 配置 R2 自定义域名 (Cloudflare)
- [ ] 配置 NextAuth.js (可选)

### 8.3 参考资源

**Cloudflare**：
- [Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 文档](https://developers.cloudflare.com/d1/)
- [R2 文档](https://developers.cloudflare.com/r2/)
- [Pages 文档](https://developers.cloudflare.com/pages/)
- [Browser Rendering](https://developers.cloudflare.com/browser-rendering/)
- [Hono 框架](https://hono.dev/)

**Vercel**：
- [Next.js 文档](https://nextjs.org/docs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [NextAuth.js](https://next-auth.js.org/)
- [TanStack Table](https://tanstack.com/table/latest)

**通用**：
- [shadcn/ui](https://ui.shadcn.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Tailwind CSS](https://tailwindcss.com/)

---

*文档结束*


 | 路线 C (Vercel+Supabase) |
|------|------------|-------------------|-------------------------|
| 豆瓣抓取 | Browser Rendering API | cheerio API Route | cheerio API Route |
| 封面上传 | R2 预签名 URL | R2 预签名 URL | **Supabase Storage 直传** |
| 分类管理 | D1 CRUD | Postgres CRUD | **Supabase Client CRUD** |
| 标签系统 | D1 CRUD | Postgres CRUD | **Supabase Client CRUD** |
| 状态流转 | D1 UPDATE | Postgres UPDATE | **Supabase Client UPDATE** |
| **交付物** | 支持豆瓣链接自动录入 | 同左 | 同左 |

### Phase 3: 体验优化 (1 周)

| 任务 | 路线 A (CF) | 路线 B (Vercel+R2) | 路线 C (Vercel+Supabase) |
|------|------------|-------------------|-------------------------|
| 暗色模式 | CSS 变量 + localStorage | next-themes | next-themes |
| 搜索筛选 | D1 LIKE / FTS5 | Postgres GIN 全文检索 | **Postgres GIN + Supabase textSearch** |
| 数据导出 | Workers 生成 JSON/CSV | API Route 生成 | **API Route 生成** |
| 移动端适配 | Tailwind 响应式 | Tailwind 响应式 | Tailwind 响应式 |
| 身份验证 | Cloudflare Access / JWT | NextAuth.js | **Supabase Auth (已内置)** |
| **交付物** | 完整可用的个人书单工具 | 同左 | 同左 |

### Phase 4: 锦上添花 (可选)

- 拖拽排序 (dnd-kit)
- 阅读统计 (Recharts)
- AI Agent 接入 (OpenAI API)
- PWA 离线支持
- 导入导出 (Goodreads/豆瓣备份)
- **实时同步 (Supabase Realtime 独有)**
- **多设备登录 (Supabase Auth 独有)**

---

## 九、附录

### 9.1 环境变量模板

**路线 A (Cloudflare)**：

```bash
# .dev.vars (本地开发)
JWT_SECRET=your-super-secret-jwt-key
AGENT_TOKEN=your-ai-agent-secret-token
```

```toml
# wrangler.toml
name = "bookshelf"
compatibility_date = "2026-08-17"

[site]
bucket = "./web/dist"

[[d1_databases]]
binding = "DB"
database_name = "bookshelf-db"
database_id = "your-db-id"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "bookshelf-covers"

[[browser]]
binding = "MYBROWSER"
```

**路线 B (Vercel + R2)**：

```env
# .env.local
# Database
POSTGRES_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."

# R2 (Cloudflare)
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="bookshelf-covers"
R2_PUBLIC_URL="https://covers.your-domain.com"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""

# AI Agent
AGENT_TOKEN=""
```

**路线 C (Vercel + Supabase)**：

```env
# .env.local
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-key"  # 仅服务端使用

# AI Agent
AGENT_TOKEN="your-ai-agent-token"
```

### 9.2 部署检查清单

**Cloudflare 全家桶**：
- [ ] 创建 Cloudflare 账号
- [ ] 创建 D1 数据库
- [ ] 创建 R2 存储桶 (公开读取)
- [ ] 绑定 Browser Rendering 服务
- [ ] 配置 wrangler.toml
- [ ] 运行 `wrangler d1 migrations apply`
- [ ] 运行 `wrangler deploy`
- [ ] 配置自定义域名 (可选)
- [ ] 配置 Cloudflare Access (可选)

**Vercel + R2**：
- [ ] 创建 Vercel 账号
- [ ] 创建 Vercel Postgres 数据库 (或 Supabase)
- [ ] 创建 Cloudflare 账号 + R2 存储桶
- [ ] 生成 R2 API Token (S3 兼容)
- [ ] 配置 .env.local
- [ ] 运行 `drizzle-kit migrate`
- [ ] 运行 `vercel --prod`
- [ ] 配置自定义域名 (Vercel)
- [ ] 配置 R2 自定义域名 (Cloudflare)
- [ ] 配置 NextAuth.js (可选)

**Vercel + Supabase**：
- [ ] 创建 Vercel 账号
- [ ] 创建 Supabase 账号 + 项目
- [ ] 在 Supabase Dashboard 创建数据库表 (SQL Editor)
- [ ] 在 Supabase Dashboard 启用 Auth (设置 providers)
- [ ] 在 Supabase Dashboard 创建 Storage bucket (covers)
- [ ] 配置 Storage bucket 为公开访问 (或设置 RLS)
- [ ] 复制 Supabase URL + Anon Key 到 .env.local
- [ ] 配置 .env.local
- [ ] 运行 `vercel --prod`
- [ ] 配置自定义域名 (Vercel)
- [ ] 配置 Supabase 自定义域名 (可选)

### 9.3 参考资源

**Cloudflare**：
- [Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 文档](https://developers.cloudflare.com/d1/)
- [R2 文档](https://developers.cloudflare.com/r2/)
- [Pages 文档](https://developers.cloudflare.com/pages/)
- [Browser Rendering](https://developers.cloudflare.com/browser-rendering/)
- [Hono 框架](https://hono.dev/)

**Vercel**：
- [Next.js 文档](https://nextjs.org/docs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [NextAuth.js](https://next-auth.js.org/)
- [TanStack Table](https://tanstack.com/table/latest)

**Supabase**：
- [Supabase 文档](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Dashboard](https://supabase.com/dashboard)

**通用**：
- [shadcn/ui](https://ui.shadcn.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Tailwind CSS](https://tailwindcss.com/)
- [cheerio](https://cheerio.js.org/)

---

## 十、快速启动命令

### 路线 A：Cloudflare 全家桶

```bash
# 1. 创建项目
npm create cloudflare@latest bookshelf -- --template=react

# 2. 进入项目
cd bookshelf

# 3. 安装依赖
npm install hono drizzle-orm @hono/zod-validator jose
npm install -D drizzle-kit wrangler

# 4. 初始化 D1
npx wrangler d1 create bookshelf-db

# 5. 创建 R2 bucket
npx wrangler r2 bucket create bookshelf-covers

# 6. 配置 wrangler.toml (复制上面的模板)

# 7. 运行迁移
npx wrangler d1 migrations apply bookshelf-db --local

# 8. 本地开发
npm run dev

# 9. 部署
npm run build
npx wrangler deploy
```

### 路线 B：Vercel + Cloudflare R2

```bash
# 1. 创建 Next.js 项目
npx create-next-app@latest bookshelf --typescript --tailwind --app

# 2. 进入项目
cd bookshelf

# 3. 安装依赖
npm install drizzle-orm @vercel/postgres next-auth cheerio
npm install -D drizzle-kit

# 4. 配置 Vercel Postgres (在 Vercel Dashboard 创建)

# 5. 配置 R2 (在 Cloudflare Dashboard 创建 bucket + API Token)

# 6. 配置 .env.local (复制上面的模板)

# 7. 运行迁移
npx drizzle-kit migrate

# 8. 本地开发
npm run dev

# 9. 部署
npx vercel --prod
```

### 路线 C：Vercel + Supabase（推荐）

```bash
# 1. 创建 Next.js 项目
npx create-next-app@latest bookshelf --typescript --tailwind --app

# 2. 进入项目
cd bookshelf

# 3. 安装依赖
npm install @supabase/supabase-js @supabase/ssr cheerio
npm install -D supabase  # CLI

# 4. 初始化 Supabase
npx supabase login
npx supabase init

# 5. 在 Supabase Dashboard 创建项目
#    - 新建项目 → 复制 URL 和 Anon Key
#    - SQL Editor → 执行建表 SQL (复制上面的模板)
#    - Authentication → 启用 Email provider
#    - Storage → 创建 covers bucket → 设置为公开

# 6. 配置 .env.local (复制上面的模板)

# 7. 本地开发
npm run dev

# 8. 部署
npx vercel --prod
```

---


---

## 十一、AI Agent 接入规范

> 为外部 AI（如 ChatGPT、Claude、Dify、Coze 等）提供标准化接口，使其能够通过自然语言或结构化指令对书单进行查询、添加和编辑。

### 11.1 认证体系：Agent Token

AI Agent 使用独立的 Token 认证，与前端用户认证（JWT / NextAuth / Supabase Auth）完全隔离。

**Token 设计：**

```typescript
// 数据库表：agent_tokens
CREATE TABLE agent_tokens (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,              -- Token 别名，如 "ChatGPT-Plugin"
  token_hash TEXT NOT NULL UNIQUE, -- bcrypt hash of "agt_xxx"
  permissions TEXT[] DEFAULT '{read,write}', -- read | write | admin
  rate_limit_rpm INTEGER DEFAULT 30,         -- 每分钟请求上限
  daily_quota INTEGER DEFAULT 500,           -- 每日操作上限
  ip_whitelist TEXT[],             -- 可选 IP 白名单
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

**请求头：**

```http
Authorization: Bearer agt_bookshelf_xxxxxxxxxxxxxxxx
Content-Type: application/json
```

**三种权限级别：**

| 权限 | 允许操作 |
|------|---------|
| `read` | GET 查询、统计数据 |
| `write` | read + POST/PATCH/DELETE（受频率限制） |
| `admin` | write + 管理 Token、导出备份、覆盖导入 |

---

### 11.2 API 端点一览

所有 Agent API 统一前缀 `/api/agent`，返回 JSON 格式。

#### 11.2.1 查询书籍（自然语言 + 结构化）

```http
POST /api/agent/books/query
```

**请求体（自然语言模式）：**

```json
{
  "query": "帮我找一下村上春树的书，评分4分以上还没读完的",
  "limit": 10
}
```

**请求体（结构化模式）：**

```json
{
  "filters": {
    "author": "村上春树",
    "rating_min": 4,
    "status_not": "finished"
  },
  "sort": "rating_desc",
  "limit": 10
}
```

**响应：**

```json
{
  "success": true,
  "action": "search",
  "results": [
    {
      "id": 5,
      "title": "挪威的森林",
      "author": "村上春树",
      "status": "reading",
      "rating": 4,
      "category": "文学小说"
    }
  ],
  "total": 1,
  "sql_equivalent": "SELECT * FROM books WHERE author LIKE '%村上春树%' AND rating >= 4 AND status != 'finished' ORDER BY rating DESC LIMIT 10"
}
```

#### 11.2.2 添加书籍

```http
POST /api/agent/books
```

**模式 A：结构化录入**

```json
{
  "title": "挪威的森林",
  "author": "村上春树",
  "publisher": "上海译文出版社",
  "status": "wish",
  "category": "文学",
  "tags": ["日本文学", "爱情"],
  "rating": 4
}
```

**模式 B：自然语言录入（AI 解析）**

```json
{
  "natural": "把村上春树的《挪威的森林》加到计划阅读里，分类文学小说"
}
```

**模式 C：豆瓣链接自动抓取**

```json
{
  "douban_url": "https://book.douban.com/subject/1046209/",
  "status": "wish",
  "category": "文学"
}
```

**响应：**

```json
{
  "success": true,
  "action": "create",
  "book": { "id": 25, "title": "挪威的森林", ... },
  "source": "douban_scrape",
  "message": "已成功从豆瓣抓取并添加《挪威的森林》"
}
```

#### 11.2.3 更新书籍属性

```http
PATCH /api/agent/books/:id
```

```json
{
  "updates": {
    "status": "finished",
    "rating": 5,
    "tags": ["经典", "重读"]
  }
}
```

**支持部分更新**，只允许修改 `agentWritableFields` 白名单内的字段。

#### 11.2.4 删除书籍

```http
DELETE /api/agent/books/:id
```

**默认软删除**（设置 `deleted_at`），`admin` 权限可传 `?hard=true` 进行硬删除。

```json
{
  "success": true,
  "action": "soft_delete",
  "book_id": 5,
  "message": "《挪威的森林》已移至回收站，30 天后自动清理"
}
```

#### 11.2.5 批量操作

```http
POST /api/agent/books/batch
```

```json
{
  "operations": [
    { "action": "create", "data": { "title": "新书1", ... } },
    { "action": "update", "id": 5, "data": { "status": "finished" } },
    { "action": "delete", "id": 12 }
  ]
}
```

**响应：**

```json
{
  "success": true,
  "summary": { "created": 1, "updated": 1, "deleted": 1, "failed": 0 },
  "results": [
    { "index": 0, "success": true, "book_id": 26 },
    { "index": 1, "success": true, "book_id": 5 },
    { "index": 2, "success": true, "book_id": 12 }
  ]
}
```

#### 11.2.6 元数据预抓取（不写入）

```http
POST /api/agent/books/scrape-preview
```

```json
{ "douban_url": "https://book.douban.com/subject/1046209/" }
```

返回解析后的元数据，供 AI 确认后再调用 `POST /api/agent/books` 写入。

#### 11.2.7 阅读统计

```http
GET /api/agent/books/stats
```

```json
{
  "total": 42,
  "by_status": { "wish": 12, "reading": 7, "finished": 18, "dropped": 3, "archived": 2 },
  "by_category": { "文学": 15, "科技": 8, "历史": 6, "社科": 9, "哲学": 4 },
  "recent_added": 5,
  "avg_rating": 4.2
}
```

---

### 11.3 自然语言查询层（NL-to-Query）

AI Agent 的核心体验在于**自然语言交互**。建议在应用层实现一个轻量的 NL 解析器，无需引入 LLM，通过规则 + 关键词匹配即可覆盖 90% 场景。

**解析规则示例：**

```typescript
function parseNaturalQuery(query: string): QueryParams {
  const params: QueryParams = {};

  // 状态识别
  if (/在读|正在读|reading/.test(query)) params.status = 'reading';
  if (/已读完|读完|finished/.test(query)) params.status = 'finished';
  if (/想读|计划|wish/.test(query)) params.status = 'wish';

  // 评分识别
  const ratingMatch = query.match(/(\d)\s*分以[上高]/);
  if (ratingMatch) params.rating_min = parseInt(ratingMatch[1]);

  // 分类识别
  if (/文学|小说/.test(query)) params.category = '文学';
  if (/科技|编程|计算机/.test(query)) params.category = '科技';

  // 作者识别（简单匹配）
  const authorMatch = query.match(/(.+?)(?:写|著|的)/);
  if (authorMatch) params.author = authorMatch[1].trim();

  return params;
}
```

**高级场景**（如需理解复杂条件），可将用户 query 转发给 LLM（OpenAI Function Calling），让 LLM 输出结构化 `filters` 对象，再执行数据库查询。

---

### 11.4 字段权限白名单

明确界定 AI 可操作字段，防止误改系统字段。

```typescript
const AGENT_WRITABLE_FIELDS = [
  'title', 'subtitle', 'author', 'translator',
  'publisher', 'publish_date', 'isbn', 'page_count',
  'description', 'status', 'rating', 'category_id',
  'tags', 'douban_url', 'source_url'
];

const AGENT_READONLY_FIELDS = [
  'id', 'created_at', 'updated_at',
  'cover_key', 'cover_url', 'source_type'
];

// 更新时过滤
function sanitizeAgentUpdate(data: any) {
  const sanitized: any = {};
  for (const key of Object.keys(data)) {
    if (AGENT_WRITABLE_FIELDS.includes(key)) {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}
```

---

### 11.5 AI 友好错误返回

AI 不擅长解析 HTTP 状态码，所有错误返回体必须包含 `message` 和 `suggestion`：

```json
{
  "success": false,
  "error_code": "BOOK_NOT_FOUND",
  "message": "未找到 ID 为 99 的书籍，请确认 ID 是否正确。当前书架共有 42 本书。",
  "suggestion": "你可以先用查询接口搜索书名来确认正确的 ID。",
  "available_books": ["百年孤独 (id:1)", "三体 (id:2)", "..."]
}
```

**错误码列表：**

| 错误码 | 场景 | HTTP 状态 |
|--------|------|----------|
| `UNAUTHORIZED` | Token 无效或过期 | 401 |
| `FORBIDDEN` | 权限不足 | 403 |
| `RATE_LIMITED` | 触发频率限制 | 429 |
| `BOOK_NOT_FOUND` | 书籍 ID 不存在 | 404 |
| `INVALID_FIELD` | 尝试修改只读字段 | 400 |
| `DUPLICATE_BOOK` | 重复添加（ISBN 或标题+作者重复）| 409 |
| `SCRAPE_FAILED` | 豆瓣抓取失败 | 502 |
| `BATCH_PARTIAL_FAIL` | 批量操作部分失败 | 207 |

---

### 11.6 防清库机制（速率限制与操作上限）

这是 AI 接入的**安全核心**。即使 Token 泄露或 AI 出现幻觉，也能确保数据安全。

#### 11.6.1 多层频率限制

| 限制层级 | 阈值 | 作用范围 | 超限响应 |
|---------|------|---------|---------|
| **请求频率** | 30 req/min | 单 Token | 429 + `Retry-After: 60` |
| **写入频率** | 10 write/min | 单 Token | 429 + 提示降速 |
| **删除频率** | 3 delete/min | 单 Token | 429 + 需人工确认 |
| **批量上限** | 单次最多 10 条 | 单请求 | 400 + 建议分批 |
| **每日配额** | 500 ops/day | 单 Token | 429 + 次日恢复 |
| **全库保护** | 24h 内删除不超过 20% | 全局 | 403 + 需 admin 确认 |

**实现示例（Redis / D1 / 内存）：**

```typescript
// 基于 Redis 的滑动窗口限流
async function checkRateLimit(tokenId: string, action: string): boolean {
  const key = `ratelimit:${tokenId}:${action}`;
  const now = Date.now();
  const window = action === 'delete' ? 60_000 : 60_000; // 1分钟窗口
  const limit = action === 'delete' ? 3 : (action === 'write' ? 10 : 30);

  // 清理过期记录
  await redis.zremrangebyscore(key, 0, now - window);
  // 统计当前窗口内请求数
  const count = await redis.zcard(key);

  if (count >= limit) return false;

  await redis.zadd(key, now, `${now}-${Math.random()}`);
  await redis.expire(key, 60);
  return true;
}
```

#### 11.6.2 删除保护机制

```typescript
// 1. 默认软删除
async function agentDeleteBook(id: number, hard: boolean = false) {
  if (hard) {
    // 仅 admin 权限可硬删除
    if (!isAdmin) throw new Error('FORBIDDEN');
    // 硬删除前自动触发备份
    await autoBackupBeforeDelete(id);
  }

  // 2. 全库删除比例检查
  const totalBooks = await db.count(books);
  const recentDeleted = await db.count(books, { deleted_after: '24h' });
  if (recentDeleted / totalBooks > 0.2) {
    throw new Error('全库删除比例超过 20%，操作已拦截，请联系管理员。');
  }

  // 3. 单 Token 删除上限
  const tokenDeletedToday = await getTokenDeletedCount(tokenId, '24h');
  if (tokenDeletedToday >= 20) {
    throw new Error('该 Token 今日删除已达上限（20 本），请明日再试或联系管理员。');
  }

  return await db.update(books, id, { deleted_at: new Date() });
}
```

#### 11.6.3 批量操作熔断

```typescript
// 批量操作上限与熔断
const BATCH_LIMIT = 10;

async function agentBatch(operations: any[]) {
  if (operations.length > BATCH_LIMIT) {
    return {
      success: false,
      error_code: 'BATCH_TOO_LARGE',
      message: `批量操作一次最多 ${BATCH_LIMIT} 条，当前 ${operations.length} 条。`,
      suggestion: '请分批处理，每批不超过 10 条。'
    };
  }

  // 统计本次批量中的删除数量
  const deleteCount = operations.filter(op => op.action === 'delete').length;
  if (deleteCount > 3) {
    return {
      success: false,
      error_code: 'BATCH_DELETE_LIMIT',
      message: `批量操作中删除不能超过 3 条，当前 ${deleteCount} 条。`,
      suggestion: '删除操作请分批进行，或单独调用删除接口。'
    };
  }

  // 逐条执行，单条失败不影响其他
  const results = [];
  for (let i = 0; i < operations.length; i++) {
    try {
      const result = await executeSingle(operations[i]);
      results.push({ index: i, success: true, ...result });
    } catch (err) {
      results.push({ index: i, success: false, error: err.message });
    }
  }

  return { success: true, results };
}
```

#### 11.6.4 操作审计日志

```sql
CREATE TABLE agent_audit_logs (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES agent_tokens(id),
  action TEXT NOT NULL,        -- create / update / delete / query
  target_type TEXT,            -- book / category / tag
  target_id INTEGER,
  payload JSONB,               -- 请求内容
  response JSONB,              -- 响应内容
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX idx_audit_token ON agent_audit_logs(token_id, created_at DESC);
CREATE INDEX idx_audit_action ON agent_audit_logs(action, created_at DESC);
```

---

### 11.7 各路线实现差异

| 功能 | 路线 A (CF) | 路线 B/C (Vercel) |
|------|------------|-------------------|
| **限流存储** | D1 表 / KV | Redis (Upstash) / Vercel KV |
| **Token 验证** | Workers 中间件 | Next.js Middleware / API Route |
| **审计日志** | D1 表 | Postgres 表 |
| **NL 解析** | Workers 内联 | Serverless Function |
| **批量事务** | D1 事务 | Postgres 事务 |

---

## 十二、数据备份与恢复

> 提供两种备份方案，满足不同场景需求：轻量 CSV 导出适合日常迁移，全量压缩包适合完整存档与恢复。

### 12.1 方案 A：CSV 导出/导入（轻量）

**适用场景：**
- 日常数据迁移（换平台、换数据库）
- 用 Excel / Numbers 查看和编辑书单
- 导入到 Notion / Airtable 等其他工具

#### 12.1.1 CSV 导出

```http
GET /api/export/csv
Authorization: Bearer <user-jwt-or-agent-token>
```

**导出字段：**

```csv
title,subtitle,author,translator,publisher,publish_date,isbn,page_count,status,rating,category,tags,description,source_url,created_at
百年孤独,Cien años de soledad,加西亚·马尔克斯,,南海出版公司,2011,9787544253994,360,finished,5,文学,"经典,魔幻现实主义,诺贝尔奖",描写了布恩迪亚家族七代人的传奇故事...,https://book.douban.com/subject/6082808/,2024-01-15
```

**实现（路线 B/C）：**

```typescript
// app/api/export/csv/route.ts
import { stringify } from 'csv-stringify/sync';

export async function GET(req: Request) {
  const books = await db.select().from(booksTable)
    .where(isNull(booksTable.deleted_at))
    .orderBy(desc(booksTable.created_at));

  const records = books.map(b => ({
    title: b.title,
    subtitle: b.subtitle || '',
    author: b.author || '',
    translator: b.translator || '',
    publisher: b.publisher || '',
    publish_date: b.publish_date || '',
    isbn: b.isbn || '',
    page_count: b.page_count || '',
    status: b.status,
    rating: b.rating || '',
    category: b.category?.name || '',
    tags: b.tags?.map(t => t.name).join(',') || '',
    description: b.description || '',
    source_url: b.source_url || '',
    created_at: b.created_at
  }));

  const csv = stringify(records, { header: true });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookshelf-${formatDate(new Date())}.csv"`
    }
  });
}
```

#### 12.1.2 CSV 导入

```http
POST /api/import/csv
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <bookshelf-2024-08-17.csv>
mode: merge | overwrite   // merge: 增量合并（默认）; overwrite: 先清空再导入
```

**导入逻辑：**

```typescript
async function importCSV(file: File, mode: 'merge' | 'overwrite') {
  const parser = parse({ columns: true, skip_empty_lines: true });
  const records = [];

  for await (const record of parser) {
    // 1. 数据清洗
    const book = {
      title: record.title?.trim(),
      author: record.author?.trim() || null,
      isbn: record.isbn?.trim() || null,
      status: ['wish','reading','finished','dropped','archived'].includes(record.status) 
        ? record.status : 'wish',
      rating: record.rating ? parseInt(record.rating) : null,
      // ...
    };

    // 2. 去重检查（ISBN 优先，其次 标题+作者）
    const existing = await findDuplicate(book);
    if (existing && mode === 'merge') {
      // 合并：更新空字段，保留已有数据
      await db.update(booksTable).set(mergeFields(existing, book)).where(eq(booksTable.id, existing.id));
    } else {
      records.push(book);
    }
  }

  if (mode === 'overwrite') {
    await db.delete(booksTable); // 软删除或真删除，视策略而定
  }

  await db.insert(booksTable).values(records);

  return { imported: records.length, updated: duplicatesMerged, errors: [] };
}
```

**导入冲突处理策略：**

| 策略 | 行为 |
|------|------|
| `skip`（默认） | ISBN 已存在则跳过 |
| `merge` | 合并空字段，保留已有评分/状态 |
| `overwrite` | 用 CSV 数据覆盖已有记录 |
| `create_new` | 即使重复也新建（会产生重复条目） |

---

### 12.2 方案 B：全量压缩包导出/导入（含封面）

**适用场景：**
- 完整数据归档（包含封面图）
- 跨平台完整迁移（如从 Vercel 迁到 Cloudflare）
- 定期自动备份

#### 12.2.1 压缩包结构

```
bookshelf-backup-2024-08-17.zip
├── manifest.json           # 备份元数据
├── books.json              # 完整书籍数据（含关联表）
├── categories.json         # 分类数据
├── tags.json               # 标签数据
├── covers/                 # 封面图片
│   ├── cover_1_1705312800.jpg
│   ├── cover_2_1705312900.jpg
│   └── ...
└── README.txt              # 备份说明
```

**manifest.json：**

```json
{
  "version": "1.0",
  "exported_at": "2024-08-17T14:30:00+08:00",
  "app_version": "bookshelf-v1.2.0",
  "record_counts": {
    "books": 42,
    "categories": 5,
    "tags": 18,
    "covers": 40
  },
  "checksums": {
    "books.json": "sha256:abc123...",
    "covers/cover_1.jpg": "sha256:def456..."
  }
}
```

**books.json 格式：**

```json
{
  "books": [
    {
      "id": 1,
      "title": "百年孤独",
      "cover_filename": "covers/cover_1_1705312800.jpg",
      "cover_mime": "image/jpeg",
      "categories": ["文学"],
      "tags": ["经典", "魔幻现实主义"],
      "...": "..."
    }
  ]
}
```

#### 12.2.2 压缩包导出实现

```typescript
// app/api/export/full/route.ts
import { ZipWriter, BlobWriter, TextReader, BlobReader } from '@zip.js/zip.js';

export async function GET(req: Request) {
  const zipWriter = new ZipWriter(new BlobWriter('application/zip'));

  // 1. 导出书籍数据
  const books = await db.select().from(booksTable)
    .where(isNull(booksTable.deleted_at));
  const categories = await db.select().from(categoriesTable);
  const tags = await db.select().from(tagsTable);

  const exportData = { books, categories, tags };
  await zipWriter.add('books.json', new TextReader(JSON.stringify(exportData, null, 2)));

  // 2. 导出封面图
  for (const book of books) {
    if (book.cover_key) {
      const imageBlob = await getCoverFromStorage(book.cover_key); // R2 / Supabase Storage
      await zipWriter.add(`covers/${book.cover_key}`, new BlobReader(imageBlob));
    }
  }

  // 3. 生成 manifest
  const manifest = generateManifest(exportData);
  await zipWriter.add('manifest.json', new TextReader(JSON.stringify(manifest, null, 2)));

  const zipBlob = await zipWriter.close();

  return new Response(zipBlob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="bookshelf-full-${formatDate(new Date())}.zip"`
    }
  });
}
```

**各路线存储读取差异：**

| 路线 | 封面存储 | 读取方式 |
|------|---------|---------|
| A (CF) | R2 | `env.BUCKET.get(key)` |
| B (Vercel+R2) | R2 | S3 SDK `GetObjectCommand` |
| C (Supabase) | Supabase Storage | `supabase.storage.from('covers').download(key)` |

#### 12.2.3 压缩包导入恢复

```http
POST /api/import/full
Content-Type: multipart/form-data
Authorization: Bearer <admin-token>   // 导入需要 admin 权限

file: <bookshelf-full-2024-08-17.zip>
mode: merge | overwrite
dry_run: false   // true 时只校验不写入
```

**导入流程：**

```typescript
async function importFullBackup(zipFile: File, mode: 'merge' | 'overwrite', dryRun: boolean) {
  // 1. 解压并校验 manifest
  const zipReader = new ZipReader(new BlobReader(zipFile));
  const entries = await zipReader.getEntries();

  const manifestEntry = entries.find(e => e.filename === 'manifest.json');
  const manifest = JSON.parse(await manifestEntry.getData(new TextWriter()));

  // 校验完整性
  const validation = await validateBackup(entries, manifest);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  if (dryRun) {
    return { success: true, dry_run: true, preview: validation.preview };
  }

  // 2. 导入分类（先导入，因为书籍依赖分类）
  const categoriesData = JSON.parse(
    await entries.find(e => e.filename === 'categories.json').getData(new TextWriter())
  );
  const categoryIdMap = await importCategories(categoriesData, mode);

  // 3. 导入标签
  const tagsData = JSON.parse(
    await entries.find(e => e.filename === 'tags.json').getData(new TextWriter())
  );
  const tagIdMap = await importTags(tagsData, mode);

  // 4. 导入书籍
  const booksData = JSON.parse(
    await entries.find(e => e.filename === 'books.json').getData(new TextWriter())
  );

  if (mode === 'overwrite') {
    // 软删除所有现有书籍（保留审计）
    await db.update(booksTable).set({ deleted_at: new Date() }).where(isNull(booksTable.deleted_at));
  }

  for (const book of booksData.books) {
    // 映射新旧分类/标签 ID
    const newCategoryIds = book.categories.map(oldId => categoryIdMap[oldId]);
    const newTagIds = book.tags.map(oldId => tagIdMap[oldId]);

    // 导入封面图到存储
    let newCoverKey = null;
    if (book.cover_filename) {
      const coverEntry = entries.find(e => e.filename === book.cover_filename);
      if (coverEntry) {
        const coverBlob = await coverEntry.getData(new BlobWriter());
        newCoverKey = await uploadCoverToStorage(coverBlob, book.cover_mime);
      }
    }

    // 插入书籍
    const [newBook] = await db.insert(booksTable).values({
      ...omit(book, ['id', 'cover_filename', 'categories', 'tags']),
      cover_key: newCoverKey
    }).returning();

    // 重建关联
    await db.insert(bookCategoriesTable).values(
      newCategoryIds.map(cid => ({ book_id: newBook.id, category_id: cid }))
    );
    await db.insert(bookTagsTable).values(
      newTagIds.map(tid => ({ book_id: newBook.id, tag_id: tid }))
    );
  }

  return {
    success: true,
    imported: { books: booksData.books.length, categories: categoriesData.length, tags: tagsData.length },
    mode
  };
}
```

---

### 12.3 备份策略建议

| 策略 | 频率 | 方式 | 保留期 |
|------|------|------|--------|
| **自动 CSV 导出** | 每周 | Serverless Cron / Durable Object Alarm | 保留最近 8 周 |
| **自动全量备份** | 每月 | 同上，导出到 R2 / S3 归档桶 | 保留最近 6 个月 |
| **手动导出** | 随时 | 用户点击导出按钮 | 即时下载 |
| **导入前自动备份** | 每次导入前 | 自动快照当前数据 | 保留最近 10 次 |

**自动备份 Cron 配置（路线 A - Cloudflare）：**

```toml
# wrangler.toml
[[triggers]]
crons = ["0 2 * * 0"]  # 每周日凌晨 2 点
```

```typescript
// 在 Worker 中处理定时触发
export default {
  async scheduled(controller: ScheduledController, env: Env) {
    // 1. 导出 CSV
    const csv = await exportToCSV(env.DB);
    await env.BUCKET.put(`backups/auto/weekly/bookshelf-${Date.now()}.csv`, csv);

    // 2. 清理旧备份（保留 8 周）
    await cleanupOldBackups(env.BUCKET, 'backups/auto/weekly/', 8);
  }
};
```

**自动备份 Cron 配置（路线 B/C - Vercel）：**

```typescript
// vercel.json
{
  "crons": [
    { "path": "/api/backup/auto", "schedule": "0 2 * * 0" }
  ]
}
```

---

## 十三、部署检查清单（补充项）

在原有 8.2 基础上增加 AI 与备份相关检查项：

**AI Agent 接入：**
- [ ] 创建 `agent_tokens` 表并插入初始 Token
- [ ] 配置 Agent Token 环境变量 `AGENT_TOKEN`
- [ ] 设置限流中间件（Redis / KV）
- [ ] 创建 `agent_audit_logs` 表
- [ ] 测试自然语言查询接口
- [ ] 测试批量操作与熔断机制

**备份恢复：**
- [ ] 配置自动备份 Cron 任务
- [ ] 创建备份存储目录（R2 bucket / S3 prefix）
- [ ] 测试 CSV 导出/导入
- [ ] 测试全量压缩包导出/导入（含封面）
- [ ] 验证导入前自动快照功能
- [ ] 配置旧备份自动清理策略

---

*文档结束*
*文档结束*