# Bookshelf（个人书单管理工具）

路线 A：Cloudflare 全家桶（单 Worker + D1 + R2 + KV）。详见 `DOCS/`。

## 技术栈

- 前端：Tailwind CSS + Vite 构建到 `dist/`，由 Worker 的 Workers Assets 托管
- 后端：单个 Cloudflare Worker（Hono）
- 数据库：Cloudflare D1（SQLite，Drizzle ORM）
- 对象存储：R2（封面，首版经 Image Resizing 代理，不主动写入）
- 边缘 KV：登录失败封锁
- 鉴权：bcrypt 口令 + 签名会话 Cookie（无状态）

## 开发前准备

1. 安装依赖：`npm install`
2. 安装并登录 Cloudflare：`npx wrangler login`（或设置 `CF_API_TOKEN`）
3. 类型检查：`npm run typecheck`
4. 本地预览（全栈）：`npm run dev`

## 数据库迁移

```bash
npm run migrate          # 本地 D1
npx wrangler d1 execute bookshelf --remote --file=./migrations/0000_init.sql   # 远程
```

## 一键部署

```bash
npm run deploy           # node scripts/setup.mjs：建资源 → 迁移 → seed 初始管理员 → 提示设置 secrets → 部署
```

部署前请设置 secrets（密钥不入库）：

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put AI_BASE_URL   # M4 用，可选
npx wrangler secret put AI_API_KEY    # M4 用
```

初始管理员口令由 `scripts/setup.mjs` 生成（或读 `INITIAL_ADMIN_PASSWORD` 环境变量），首登后强制修改。

## 当前里程碑进度

- ✅ M0 脚手架 + 鉴权骨架（本仓库初始提交）
- ⏳ M1 数据模型与核心 CRUD（含软删 + 回收站）
- ⏳ M2 双视图 + 筛选 + 响应式 + 登录门禁
- ⏳ M3 豆瓣抓取 + 封面
- ⏳ M4 AI 查询
- ⏳ M5 导出 + 导入 + 暗色 + 打磨

详见 `DOCS/产品需求总指导文件.md` 与 `META/WORKLIST/20260817-书架开发计划-v1.md`。
