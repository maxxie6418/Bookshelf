# Bookshelf 性能优化 — 技术方案与开发计划（交接文档）

> 目标仓库：https://github.com/maxxie6418/Bookshelf（约 commit `aca65f1`，标签/版本 **v1.1.1**）  
> 线上：https://book.861306.xyz  
> 约束：**只改动 Bookshelf 自身 Cloudflare 资源**；禁止引入第三方个人姓名/域名；禁止写入或提交任何 secrets。  
> 本文档供另一 AI / 开发者直接按章实施，内容为完整技术方案，非提纲。

---

## 0. 一句话目标

在不改动鉴权模型、不公开 R2、不引入 Cloudflare Images、不做整体重写的前提下，优先压缩首屏 JS/字体体积与封面图延迟，其次降低列表查询与统计接口开销，使书架首屏可交互时间与封面加载体感明显改善。

---

## 1. 背景与现状架构

### 1.1 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | Vite + TypeScript + 自托管 Fontsource | SPA，构建产物走 Worker 静态资源或 Pages/Assets |
| Worker API | Cloudflare Workers（wrangler） | `src/index.ts` 路由入口，鉴权与业务 API |
| 数据 | Cloudflare D1 | 书籍主表；列表当前 `SELECT b.*` |
| 对象存储 | Cloudflare R2 | 封面原图；经 `/api/covers/:key` 代理输出 |
| 缓存 | Cloudflare KV | 豆瓣元数据、bootstrap 配置等 |
| 可观测 | Workers Observability | `wrangler` 中采样率当前偏高（约 100%） |
| 部署 | Wrangler / CF 账户内 Bookshelf 绑定资源 | 禁止动其他仓库或其他账户资源 |

### 1.2 热路径文件与现状行为

| 文件 / 位置 | 关键路径行为 | 性能相关现状 |
|-------------|--------------|--------------|
| `src/index.ts` → `ensureAdmin` | 多数 `/api/*` 请求进入鉴权/管理员校验中间件 | **封面接口也走 ensureAdmin**，增加 Cookie/Session 校验与往返成本 |
| `bootstrap.ts` | 启动配置下发 | 已有 KV 缓存（v1.1.1），仍属首屏依赖链一环 |
| `books.ts` | 列表/详情查询 | 列表 `SELECT b.*`，含 `description` / `notes` / `reason` 等大字段 |
| `stats.ts` | 书架统计 | **每次刷新几乎都打**，无短 TTL 聚合缓存 |
| `covers.ts` | `/api/covers/...` | `Cache-Control: 86400`；无 Workers Cache API 命中层；仍先 ensureAdmin |
| `main.ts`（前端） | 入口 | **约 6 个 `@fontsource` 静态 import**（含多字重 CJK），显著增大主包 |
| `refresh.ts` | 列表刷新 | `PAGE_SIZE = 60`；与 stats 可并发（v1.1.1 已做） |
| `book-list.ts` | 列表渲染 | loading 态 + 图片 lazy（v1.1.1）；缺 `decoding="async"` 等 |
| `vite.config.*` | 构建 | 配置偏 minimal，未做路由级拆包/字体策略优化 |
| `wrangler.toml`（observability） | 遥测 | **sample 约 1（100%）**，生产开销偏高 |

### 1.3 v1.1.1 已完成（勿重复造轮、可在其上叠加）

- 列表分页（`PAGE_SIZE 60`）
- 列表与 stats **并发请求**
- 封面 `<img loading="lazy">`
- R2 `head` 复用（减少无效 GET）
- 豆瓣相关 KV 缓存
- bootstrap KV 缓存
- 自托管字体（Fontsource）——**仍偏重**，是 P0-A 重点

---

## 2. 问题诊断

