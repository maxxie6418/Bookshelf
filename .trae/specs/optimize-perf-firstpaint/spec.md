# Bookshelf 性能优化（首屏与请求链路）Spec

## Why

当前应用部署在 Cloudflare Worker（Workers Assets + Hono + D1 + KV + R2）。经研判，最主要的性能瓶颈不在 Worker 冷启动，而在前端首屏资源与请求链路上：列表接口返回详情大字段、每次刷新（含搜索/翻页）都同时请求 stats、移动端搜索无 debounce 且无竞态保护、封面图未异步解码、字体字重冗余。本 spec 落地「已确认采纳」的低风险、直接收益项，并同步版本号 +0.1。

## What Changes

- **列表接口瘦身**：列表 `SELECT` 改为显式列清单，排除 `description`/`notes`/`reason` 等详情大字段；`getBook` 详情接口保持全量。

- **刷新拆分为 books / stats**：新增 `refreshBooks()`；搜索、翻页、筛选只刷新列表，不再重复请求 stats；新增/编辑/删除/恢复/导入等会改变统计的变更仍走完整 `refresh()`。

- **搜索防抖**：移动端搜索输入补 300ms debounce（与桌面端对齐）。

- **请求竞态保护**：`refresh()`/`refreshBooks()` 增加请求序号（或 AbortController），旧请求返回后丢弃，避免覆盖新结果。

- **封面图异步解码**：列表与行内编辑封面 `<img>` 增加 `decoding="async"`。

- **字体减负**：移除未实际使用的字重静态 import（保留实际使用的 Noto Serif SC 字重；确认 JetBrains Mono 实际使用情况后保留必要字重），对比 build 体积。

- **版本号 +0.1**：`package.json` `1.1.1 → 1.2.0`，同步 `package-lock.json`、顶栏显示文案、README。

**明确不在本期范围**（保持最小改动，规避风险）：

- 封面跳过 `requireAuth`（已确认匿名可读，无需改动）

- stats KV 短缓存、封面 Cache API（需真实流量/命中数据验证，暂缓）

- 设置/导入导出动态拆包（涉及 initTheme 常驻逻辑解耦，风险较高，暂缓）

- Observability 采样率调整（缺成本数据，暂缓）

- 数据库索引、图片缩略图、CF Images（均暂缓）

## Impact

- Affected specs：列表/详情 API 返回结构、侧栏统计刷新、搜索交互、封面图片渲染、字体加载、版本号。

- Affected code：

  - 后端：`src/lib/books.ts`（`BASE_SELECT`/`LIST_SELECT`）、`src/lib/books.ts` 导出 SQL

  - 前端状态/刷新：`src/web/refresh.ts`、`src/web/state.ts`

  - 前端调用点：`src/web/components/app-shell.ts`、`book-list.ts`、`detail-drawer.ts`、`trash-panel.ts`、`settings-panel.ts`、`book-form.ts`、`manage-taxonomy.ts`、`import-export.ts`

  - 封面图片：`src/web/components/book-list.ts`、`book-inline-edit.ts`

  - 字体与入口：`src/web/main.ts`

  - 版本：`package.json`、`package-lock.json`、`src/web/components/app-shell.ts`（顶栏文案）、`README.md`

## ADDED Requirements

### Requirement: 刷新职责拆分

系统 SHALL 区分「仅刷新列表」与「刷新列表+统计」两种刷新路径。

#### Scenario: 搜索/翻页/筛选不刷统计

- **WHEN** 用户输入搜索词、翻页或点击分类/标签筛选

- **THEN** 仅重新请求书籍列表，不调用 `/api/books/stats`

#### Scenario: 数据变更刷新统计

- **WHEN** 用户新增、编辑、软删、恢复、彻底删除书籍或执行导入

- **THEN** 列表与统计都刷新

### Requirement: 搜索防抖与竞态保护

系统 SHALL 对搜索输入做防抖，并确保并发请求不会用旧结果覆盖新结果。

#### Scenario: 连续输入搜索

- **WHEN** 用户在移动端快速连续输入

- **THEN** 仅最后一次输入在防抖窗口后触发一次请求

#### Scenario: 请求乱序返回

- **WHEN** 较早发出的列表请求晚于较新的请求返回

- **THEN** 旧请求结果被丢弃，界面显示最新一次请求的结果

### Requirement: 封面图异步解码

列表与行内编辑封面 `<img>` SHALL 设置 `decoding="async"`，与现有 `loading="lazy"` 并存，避免解码阻塞主线程。

### Requirement: 列表接口显式字段

`GET /api/books` 列表响应 SHALL 不包含 `description`、`notes`、`reason` 等详情大字段；`GET /api/books/:id` 详情响应 SHALL 保持完整字段。

#### Scenario: 前端列表不依赖被删字段

- **WHEN** 列表渲染读取书籍条目

- **THEN** 不读取 `description`/`notes`/`reason`；详情展示仍完整

### Requirement: 字体减负

`main.ts` SHALL 只静态引入程序实际使用的字体字重，去除冗余字重声明。

### Requirement: 版本号递增

系统版本号 SHALL 从 `1.1.1` 递增到 `1.2.0`，并同步锁文件、界面展示与发布说明。

## MODIFIED Requirements

### Requirement: 现有 `refresh()` 全量刷新

保留 `refresh()`（列表 + 统计）用于数据变更与首次进入；搜索/翻页/筛选改走 `refreshBooks()`。

## REMOVED Requirements

无删除需求。
