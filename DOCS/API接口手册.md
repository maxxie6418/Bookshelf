# API 接口手册

- **文档版本**：v1.6
- **文档状态**：草案
- **目的和适用范围**：书单管理工具（Bookshelf）全部 HTTP 接口的路径、鉴权、请求参数、响应结构与错误约定。适用于前端联调、后端实现与测试评审。
- **权威级别**：模块规则
- **最后更新日期**：2026-09-19

## 修改记录

| 文档版本号 | 应用版本号 | 日期 | 修改摘要 | 修改模型ID |
|-----------|-----------|------|---------|-----------|
| v1.0 | - | 2026-08-17 | 初版。auth/books/categories/tags/metadata/query/export/import/health 全接口 | gstack-lead |
| v1.1 | - | 2026-08-17 | 评审修订：软删+回收站接口(3.5-3.8)、列表 trash 参数与排序枚举、book 提交字段与 tags 按名 upsert、AI 过滤 JSON schema+写日志、导出不含回收站、分类/标签 count 仅计在库 | gstack-lead |
| v1.2 | 0.1.0 | 2026-08-19 | 新增 6A 节：AI Agent（Bearer Key）端点约定与 `POST /api/agent/books/metadata/fetch` 抓取端点 | gstack-lead |
| v1.3 | - | 2026-08-31 | 书籍支持 `shelved` 状态（4 态）与 `favorite` 收藏（0/1）；列表新增 `favorite=1` 过滤；Book 结构含 `favorite`；创建可传 `favorite`/`created_at`（导入保留录入时间）；CSV 导出/导入新增「收藏」「录入时间」列；Agent 过滤 JSON 支持 shelved | gstack-lead |
| v1.4 | 1.1.0 | 2026-09-01 | 性能优化：新增 `GET /api/books/stats` 聚合统计（3.9）；metadata/fetch 新增 `force` 参数（6.1、6A.2）；新增 `GET /api/storage/check` 与 `POST /api/storage/cleanup` 存储检查/清理（11）；彻底删除/清空回收站联动清理 KV 元数据缓存与 R2 封面（3.8） | gstack-lead |
| v1.5 | 1.2.0 | 2026-09-19 | 补录：导入为 preview（重复检测）+ batch（≤50 条）两步流；`GET /api/books/stats`、导入/导出实际为 CSV-only、AI 查询（§7）未实现（被 6A Agent 接口替代），详见 README 里程碑 | GLM-5.3-Flash |
| v1.6 | 1.3.0 | 2026-09-19 | 新增 `POST /api/books/:id/cover` 手动上传封面（3.10）；metadata/fetch（6.1、6A.2）ISBN 模式落地兜底链（豆瓣→NeoDB→Open Library→Google Books）；导出（8.1）改为全量备份语义并新增「封面」列；导入（9.1）补充逐条校验（长度/枚举/URL 白名单）与 CSV ≤2MB、≤1000 行上限；健康检查（10.1）新增 `deep=1` 探测；书籍/分类/标签字段增加长度与枚举校验，非法 `:id` 返 400 | GLM-5.3-Flash |

---

## 1. 通用约定

