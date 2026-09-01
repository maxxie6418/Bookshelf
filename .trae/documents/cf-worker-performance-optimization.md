# Bookshelf Cloudflare Worker 性能优化与存储清理计划

- **文档版本**：v1.0
- **文档状态**：评审中
- **目的和适用范围**：性能优化专项，覆盖首次加载、书籍录入、豆瓣抓取更新、编辑保存四类场景，并新增「缓存记录 + 删除联动清理 + 设置页手动检查清理」存储治理能力。适用于前端 SPA、Worker API、D1/KV/R2 数据层。
- **权威级别**：临时规则
- **最后更新日期**：2026-09-01

## 修改记录

| 文档版本号 | 应用版本号 | 日期 | 修改摘要 | 修改模型ID |
|-----------|-----------|------|---------|-----------|
| v1.0 | 1.1.0 | 2026-09-01 | 初版：性能优化四项 + 存储记录与清理 | trae-agent |

---

## 一、摘要

当前项目为 Hono + D1 + R2 + KV + Workers Assets，主要性能问题集中在四个层面：

1. **首次加载**：外链字体阻塞渲染（其中 LXGW 温楷为死引用）；每次 `refresh()` 拉全量 1000 本书只为侧栏计数；每个 `/api/*` 请求冷启动都跑约 6 次 D1 引导查询。
2. **录入 / 抓取更新**：豆瓣抓取零缓存（`kv` 参数收了但从未用），同一本书反复抓取重复请求豆瓣；封面每次下载并覆盖 R2，未复用已有对象。
3. **编辑 / 任意变更后**：保存后固定 `refresh() + refreshSidebar()` = 4 个请求（列表 + 全量 1000 + 分类计数 + 标签计数）。
4. **资源治理（新增需求）**：缓存与封面无记录、书籍彻底删除后不联动清理、设置页没有检查手段。

优化后预期：首次加载阻塞资源大幅减少；抓取二次命中走 KV 缓存秒回；变更后请求从 4 个降到 2 个；删除/清空回收站自动清除孤立的 KV 缓存与 R2 封面；设置页可一键检查并手动清理残留。

## 二、现状分析（已核实）

| 位置 | 问题 | 依据 |
|---|---|---|
| `src/web/index.html` L7-11 | Google Fonts + jsdelivr LXGW 温楷两个外链 CSS 阻塞渲染；LXGW 全项目无任何 `font-family` 引用，纯死引用；国内网络下 Google Fonts 常超时 | Grep 仅命中 index.html 一处 wenkai 引用 |
| `src/web/refresh.ts` L12-34 | `refresh()` 并发拉主列表(60) + 全量列表(limit 1000，含 12 批次标签查询)，仅用于侧栏计数 | listBooks 的 tagsForBooks 按 90 一批 |
| `src/lib/bootstrap.ts` L167-187 + `src/index.ts` L26-29 | 每个 `/api/*` 请求执行 `ensureAdmin`，冷启动串行执行 schema 检查 + 4 个 PRAGMA 迁移检查 + users 计数 ≈ 6 次 D1 查询；模块级布尔只对本 isolate 生效 | — |
| `src/lib/book-metadata.ts` L145-174 | `fetchDoubanMetadataByUrl/Isbn`、`fetchDoubanPage` 收了 `kv` 参数但从不读写缓存；`fetchWithRetry` 的 `opts.kv` 也是死参数 | KV 调用 grep 证实 metadata 路由仅透传未使用 |
| `src/lib/covers.ts` L16-32 | `storeCover` 每次无条件下载并覆盖 R2，无 `bucket.head()` 复用 | — |
| `src/web/components/book-list.ts` L105-127 等 | 保存/改状态/收藏后 `Promise.all([refresh, refreshSidebar])` 四次请求；`patchBookLocal` 未覆盖主路径 | refreshSidebar 共 8 处调用点 |
| `src/api/covers.ts` L11-15 | 封面每次请求都回源 R2；响应有 `Cache-Control` 但 Workers 路由默认不被 CDN 缓存 | — |
| `src/lib/books.ts` L316-345 | `permanentDelete`/`clearTrash` 只删 DB 行，不清理 KV 缓存与 R2 封面 | — |

## 三、目标与验收标准