| ID | 症状 / 观测 | 根因 | 影响 | 优先级映射 |
|----|-------------|------|------|------------|
| D1 | 首屏 JS / CSS 体积大，弱网白屏久 | CJK `@fontsource` 多文件多字重静态打进主包 | FCP / TTI | **P0-A** |
| D2 | 封面首张也慢，鉴权日志噪声 | `/api/covers` 命中 `ensureAdmin` | TTFB、Worker CPU | **P0-B** |
| D3 | 重复拉同一封面仍偏慢 | 仅 `Cache-Control`，Worker 侧未用 Cache API `match`/`put` + `waitUntil` | 边缘命中率 | **P0-B** |
| D4 | 列表 JSON 过大 | `SELECT b.*` 含长文本字段 | 带宽、解析、主线程 | **P0-C** |
| D5 | 频繁刷新时 stats 打满 | 每次 refresh 都查 stats，无短 TTL KV | D1/Worker 负载 | **P1-D** |
| D6 | 列表滚动卡顿感 | 图片缺 `decoding="async"` 等 | 解码阻塞 | **P1-E** |
| D7 | 设置/导入导出拖累主包 | 路由未 dynamic import | 首包体积 | **P1-F** |
| D8 | 观测成本高 | observability sample ≈ 1 | 账单与开销 | **P1-G** |

---

## 3. 范围与非目标

### 3.1 范围内（按优先级）

| 代号 | 主题 | 必须交付 |
|------|------|----------|
| **P0-A** | 字体减负 | 仅保留一套 Noto Serif SC 必要字重；JetBrains Mono 动态导入；展示字体异步 + `font-display: swap`；记录 vite build 体积对比 |
| **P0-B** | 封面热路径 | **跳过** `/api/covers` 的 `ensureAdmin`；Cache API `match`/`put` + `ctx.waitUntil`；校验 key 字符集；404 不长缓存；缩略图仅二期可选 |
| **P0-C** | 列表字段瘦身 | `LIST_SELECT` 去掉 `description`/`notes`/`reason`；详情 `getBook` 仍全量；前端列表类型 vs 详情再拉 |
| **P1-D** | stats KV | TTL 15–30s；写路径失效 |
| **P1-E** | 图片解码 | `decoding="async"` |
| **P1-F** | 路由拆包 | settings / import-export dynamic import |
| **P1-G** | 采样 | observability sampling → `0.1` |

### 3.2 明确非目标

- **不改变**登录 / Session / Cookie / `requireAuth` 整体模型（封面只是跳过 ensureAdmin，不是改成公开写）
- **不**把 R2 桶改成公共读（除非产品另行明确要求）
- **不**引入 Cloudflare Images / Image Resizing 作为本期依赖
- **不**整体重写前端框架或 API 分层
- **不**修改其他仓库、其他 CF 账户资源、第三方个人站域名
- **不**提交 `.env`、Token、密钥明文

### 3.3 兼容性约束（实现必须遵守）

1. **列表**响应可删减字段；**详情**接口保持完整字段（含 description/notes/reason）。
2. 封面 URL 形态保持：`/api/covers/<key>`（或现有等价 path），前端不必改域名。
3. **封面路由不得加 `requireAuth`**（与「跳过 ensureAdmin」一致：匿名可读已授权存储的封面 key，靠 key 不可猜测性；禁止误加登录墙导致未登录书架裂图）。
4. 列表字段变更后，前端 `BookListItem` 类型与模板不得依赖已删除字段；详情页继续走全量 `getBook`。

---

## 4. 分项技术方案

### 4.1 P0-A 字体（首屏体积）

**目标：** 主包字体相关体积显著下降，正文可读，等宽字体按需加载。

**做法：**

1. **Noto Serif SC**：只保留实际 UI 使用的 **一个字重**（通常 400 或项目现用正文重）。删除其余 `@fontsource/noto-serif-sc` 的多字重静态 import。
2. **JetBrains Mono**：从 `main.ts` 静态 import 改为 **dynamic `import()`**，仅在代码块 / 设置中等宽场景首次需要时加载。
3. **展示用字体**（若有 display / 标题专用）：改为异步加载 CSS 或动态 import，配合：
   - `@font-face` / Fontsource 的 **`font-display: swap`**
   - 避免阻塞首屏 text rendering 过久
