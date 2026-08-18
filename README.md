# Bookshelf（个人书单管理工具）

路线 A：Cloudflare 全家桶（单 Worker + D1 + R2 + KV）。详见 `DOCS/`。

## 一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/maxxie6418/Bookshelf)

> 点击按钮会：克隆仓库到你的账号 → 自动创建并绑定 D1 / R2 / KV（KV 同名自动复用，见下）→ 读取 `.dev.vars.example` 让你在向导里填写 secret（`SESSION_SECRET` / `INITIAL_ADMIN_PASSWORD` / AI 密钥）→ 自动跑 D1 迁移 + 构建 + 部署。首次请求会自动 seed 初始管理员：用户名 `admin`，口令为你填写的 `INITIAL_ADMIN_PASSWORD`；未填写则默认为 `admin123`（首登强制改口令，请部署后立即登录修改）。

## 技术栈

- 前端：Tailwind CSS + Vite 构建到 `dist/`，由 Worker 的 Workers Assets 托管
- 后端：单个 Cloudflare Worker（Hono）
- 数据库：Cloudflare D1（SQLite，Drizzle ORM）
- 对象存储：R2（封面，首版经 Image Resizing 代理，不主动写入）
- 边缘 KV：登录失败封锁
- 鉴权：bcrypt 口令 + 签名会话 Cookie（无状态）

## 开发前准备

1. 安装依赖：`npm install`（需要 Node 18+，建议 20+）
2. 安装并登录 Cloudflare：`npx wrangler login`（或设置 `CF_API_TOKEN`）
3. 类型检查：`npm run typecheck`
4. 本地预览（全栈）：`npm run dev`

> Wrangler 4.45+ 支持自动资源创建：`wrangler.jsonc` 中的 D1/R2/KV 绑定不写资源 ID，部署时会自动创建或按名字复用已存在的资源（D1 `bookshelf`、R2 `bookshelf-covers`）。无需手动维护资源 ID，仓库也永不包含账号私有 ID，其他人 fork 后同样可以一键部署到自己的账号。
>
> **KV 同名复用**（绕开 wrangler auto-provisioning 的已知 bug [workers-sdk#14284](https://github.com/cloudflare/workers-sdk/issues/14284)）：`npm run build` 会先运行 `scripts/prepare-kv.mjs`，查询账号中是否已有同名 KV（`bookshelf-kv`）——有则自动注入其 ID 复用（不再触发创建、不会报 10014），无则交由 wrangler 首次自动创建、后续部署再查即可复用。**本地仅构建不部署时若 `wrangler.jsonc` 被注入 ID，属正常行为，请勿提交该改动**（可用 `git checkout -- wrangler.jsonc` 还原）。

## 数据库迁移

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
npx wrangler secret put SESSION_SECRET
npx wrangler secret put INITIAL_ADMIN_PASSWORD   # 可选；未设置时默认 admin/admin123（首次请求自动 seed，首登强制改口令）
npx wrangler secret put AI_BASE_URL   # M4 用，可选
npx wrangler secret put AI_API_KEY    # M4 用，可选
```

本地开发 seed：`npm run seed`（本地 D1 建表 + seed 初始管理员）。

## 当前里程碑进度

- ✅ M0 脚手架 + 鉴权骨架（本仓库初始提交）
- ⏳ M1 数据模型与核心 CRUD（含软删 + 回收站）
- ⏳ M2 双视图 + 筛选 + 响应式 + 登录门禁
- ⏳ M3 豆瓣抓取 + 封面
- ⏳ M4 AI 查询
- ⏳ M5 导出 + 导入 + 暗色 + 打磨

详见 `DOCS/产品需求总指导文件.md` 与 `META/WORKLIST/20260817-书架开发计划-v1.md`。