- **Base Path**：`/api`（Worker 内 Hono 路由）。
- **协议**：JSON（`Content-Type: application/json`）；`GET` 列表走查询参数。
- **鉴权**：基于签名会话 Cookie（HttpOnly + Secure + SameSite）。除登录/健康检查外，所有接口需登录，否则 `401`。
- **时间**：ISO 字符串或 `YYYY-MM-DD HH:MM:SS`（UTC）。
- **回收站**：除显式 `/trash` 接口外，列表/查询/导出默认 `WHERE deleted_at IS NULL`，不含软删书目。
- **统一错误体**：

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "口令错误" } }
```

- **状态码**：`200` 成功、`201` 创建、`204` 删除、`400` 校验失败、`401` 未登录、`403` 禁止、`404` 不存在、`429` 登录封锁、`500` 服务错误。

## 2. 认证与鉴权

### 2.1 POST /api/auth/login
- 鉴权：公开
- 请求：`{ "password": "string(required)" }`
- 成功 `200`：`{ "data": { "id": 1, "username": "...", "display_name": "...", "is_admin": true, "must_change_password": false } }`
- 失败 `401`（口令错）或 `429`（封锁中，body 含剩余分钟）。

### 2.2 POST /api/auth/logout
- 鉴权：登录
- 成功 `200`：`{ "data": { "success": true } }`

### 2.3 GET /api/auth/me
- 鉴权：登录
- 成功 `200`：同 login 的 user 对象；未登录 `401`。

## 3. 书籍（books）

### 3.1 GET /api/books
- 鉴权：登录
- 查询：`status`(`unread|reading|finished|shelved`)、`favorite`(`1` 仅收藏)、`category_id`(int)、`tag`(string)、`q`(string 关键词)、`sort`(`updated_desc|updated_asc|title_asc|title_desc|rating_desc`)、`trash`(`0|1`，默认 0，置 1 仅列回收站)、`limit`、`offset`
- 默认排除软删（`deleted_at IS NULL`）；`trash=1` 时仅列回收站并按 `deleted_at DESC`。
- 成功 `200`：`{ "data": { "items": [Book], "total": 42 } }`
- Book：`{ "id","title","subtitle","author","publisher","isbn","description","cover_url","douban_url","rating","status","favorite","category_id","category_name","category_color","tags":["..."],"source","created_at","updated_at" }`

### 3.2 POST /api/books
- 鉴权：登录
- 请求（至少 `title`）：`{ "title","subtitle","author","translator","publisher","publish_year","page_count","isbn","description","cover_url","douban_url","rating","status":"unread","favorite":0,"category_id","tags":["..."] }`（`category_id` 为选中的分类 id；`tags` 为 name 数组，服务端按名 upsert；状态切到"在读/读完"时服务端写 `started_at`/`finished_at`；`favorite` 0/1；`created_at` 可选，传入时保留该录入时间，缺省为当前时间）。
- 成功 `201`：`{ "data": Book }`；校验失败 `400`。

### 3.3 GET /api/books/:id
- 鉴权：登录
- 成功 `200`：`{ "data": Book }`；不存在 `404`。

### 3.4 PATCH /api/books/:id
- 鉴权：登录
- 请求：上述字段的子集（部分更新）。
- 成功 `200`：`{ "data": Book }`；不存在 `404`。

### 3.5 DELETE /api/books/:id（移入回收站）
- 鉴权：登录
- 说明：**软删除**——置 `deleted_at=now()`，书目从正常列表消失、进入回收站；`book_tags` 关联保留（恢复后复原）。不立即物理删除。
- 成功 `200`：`{ "data": { "id": 1, "deleted": true } }`。

### 3.6 GET /api/books/trash（回收站列表）
- 鉴权：登录
- 查询：同 `GET /api/books`（status/category/tag/q/sort/limit/offset），仅列 `deleted_at IS NOT NULL`，按 `deleted_at DESC`。
- 成功 `200`：`{ "data": { "items": [Book], "total": 3 } }`。

### 3.7 POST /api/books/:id/restore（恢复）
- 鉴权：登录
- 说明：清 `deleted_at`，书目回到正常列表（关联标签一并恢复）。
- 成功 `200`：`{ "data": Book }`；不存在 `404`。

### 3.8 DELETE /api/books/trash/:id（彻底删除，二次确认）
- 鉴权：登录
- 说明：**物理删除**，不可逆；`book_tags` 因 `ON DELETE CASCADE` 级联清除；若该书引用的豆瓣元数据缓存（KV）与封面（R2）不再被任何书引用（含回收站），一并联动清理。
- 成功 `204`。
- 可选 `DELETE /api/books/trash`（清空回收站全部），同样需二次确认；清空后仅存活的书籍仍引用的资源会被保留。

### 3.9 GET /api/books/stats（侧栏聚合统计）
- 鉴权：登录
- 说明：一次返回侧栏所需全部计数与分类/标签列表，取代前端拉全量列表后本地统计（书架较大时显著降低首屏请求量）。必须在 `/:id` 之前匹配（已由路由注册顺序保证）。
- 成功 `200`：`{ "data": { "total": 42, "favorites": 3, "trash": 2, "byStatus": { "unread": 10, "reading": 5, "finished": 20, "shelved": 7 }, "categories": [ { "id": 1, "name": "科幻", "color": "#8b5cf6", "count": 2 } ], "tags": [ { "id": 1, "name": "经典", "count": 2 } ] } }`

### 3.10 POST /api/books/:id/cover（手动上传封面）
- 鉴权：登录
- 请求：`multipart/form-data`，字段 `file`（图片；仅 JPG/PNG/WebP/GIF，≤5MB）
- 处理：写入 R2（key 为 `upload-<bookId>.<ext>`，重传覆盖），返回站内路径
- 成功 `200`：`{ "data": { "cover_url": "/api/covers/upload-1.jpg", "key": "upload-1.jpg" } }`
- 说明：端点只存储并返回路径；前端把路径填入「封面 URL」后随表单保存才生效。删除联动清理按 `cover_url` 引用同样生效。

## 4. 分类（categories）

### 4.1 GET /api/categories
- 鉴权：登录
- 成功 `200`：`{ "data": [ { "id","name","color","count" } ] }`（`count` 仅计在库书本，`deleted_at IS NULL`）。

### 4.2 POST /api/categories
- 鉴权：登录
- 请求：`{ "name":"required","color":"#rrggbb" }`
- 成功 `201`：`{ "data": Category }`；`name` 重复 `400`。

### 4.3 PATCH /api/categories/:id ｜ DELETE /api/categories/:id
- 鉴权：登录
- 删除时其下书籍 `category_id` 置 NULL（不级联删书）。

## 5. 标签（tags）

### 5.1 GET /api/tags
- 鉴权：登录
- 成功 `200`：`{ "data": [ { "id","name","count" } ] }`（`count` 仅计在库书本，`deleted_at IS NULL`）。

### 5.2 POST /api/tags
- 鉴权：登录
- 请求：`{ "name":"required(唯一)" }`
- 成功 `201`：`{ "data": Tag }`。

### 5.3 DELETE /api/tags/:id
- 鉴权：登录
- 级联删除 book_tags 关联。

## 6. 元数据抓取（metadata）

### 6.1 POST /api/books/metadata/fetch
- 鉴权：登录
- 请求：`{ "url"?: "https://book.douban.com/...", "isbn"?: "9787...", "force"?: true }`（url/isbn 二选一；`force` 省略时命中 KV 缓存（TTL 24h）立即返回，置 `true` 绕过缓存强制重新抓取）
- 成功 `200`：`{ "data": { "title","subtitle","author","translator","publisher","publish_year","isbn","page_count","description","cover_url","douban_rating","source":"douban|neodb|openlibrary|googlebooks|manual" } }`
- 说明：**豆瓣为主源**。`isbn` 模式在豆瓣失败/无结果时自动走兜底链（NeoDB → Open Library → Google Books，均匿名无需密钥，NeoDB 命中时会经 external_resources 反查回填 `douban_url`）；`url` 模式仅走豆瓣。`source` 落实际命中的来源。抓取结果回写 KV 缓存（`meta:<source>:…` 键，TTL 24h），封面下载存 R2（仅位图类型、≤5MB）后返回站内代理路径；失败 `400`（原始异常仅入日志，不透出内部细节）。

## 6A. AI Agent（Bearer Key）

### 6A.1 通用约定
- **Base**：`/api/agent`；鉴权用请求头 `Authorization: Bearer <Agent Key>`（独立于登录 session）。
- **写限频**：写操作 10 次/10 分钟；删除限频 10 次/1 小时；缺 Key/失效返回 `401`，超限返回 `429`。
- 现有端点：`GET /books`（查询）、`GET /books/:id`、`GET /categories`、`GET /tags`、`POST /books`、`PATCH /books/:id`、`DELETE /books/:id`（仅软删）、`GET /export/books`。

### 6A.2 POST /api/agent/books/metadata/fetch
- 鉴权：Bearer Agent Key；写限频
- 请求：`{ "url"?: "https://book.douban.com/...", "isbn"?: "9787...", "force"?: true }`（url/isbn 二选一；`force` 语义同 6.1）
- 成功 `200`：`{ "data": { "title","subtitle","author","translator","publisher","publish_year","isbn","page_count","description","cover_url","douban_rating","douban_url","source":"douban|neodb|openlibrary|googlebooks" } }`（`cover_url` 为站内 R2 代理路径或原图；`source` 为实际命中来源）
- 说明：供外部 AI 拿到豆瓣链接/ISBN 后抓取元数据回填，再以结果作为 `POST /api/agent/books` 的创建字段；不直接入库。失败 `400`。

## 7. AI 查询（query）

### 7.1 POST /api/query
- 鉴权：登录
- 请求：`{ "question": "我想看今年上半年读完的科幻书" }`
- 处理：服务端用 `AI_BASE_URL`+`AI_API_KEY` 调 LLM（OpenAI 兼容）→ LLM 返回过滤条件 JSON → 应用参数化只读查询（**默认 `deleted_at IS NULL`**）。
- 过滤 JSON 结构（LLM 产出、应用校验后用）：`{ "status"?: "unread|reading|finished|shelved", "category_id"?: int, "tags"?: string[], "authorContains"?: string, "titleContains"?: string, "finishedAfter"?: "YYYY-MM-DD", "finishedBefore"?: "YYYY-MM-DD" }`（日期范围作用于 `finished_at`；无对应时间字段时退化为 `updated_at` 代理）。
- 成功 `200`：`{ "data": { "items": [Book], "filter": { "status":"finished", "tags":["科幻"] }, "row_count": 5 } }`
- **每次查询后写 `ai_query_log`**（query_text / filter_json / row_count / ip / ok）。
- 失败 `400`（LLM/解析异常）或 `500`。**仅只读，绝不返回写操作。**

## 8. 导出（export）

### 8.1 GET /api/export/template ｜ GET /api/export/books
- 鉴权：登录；实际实现为两个端点（原规划的 `format=json|csv` 仅 CSV 落地）
- `GET /api/export/template`：仅表头的空白模版
- `GET /api/export/books`：全部未删除藏书的**全量备份 CSV**（走全字段查询，含简介/记录/录入理由/封面路径等；此前曾因列表瘦身丢失这些字段，v1.3.0 修复）
- 成功 `200`：`Content-Disposition: attachment`，CSV 表头 + 行；单元格按 CSV 公式注入防护转义（`= + - @` 开头加 `'` 前缀）。表头含「封面」列（`/api/covers/:key` 站内路径，v1.3.0 起追加在末尾）
- 与导入互逆（按表头名匹配）：`收藏`（是/空）、`状态`（中文标签或内部值）、`录入时间` 缺省时用导入时的系统时间。「副标题」（旧版「原书名」表头导入仍兼容）。