1. 首次加载不再有第三方阻塞字体请求；字体文件同域由 Workers Assets 托管并 `font-display: swap`。
2. 任意 `/api/*` 请求冷启动引导开销降为 1 次 KV 读（命中后跳过全部引导）。
3. 侧栏统计（总数/在读/分类/标签）来自新聚合接口，前端不再拉全量 1000 本书。
4. 同一豆瓣书目/ISBN 二次抓取命中 KV 缓存（默认 24h TTL，`force` 可绕过）；封面重复抓取不重复下载（R2 head 复用）。
5. 编辑/评分/状态/收藏/删除等变更后，前端请求从 4 个降为 ≤2 个。
6. 彻底删除/清空回收站自动清理对应 KV 缓存与无引用的 R2 封面；设置页提供「存储检查」与「手动清理」。
7. `npm run typecheck`、`npm run build` 通过；本地 `wrangler dev` 全链路验证通过。

## 四、分项方案（文件级）

### 4.0 前置：基线提交
- 修改前先执行 `git add -A && git commit`（中文 Conventional Commits，如 `chore: 性能优化前基线提交`），完成后按交付要求再提交一次。

### 4.1 首次加载 —— 字体自托管 + 引导快路径 + stats 聚合

**4.1.1 字体（`package.json`、`src/web/index.html`、`src/web/main.ts`）**
- 新增依赖：`@fontsource/noto-serif-sc`、`@fontsource/jetbrains-mono`（均为 woff2 + css 的字体资源包，Vite 构建期打包进 `dist/assets`，同域加载、带 hash、由 Workers Assets 长期缓存）。
- `index.html`：删除 Google Fonts 两个 `<link rel="stylesheet">` 与 jsdelivr LXGW 温楷链接（LXGW 全项目无引用，直接删除既有收益）。
- `main.ts`：导入子集化 css（fontsource 默认 `font-display: swap`）：
  - `@fontsource/noto-serif-sc/400.css`、`/600.css`、`/700.css`
  - `@fontsource/jetbrains-mono/400.css`、`/500.css`、`/600.css`
- `style.css` 的 `font-family` 声明无需改动（族名一致）。保持 `Georgia`/`monospace` 回退。

**4.1.2 引导快路径（`src/lib/bootstrap.ts`）**
- 新增常量 `BOOTSTRAP_READY_KEY = 'bootstrap:ready'`。
- `ensureAdmin` 开头先 `const ready = await env.KV.get(BOOTSTRAP_READY_KEY); if (ready) return;`；全部引导 + seed 完成后 `await env.KV.put(BOOTSTRAP_READY_KEY, '1')`。
- 兼容：存量部署首次请求跑一次完整引导（幂等，与现状一致）后写标志；模块级布尔保留作为 isolate 内短路。并发首请求安全（各步幂等）。

**4.1.3 stats 聚合接口（新建 `src/lib/stats.ts`；改 `src/api/books.ts`、`src/web/refresh.ts`、`state.ts`、`api.ts`、`types.ts`、`components/app-shell.ts`）**
- 新建 `src/lib/stats.ts`：`getStats(db)` 用一次 `db.batch([…])` 聚合返回 `{ total, favorites, trash, byStatus{unread/reading/finished/shelved}, categories:[{id,name,color,count}], tags:[{id,name,count}] }`。分类/标签计数 SQL 与 `categories.ts`/`tags.ts` 提取为共享常量，避免重复。
- `src/api/books.ts`：新增 `GET /stats` 路由（必须注册在 `/:id` 之前），返回 `{ data: stats }`。
- `src/web/types.ts`：新增 `Stats` 类型。
- `src/web/api.ts`：新增 `fetchStats: () => request<Stats>('/books/stats')`。
- `src/web/state.ts`：新增 `stats: null as Stats | null`；**删除 `allBooks` 字段**。
- `src/web/refresh.ts`：`refresh()` 改为 `Promise.all([listBooks(主列表), fetchStats()])`，`stats` 入 state；删除 `ALL_LIMIT` 与 `refreshSidebar()` 函数。
- `src/web/components/app-shell.ts`：侧栏总数/在读改用 `state.stats`；删除 `refreshSidebar` 导入与调用、`allBooks` 引用。
- 清理其余 7 处 `refreshSidebar` 调用点（book-form、book-list、detail-drawer、manage-taxonomy）：`Promise.all([refresh(), refreshSidebar()])` 一律简化为 `await refresh()`；`manage-taxonomy` 增删分类/标签后同样以 `refresh()` 刷新 stats。

### 4.2 录入 / 抓取更新 —— KV 元数据缓存 + 封面复用

