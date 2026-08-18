# Bookshelf（个人书单管理工具）

单用户、单人使用的个人书库管理工具：以 Notion 式表格视图与卡片网格视图管理藏书，支持三态状态（未读 / 在读 / 读完）、自定义分类与标签、豆瓣元数据抓取、封面存储，并对外提供 AI Agent REST 接口（Bearer Key 鉴权）供外部 AI 查询 / 新增 / 编辑 / 删除书籍。

技术路线：Cloudflare 全家桶（单 Worker + D1 + R2 + KV）托管与部署。详见 `DOCS/`。

## 功能亮点（当前已实现）

- **书籍管理**：完整 CRUD，支持书名 / 作者 / 译者 / 出版社 / 出版年 / 页数 / 原作名 / ISBN / 简介 / **记录（≤2000 字）** / 封面 / 豆瓣链接 / 评分 / 来源 / 状态，按状态自动记录 `started_at` / `finished_at`。
- **双视图**：表格视图（Notion 式）与网格视图（卡片式）自由切换，响应式适配桌面端与移动端。
- **筛选与搜索**：按状态（3 态）/ 分类 / 标签 / 关键词搜索，多种排序（更新时间 / 书名 / 评分）。
- **分类与标签**：自定义分类（颜色标识）与多对多标签，支持新增 / 改名 / 删除。
- **回收站**：软删除 + 回收站视图，可恢复 / 彻底删除（二次确认）/ 清空。
- **元数据抓取**：粘贴豆瓣链接或 ISBN 自动抓取（豆瓣 → 兜底源）并回填表单；封面下载存储到 R2 后经站内代理路径下发。
- **AI Agent 接入**：`/api/agent/*` REST 接口 + Bearer Key 鉴权（多 Key 轮换、上限 3、可撤销），支持查询 / 新增 / 编辑 / 软删除；写操作 10 次 / 10 分钟、删除加严 10 次 / 1 小时限频；从结构上禁止 AI 操作回收站。
- **导入 / 导出**：CSV 导出（模板 / 内容）、CSV 导入（预览 → 去重 → 勾选确认 → 进度条），分类 / 标签按名复用。
- **鉴权与安全**：bcrypt 口令 + 签名会话 Cookie（无状态），登录失败 KV 封锁（暴力破解防护），首次请求自动幂等建表 + seed 初始管理员。
- **主题与视觉**：明暗主题切换、灰质纸张质感视觉体系、封面缺图纯色占位（基于书名哈希生成）等。

## 一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/maxxie6418/Bookshelf)

> 点击按钮会：克隆仓库到你的账号 → 自动创建并绑定 D1 / R2 / KV（KV 同名自动复用，见下）→ 读取 `.dev.vars.example` 让你在向导里填写 secret（`SESSION_SECRET` / `INITIAL_ADMIN_PASSWORD`）→ 自动构建 + 部署。**首次请求会自动建表并 seed 初始管理员**（不再依赖外部迁移命令）：用户名 `admin`，口令为你填写的 `INITIAL_ADMIN_PASSWORD`；未填写则默认为 `admin123`（首登强制改口令，请部署后立即登录修改）。

## 技术栈

- 前端：Tailwind CSS + Vite 构建到 `dist/`，由 Worker 的 Workers Assets 托管（SPA）
- 后端：单个 Cloudflare Worker（Hono）
- 数据库：Cloudflare D1（SQLite，Drizzle ORM）
- 对象存储：R2（封面：抓取后下载写入 R2，经 `/api/covers/:key` 站内代理路径下发）
- 边缘 KV：登录失败封锁、Agent Key 存储与限频计数、抓取节流
- 鉴权：bcrypt 口令 + 签名会话 Cookie（无状态会话）；AI Agent 用 Bearer Key（SHA-256 哈希，仅存哈希）
- 可观测性：`wrangler.jsonc` 开启 observability，全局错误处理输出错误栈到运行日志

## 开发前准备

1. 安装依赖：`npm install`（需要 Node 18+，建议 20+）
2. 准备本地开发变量：复制 `.dev.vars.example` 为 `.dev.vars` 并填写（`SESSION_SECRET` 必填；本地为空时会有会话密钥回退兜底，仅建议生产显式设置）
3. 类型检查：`npm run typecheck`
4. 本地预览（全栈）：`npm run dev`