## 9. 导入（import）

### 9.1 POST /api/import/books/preview ｜ POST /api/import/books/batch
- 鉴权：登录；实际实现为「预览 → 勾选 → 分批写入」两步流（原规划的单步 update-or-create 未落地）
- `POST /api/import/books/preview`：请求 `{ "csv": "<原文，≤2MB、≤1000 行>" }`；解析逐行规范化（`rowToPrepared`），按 书名规范化 / ISBN / 豆瓣链接 检测重复。成功 `200`：`{ "rows": [ { "index","title","author","isbn","douban_url","valid","duplicate","matched","fields" } ], "summary": { "total","valid","duplicate" } }`
- `POST /api/import/books/batch`：请求 `{ "imports": [ <preview 返回的 fields> ] }`（≤50 条/批）；**逐条 zod 校验**（长度上限、status/favorite/source 枚举、URL 白名单），分类按名复用或新建，全部按「新增」写入
- 成功 `200`：`{ "created": 20 }`；校验失败 `400`（错误体含第几条与原因）

## 10. 健康检查

### 10.1 GET /api/health
- 鉴权：公开；注册在引导中间件之前（bootstrap 故障时仍可探活）
- 成功 `200`：`{ "ok": true }`；`?deep=1` 深度探测 D1/KV：`{ "ok": bool, "checks": { "db": "ok|error", "kv": "ok|error" } }`（异常 `503`）。