**4.2.1 元数据缓存（`src/lib/book-metadata.ts`、`src/api/metadata.ts`、`src/api/agent.ts`、`src/lib/fetch-utils.ts`）**
- `book-metadata.ts` 新增缓存读写：
  - 键：`meta:douban:subject:{id}`（含书影）、`meta:douban:isbn:{isbn}`；值：`{ v:1, cached_at:ISO, meta:BookMetadata }`；TTL `86400`。
  - `fetchDoubanMetadataByUrl(url, kv, opts?)` / `fetchDoubanMetadataByIsbn(isbn, kv, opts?)` 增加 `opts?.force`：默认读缓存命中即返，未命中/force 才抓取，成功后回写缓存（subject 键与 isbn 键同时写）。
- `src/api/metadata.ts`：fetchSchema 增加 `force?: boolean`，透传给抓取函数。
- `src/api/agent.ts`：同增加 `force?: boolean` 透传。
- `src/lib/fetch-utils.ts`：删除 `opts.kv` 死参数（`fetchWithRetry` 与代码内引用），同步更新调用方（book-metadata 传 `{ referer }`）。

**4.2.2 封面复用（`src/lib/covers.ts`）**
- `storeCover` 计算好 `key` 后先 `await bucket.head(key)`，命中（size>0）直接返回 `/api/covers/{key}`，不下载不覆盖。仍保留 `customMetadata.src` 记录来源。

### 4.3 变动后请求降量
- 已在 4.1.3 覆盖：全部 `refreshSidebar` 调用删除，stats 并入 `refresh()`，使编辑/评分/收藏/删除后的请求从 4 降到 2（PATCH + list + stats 中的 list 与 stats 并发）。
- `book-list.ts` 的 `patchBookLocal` 删除 `allBooks` 分支；`quickStatus`/`quickFavorite`/`refreshMeta`/行内编辑保存改为 `await refresh(false, false)`（刷新主列表 + stats，不闪骨架屏）。

### 4.4 存储记录与清理（新增需求）

**4.4.1 数据记录约定**
- KV 缓存条目本身即记录：键含类型与标识，值含 `cached_at` 与 `meta.title`，供设置页展示。
- R2 封面对象 `customMetadata.src` 记录来源 URL，key 为确定性派生（`coverKey`），与 DB `cover_url`（`/api/covers/{key}`）一一对应可反查。

**4.4.2 删除联动清理（新建 `src/lib/storage.ts`；改 `src/lib/books.ts`、`src/api/books.ts`）**
- 新建 `src/lib/storage.ts`：
  - `purgeDeletedResources(env, books[])`：对每本书收集候选键（douban_url→subject 键、isbn 键、cover_url→`/api/covers/` 后段 key），用一次 `db.batch` 查询「是否仍被其他书引用」（subject 用 `LIKE '%subject/{id}%'`，isbn 精确、cover 精确匹配 `cover_url`）；引用数为 0 才 `KV.delete` / `R2.delete`。
  - 共享引用保护：多书共用同一豆瓣书影/封面时，删一册不误删其余书的资源。
- `src/lib/books.ts`：
  - `permanentDelete(db, id, cleanup?)`：先 SELECT 该行 `douban_url/isbn/cover_url`，删除 book_tags 与 books 后再调 `purgeDeletedResources`。
  - `clearTrash(db, cleanup?)`：先 SELECT 全部 `deleted_at IS NOT NULL` 行，删除后再统一调 `purgeDeletedResources`。
  - 可选参数 `cleanup?: { kv: KVNamespace; bucket: R2Bucket }`；`api/books.ts` 调用处传 `{ kv: c.env.KV, bucket: c.env.COVERS }`。
- 说明：软删（移入回收站）不清理，恢复后资源仍在；只在彻底删除/清空回收站时清理。

**4.4.3 设置页手动检查与清理（新建 `src/api/storage.ts`；改 `src/index.ts`、`src/web/components/settings-panel.ts`、`src/web/api.ts`、`src/web/types.ts`）**
- 新建 `src/api/storage.ts`（requireAuth）：
  - `GET /api/storage/check`：`KV.list({prefix:'meta:douban:'})` 遍历解码 + `COVERS.list()` 分页遍历；预取 DB 引用集（所有书的 douban_url/isbn/cover_url）判定孤儿，返回 `{ data: { kv:{total,orphans:[{key,cached_at,title}]}, covers:{total,orphans:[{key,size,uploaded}]} } }`。
  - `POST /api/storage/cleanup`：body `{ kv:boolean, covers:boolean }`，删除对应孤儿，返回 `{ data: { deletedKv, deletedCovers } }`。