4. **测量**：优化前后各跑一次 `vite build`，记录：
   - `dist` 总大小
   - 最大 JS chunk
   - 字体相关 CSS/WOFF2 文件数量与合计字节  
   写入 PR 描述。

**验收：** 首包不再内联多套 CJK 字重；弱网下文字先以系统回退字体显示，再 swap。

### 4.2 P0-B 封面：跳过 ensureAdmin + Cache API

**目标：** 封面 GET 成为「校验 key → Cache → R2」的快路径，且可边缘复用。

**中间件跳过（示意，可粘贴改写）：**

```ts
// 在 ensureAdmin / 全局鉴权中间件最前：封面只读热路径跳过管理员校验
// 注意：不要对 /api/covers 使用 requireAuth；也不要删除其他路由的 ensureAdmin
const url = new URL(request.url);
if (request.method === "GET" && url.pathname.startsWith("/api/covers/")) {
  return next(); // 或直接交给 covers handler，跳过 ensureAdmin
}
```

**Cache API 流程（Worker 内）：**

1. 规范化请求（只缓存成功的 GET；注意 Vary / 原始 URL）。
2. `const cache = caches.default;` → `cache.match(request)`；命中则直接返回。
3. 未命中：校验 **key 字符集**（建议：仅允许 `[A-Za-z0-9._/-]` 或项目既有安全子集；拒绝 `..`、反斜杠、控制字符）。
4. 从 R2 取对象；200 则构造 `Response`，设置合理 `Cache-Control`（可与现有 86400 对齐或略保守），`cache.put(request, response.clone())` 用 **`ctx.waitUntil`**，避免拖慢首字节。
5. **404 / 4xx**：可短缓存或不缓存（例如 `max-age=60` 或 no-store），**禁止**把 404 按 86400 长缓存。
6. 错误响应勿把敏感内部信息回给客户端。

**二期可选：** R2 侧或构建侧生成 thumbnail，列表用小图；**本期不做**除非排期有余。

**验收：** 未登录可加载封面；二次请求命中 Cache；非法 key 4xx；404 不长期占缓存。

### 4.3 P0-C 列表 SELECT 瘦身

**后端：**

- 定义 `LIST_SELECT`（或等价常量）：显式列清单，**排除** `description`、`notes`、`reason`（及其他仅详情需要的大字段）。
- `getBook` / 详情查询保持 `SELECT *` 或完整列清单。
- 分页、排序、筛选逻辑不变。

**前端：**

- `BookListItem` 类型只含列表字段。
- 列表渲染禁止读 description 等；进入详情再 `fetch` 全量。
- 若某处列表曾展示摘要，改为详情页或二次请求（默认：去掉列表摘要，保持简单）。

**验收：** 网络面板中 list JSON 体积明显下降；详情页内容完整。

### 4.4 P1-D stats KV 短缓存

- KV key 如 `stats:v1`（或带书架维度）。
- **TTL 15–30 秒**（建议 20s，可配置常量）。
- 读：先 KV，miss 再 D1，再异步写回。
- **写路径失效**：新增/编辑/删除/导入等变更书籍的 mutation 成功后 `delete` 该 KV key（或 bump version）。
- 注意：只动 Bookshelf 绑定的 KV namespace。

### 4.5 P1-E `decoding="async"`

- 在 `book-list`（及任何封面 `<img>`）增加 `decoding="async"`，与现有 `loading="lazy"` 并存。
- 勿破坏现有占位 / onerror 逻辑。

### 4.6 P1-F 设置与导入导出拆包

- `settings`、`import-export`（及同类重页面）改为路由级 `import()` / `React.lazy` / 项目等价动态导入。
- 保证 loading 态与错误边界不空白死页。
- 主入口不再静态 import 这些模块的整树。

### 4.7 P1-G Observability 采样

- `wrangler` observability **sampling 从 1 → 0.1**（10%）。
- 仅改 Bookshelf 本仓库配置；PR 说明对调试的影响（排障时可临时调高）。

---

## 5. 顺序与工作量

建议严格顺序（有依赖）：