> Wrangler 4.45+ 支持自动资源创建：`wrangler.jsonc` 中的 D1/R2/KV 绑定不写资源 ID，部署时会自动创建或按名字复用已存在的资源（D1 `bookshelf`、R2 `bookshelf-covers`）。无需手动维护资源 ID，仓库也永不包含账号私有 ID，其他人 fork 后同样可以一键部署到自己的账号。
>
> **KV 同名复用**（绕开 wrangler auto-provisioning 的已知 bug [workers-sdk#14284](https://github.com/cloudflare/workers-sdk/issues/14284)）：`npm run build` 会先运行 `scripts/prepare-kv.mjs`，查询账号中是否已有同名 KV（`bookshelf-kv`）——有则自动注入其 ID 复用（不再触发创建、不会报 10014），无则交由 wrangler 首次自动创建、后续部署再查即可复用。**本地仅构建不部署时若 `wrangler.jsonc` 被注入 ID，属正常行为，请勿提交该改动**（可用 `git checkout -- wrangler.jsonc` 还原）。

## 数据库迁移

首次部署/首次请求会自动幂等建表（见 `src/lib/bootstrap.ts`），因此通常无需手动跑迁移。如需手动管理增量迁移：

```bash
npm run migrate          # 本地 D1
npx wrangler d1 migrations apply bookshelf --remote   # 远程（deploy/setup 脚本已自动执行）
```

## 手动部署（命令行）

**方式 A — 全自动部署（`npm run setup`）**

```bash
npm run setup            # node scripts/setup.mjs：构建 → wrangler deploy（自动创建/复用 D1/R2/KV）→ 远程迁移 → 提示 secrets
```

**方式 B — 增量部署（`npm run deploy`）**

```bash
npm run deploy           # node scripts/deploy.mjs：构建 → wrangler deploy → 远程迁移
```

部署前请设置 secrets（密钥不入库）：

```bash
npx wrangler secret put SESSION_SECRET                 # 必填：签名会话 Cookie 的 HMAC 密钥（>=16 位随机串；为空时会自动派生回退密钥，仅建议生产显式设置）
npx wrangler secret put INITIAL_ADMIN_PASSWORD         # 可选：未设置时默认 admin/admin123（首次请求自动 seed，首登强制改口令）
npx wrangler secret put AI_BASE_URL                    # 可选：AI 集成相关（当前预留，未配置也不会影响核心功能）
npx wrangler secret put AI_API_KEY                     # 可选：同上
```

本地开发 seed：`npm run seed`（本地 D1 建表 + seed 初始管理员）。

## 数据库 schema（D1）

- `users`：用户（单用户，含 `must_change_password`）
- `books`：书籍核心表（含软删 `deleted_at`、`notes` 记录字段、状态、来源等）
- `categories` / `tags` / `book_tags`：分类 / 标签 / 多对多关联
- `settings`：配置项

增量迁移见 `migrations/`（`0000_init.sql` / `0001_add_notes.sql`），运行时自动建表逻辑见 `src/lib/schema.ts`。

## 里程碑进度

- ✅ M0 脚手架 + 鉴权骨架（本仓库初始提交）
- ✅ M1 数据模型与核心 CRUD（含软删 + 回收站、分类 / 标签）
- ✅ M2 双视图 + 筛选 + 响应式 + 登录门禁（含回收站视图、修改口令、分类 / 标签管理）
- ✅ M3 豆瓣抓取 + 封面（R2 代理）
- ✅ M5 导出（模板 / 内容）+ 导入（预览去重）+ 暗色 + 视觉打磨
- ✅ 额外：AI Agent REST 接口（Bearer Key 鉴权 + 限频 + 禁回收站）、书籍「记录」字段、首次请求自动建表、Session 密钥回退、运行日志与错误栈等（替换了原规划的 M4「AI 查询」）

> 注：原 M4 规划为「自然语言 AI 查询 `/api/query`」，实际以**面向外部 AI Agent 的 REST 接口（`/api/agent/*`）**落地，能力为查询 / 新增 / 编辑 / 删除书籍。

详见 `DOCS/产品需求总指导文件.md`、`DOCS/API接口手册.md` 与 `META/WORKLIST/20260817-书架开发计划-v1.md`。