## 11. 存储资源检查与清理（storage）

### 11.1 GET /api/storage/check
- 鉴权：登录
- 说明：扫描 KV（前缀 `meta:douban:`）元数据缓存与 R2 封面，对照全量书籍（含回收站）的引用关系，标记不再被任何书引用的孤儿资源。适用于排查历史遗留资源与清理前预览。
- 成功 `200`：`{ "data": { "kv": { "total": 12, "orphans": [ { "key": "meta:douban:subject:1007305", "cached_at": "2026-09-01T03:58:21.484Z", "title": "红楼梦" } ] }, "covers": { "total": 9, "orphans": [ { "key": "9787020002207.jpg", "size": 75383, "uploaded": "2026-09-01T03:58:21.548Z" } ] } } }`

### 11.2 POST /api/storage/cleanup
- 鉴权：登录
- 请求：`{ "kv"?: true, "covers"?: true }`（按需选择清理类别，缺省不清理）
- 说明：重新执行孤儿检测后批量删除对应类别资源；幂等（重复执行无副作用），单键删除失败不中断整体。
- 成功 `200`：`{ "data": { "deletedKv": 1, "deletedCovers": 2 } }`

## 12. 错误码表

| code | HTTP | 含义 |
|------|------|------|
| VALIDATION_ERROR | 400 | 参数校验失败 |
| INVALID_CREDENTIALS | 401 | 口令错误 / 未登录 |
| BRUTE_FORCE_LOCKED | 429 | 登录失败过多被封锁 |
| BUSINESS_ERROR | 400/500 | 业务异常（如抓取失败） |
| NOT_FOUND | 404 | 资源不存在 |