- `src/index.ts`：注册 `app.route('/api/storage', storageRoutes)`。
- `settings-panel.ts` `openSettings`：数据管理区新增「存储检查与清理」卡片/按钮 → 打开模态，展示 KV 缓存与封面孤儿清单与数量，「一键清理」前二次确认。
- `src/web/api.ts`：新增 `checkStorage()`、`cleanupStorage({kv,covers})`；`types.ts` 新增对应类型。

### 4.5 文档与日志
- `DOCS/API接口手册.md`：
  - 新增「3.9 GET /api/books/stats」。
  - 新增「6. 存储与缓存检查」节（/api/storage/check、/api/storage/cleanup）。
  - 更新 3.x metadata/fetch 与 agent fetch 的 `force` 参数说明。
  - 文档版本升 v1.5，增补修改记录行。
- 新建 `META/LOG/2026-09-01-性能优化与存储清理.md`：按仓库模板记录修改范围、涉及文件、验证情况与剩余风险。

## 五、假设与决策

| 决策点 | 结论 |
|---|---|
| 字体方案 | 自托管 + swap（用户已确认）；LXGW 为死引用直接删除 |
| 侧栏统计 | 新增 `/api/books/stats` 聚合（用户已确认），删除前端全量拉取与 `refreshSidebar` |
| 抓取缓存 | KV 缓存解析后元数据 24h TTL + `force` 绕过（用户已确认），封面 R2 head 复用 |
| 缓存记录与清理 | KV 条目含 cached_at/title 记录；彻底删除联动清理；设置页手动检查清理（用户追加需求） |
| 新依赖 | 仅 2 个前端字体包（`@fontsource/noto-serif-sc`、`@fontsource/jetbrains-mono`），属性为构建期资源、不触及运行时服务端 |
| 封面 CDN 缓存 | 本次不改（需 Cache 规则/自定义域，属平台配置），仅浏览器端已有 1 天缓存，作为后续可选项记录 |
| API 表面变更 | 新增 stats、storage/check、cleanup 三端点 + metadata fetch 的 force 参数；同步更新 API 手册 |

## 六、实施与验证步骤

1. `git add -A && git commit`（基线）。
2. 按 4.1.1 装字体包、改 index.html/main.ts；按 4.1.2 改 bootstrap。
3. 按 4.1.3 新建 stats.ts、改 books.ts 路由 + 前端 7 个文件删除 refreshSidebar/allBooks。
4. 按 4.2 加 KV 缓存与封面 head 复用；按 4.3 调整 book-list 变更后刷新。
5. 按 4.4 新建 storage.ts + /api/storage + 删除联动 + 设置页检查清理 UI。
6. 按 4.5 更新 API 手册、写 META/LOG。
7. 验证：
   - `npm run typecheck`（tsconfig.json + tsconfig.web.json）
   - `npm run build`（确认 dist/assets 含字体 woff2，index.html 无外链字体）
   - `npm run dev` 本地全链路：
     - 首请求后 KV 出现 `bootstrap:ready`，后续请求日志不再出现引导查询
     - `/api/books/stats` 返回数据与侧栏一致，网络请求数由 4 降为 2
     - 豆瓣 URL 抓取 → 元数据入库；二次抓取（无 force）走 KV 命中；`force=1` 重新拉取
     - 同一封面二次抓取不再产生新 R2 对象（head 复用）
     - 彻底删除含豆瓣链接/封面的书 → KV 对应键删除、R2 对象删除；共享书影/封面的另一本书不受影响
     - 设置 → 存储检查：孤儿列表正确；清理后计数归零
   - 部署：本地验证通过后由用户确认执行 `npm run deploy`。
8. 全部完成后再次 `git add -A && git commit`，并返回提交记录。

## 七、剩余风险与说明

- 豆瓣可达性依赖 Cloudflare 出口网络，偶发 403 仍可能；缓存可显著减少重复请求与失败概率，但无法根治。
- 字体子集化后首次渲染依赖 woff2 下载完成（swap 保证文本先以回退字体显示），观感上仅是字体加载完成的时序变化。
- `stats`、`storage/check`、`storage/cleanup` 为新增 API 表面，仅所有者会话可用；KV/R2 清理操作均需用户在前端二次确认。
- 缺少真实豆瓣成功路径的线上完整验证（本地网络受限时），部署后请用户实测一次抓取。