| 顺序 | 项 | 预估 | 依赖 |
|------|-----|------|------|
| 1 | P0-A 字体 | 0.5–1.0 人日 | 无 |
| 2 | P0-B 封面中间件 + Cache | 0.75–1.25 人日 | 无（可与 A 并行） |
| 3 | P0-C LIST_SELECT + 前端类型 | 0.5–0.75 人日 | 需回归列表/详情 |
| 4 | P1-D stats KV | 0.25–0.5 人日 | 写路径清单 |
| 5 | P1-E decoding | 0.1 人日 | 无 |
| 6 | P1-F dynamic import | 0.25–0.5 人日 | 路由结构 |
| 7 | P1-G sampling 0.1 | 0.1 人日 | 无 |
| **合计** | | **约 2.5–4.5 人日** | 含自测与 PR |

并行建议：A∥B → C → D/E/F/G。

---

## 6. 测试验收 Checklist

**功能**

- [ ] 未登录 / 已登录均可加载已有封面（未误加 requireAuth）
- [ ] 非法 cover key → 4xx，无路径穿越
- [ ] 列表翻页、排序、筛选正常
- [ ] 详情页 description / notes / reason 仍完整
- [ ] 新增/编辑/删除后 stats 最终一致（TTL 内可短暂旧值）
- [ ] 设置页、导入导出可打开且功能可用
- [ ] 字体：正文可读；等宽在需要处出现

**性能**

- [ ] `vite build` 体积对比写入 PR（字体相关明显下降）
- [ ] 同一封面二次请求可观察到更快响应 / 缓存命中行为
- [ ] list 响应体小于改前（抽一样本对比）
- [ ] refresh 时 stats 在 TTL 内不重复打 D1（可用日志或临时计数验证）

**安全 / 约束**

- [ ] 无 secrets 进仓库
- [ ] 未改其他 CF 账户资源 / 其他 repo
- [ ] 未公开 R2 bucket
- [ ] 其他 API 仍走 ensureAdmin（仅 covers GET 跳过）

**回归**

- [ ] bootstrap 仍可用
- [ ] 豆瓣 KV 行为未破坏
- [ ] observability 采样为 0.1 且部署成功

---

## 7. PR 要求

- **分支名：** `perf/first-paint-and-covers`
- **基线：** 基于当前主线接近 `aca65f1` / v1.1.1
- **PR 描述必须包含：**
  - 变更对照表（P0/P1 各项勾选）
  - build 体积前后数字
  - 兼容性说明（列表字段、封面 URL、未加 requireAuth）
  - 测试 checklist 执行结果
  - 明确「未包含」：CF Images、公开 R2、缩略图（若未做）
- **不要** force push 到 main；实现侧按团队流程开 PR（本交接文件生成过程未使用 git）
- Commit 信息建议前缀：`perf:`

---

## 8. 二期可选（本期不做除非有余力）

- 封面 thumbnail / 多尺寸；列表用小图
- Cloudflare Cache Reserve 或自定义 cache key 版本戳
- 列表虚拟滚动（书很多时）
- 字体子集化（中文 subset）进一步压 WOFF2
- Image Resizing / CF Images（需单独评审成本与隐私）
- Service Worker 级离线缓存（慎用，易与 Cache API 策略冲突）
- D1 读写分离或物化 stats 表

---

## 9. 不要踩坑

1. **禁止**给 `/api/covers` 加 `requireAuth` —— 会导致未登录裂图、与现网行为不兼容。
2. **禁止**删光全局 `ensureAdmin` —— 只对封面 GET 短路跳过；管理 API 必须保留。
3. **禁止**把 404 封面按一天缓存。
4. **禁止**列表去掉字段后前端仍读 `book.description` 等导致 runtime 异常。
5. **禁止**详情也改成瘦字段 —— 详情必须全量。
6. **禁止**为图省事把 R2 设为 public。
7. **禁止**提交 Token、Cookie、`.dev.vars` 秘密值。
8. **禁止**改动非 Bookshelf 的 CF 资源或其他个人域名配置。
9. **禁止**把 JetBrains Mono 删干净却在代码块硬依赖 —— 应动态加载而非 404。
10. **禁止** Cache API `put` 不 `clone()` 或阻塞在 await put 上拖慢 TTFB（用 `waitUntil`）。
11. **禁止** key 校验过松导致 `../` 或异协议路径。
12. **禁止** stats TTL 设成数十分钟还不在写路径失效 —— 用户会觉得计数「坏了」。

---

## 10. Definition of Done（DoD）

- P0-A/B/C 全部合并就绪；P1-D/E/F/G 尽量同 PR 或紧随其后的小 PR。
- 本地/预览环境通过第 6 节 checklist。
- PR 开在 `perf/first-paint-and-covers`，描述完整。
- 线上（https://book.861306.xyz）部署后：首屏字体更轻、封面更快、列表更瘦；无鉴权回归。
- 无 secrets、无范围外资源变更。
- 本文档约束均被遵守。

---

## 11. 代码锚点（实现时优先打开）

| 锚点 | 用途 |
|------|------|
| `src/index.ts` | 路由注册、`ensureAdmin` 挂载点 → **插入 covers 跳过** |
| `covers.ts`（或等价 covers 路由模块） | Cache-Control、R2 get、**Cache API**、key 校验 |
| `books.ts` | `LIST_SELECT` vs `getBook` 全量 |
| `stats.ts` | KV TTL + 读穿透 + 写失效钩子 |
| 前端 `main.ts` | 削减 fontsource 静态 import |
| 前端 `refresh.ts` | `PAGE_SIZE 60`；与 stats 并发保持 |
| 前端 `book-list.ts` | lazy + **`decoding="async"`**；列表字段 |
| 前端 settings / import-export 路由模块 | **dynamic import** |
| `vite.config.*` | 确认无反向把动态 import 又打回主包的错误配置 |
| `wrangler.toml` | observability **sample 0.1** |
| `bootstrap.ts` | 勿破坏既有 KV |

线上对照：https://book.861306.xyz  
仓库：https://github.com/maxxie6418/Bookshelf

---

## 12. 可粘贴给实现 AI 的任务提示

```text
[EN] Implement Bookshelf performance work on branch perf/first-paint-and-covers
from github.com/maxxie6418/Bookshelf (~aca65f1 / v1.1.1). Live: https://book.861306.xyz
Only touch Bookshelf Cloudflare resources. No secrets, no third-party personal names/domains,
no public R2, no CF Images, no auth model rewrite.

P0-A: Keep one Noto Serif SC weight; dynamic-import JetBrains Mono; async display font;
font-display:swap; report vite build sizes before/after.
P0-B: Skip ensureAdmin for GET /api/covers/* only (do NOT add requireAuth; do NOT remove
ensureAdmin elsewhere). Use Cache API match/put with ctx.waitUntil; validate key charset;
do not long-cache 404s.
P0-C: LIST_SELECT without description/notes/reason; getBook full fields; frontend
BookListItem vs detail fetch.
P1-D: stats KV TTL 15–30s + invalidate on writes.
P1-E: img decoding=async.
P1-F: dynamic import settings & import-export.
P1-G: wrangler observability sampling 0.1.

Follow the Chinese handoff doc: Bookshelf-性能优化-技术方案与开发计划.md
Open a PR with checklist + size numbers.

[中文] 在分支 perf/first-paint-and-covers 按交接文档实施 Bookshelf 性能优化（约 aca65f1 / v1.1.1）。
只动本项目 CF 资源；禁止 secrets、禁止公开 R2、禁止给封面加 requireAuth、禁止删除其他路由的 ensureAdmin。
优先 P0-A 字体、P0-B 封面跳过 ensureAdmin + Cache API、P0-C 列表字段瘦身；再做 P1 D–G。
PR 需含构建体积对比与测试清单。详情见同目录完整中文技术方案。
```

---

*文档结束。实现时以第 3、4、9、10 节为硬约束，以第 11、12 节为入口。*
