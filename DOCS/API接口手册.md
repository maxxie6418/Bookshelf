# API 接口手册

- **文档版本**：v1.2
- **文档状态**：草案
- **目的和适用范围**：书单管理工具（Bookshelf）全部 HTTP 接口的路径、鉴权、请求参数、响应结构与错误约定。适用于前端联调、后端实现与测试评审。
- **权威级别**：模块规则
- **最后更新日期**：2026-08-19

## 修改记录

| 文档版本号 | 应用版本号 | 日期 | 修改摘要 | 修改模型ID |
|-----------|-----------|------|---------|-----------|
| v1.0 | - | 2026-08-17 | 初版。auth/books/categories/tags/metadata/query/export/import/health 全接口 | gstack-lead |
| v1.1 | - | 2026-08-17 | 评审修订：软删+回收站接口(3.5-3.8)、列表 trash 参数与排序枚举、book 提交字段与 tags 按名 upsert、AI 过滤 JSON schema+写日志、导出不含回收站、分类/标签 count 仅计在库 | gstack-lead |
| v1.2 | 0.1.0 | 2026-08-19 | 新增 6A 节：AI Agent（Bearer Key）端点约定与 `POST /api/agent/books/metadata/fetch` 抓取端点 | gstack-lead |

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
- 查询：`status`(`unread|reading|finished`)、`category_id`(int)、`tag`(string)、`q`(string 关键词)、`sort`(`updated_desc|updated_asc|title_asc|title_desc|rating_desc`)、`trash`(`0|1`，默认 0，置 1 仅列回收站)、`limit`、`offset`
- 默认排除软删（`deleted_at IS NULL`）；`trash=1` 时仅列回收站并按 `deleted_at DESC`。
- 成功 `200`：`{ "data": { "items": [Book], "total": 42 } }`
- Book：`{ "id","title","author","publisher","isbn","description","cover_url","douban_url","rating","status","category_id","category_name","category_color","tags":["..."],"source","created_at","updated_at" }`

### 3.2 POST /api/books
- 鉴权：登录
- 请求（至少 `title`）：`{ "title","author","translator","publisher","publish_year","page_count","original_title","isbn","description","cover_url","douban_url","rating","status":"unread","category_id","tags":["..."] }`（`category_id` 为选中的分类 id；`tags` 为 name 数组，服务端按名 upsert；状态切到"在读/读完"时服务端写 `started_at`/`finished_at`）。
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
- 说明：**物理删除**，不可逆；`book_tags` 因 `ON DELETE CASCADE` 级联清除；封面若落 R2 一并清理。前端需在回收站对"彻底删除"做二次确认弹窗。
- 成功 `204`。
- 可选 `DELETE /api/books/trash`（清空回收站全部），同样需二次确认。

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
- 请求：`{ "url"?: "https://book.douban.com/...", "isbn"?: "9787..." }`（二选一）
- 成功 `200`：`{ "data": { "title","author","translator","publisher","publish_year","isbn","page_count","original_title","description","cover_url","douban_rating","source":"douban|neodb|openlibrary|googlebooks|manual" } }`
- 说明：走兜底链（豆瓣→NeoDB→Open Library→Google Books→手动）；失败 `400` 并提示"获取链接失败，请改用粘贴文本导入"。

## 6A. AI Agent（Bearer Key）

### 6A.1 通用约定
- **Base**：`/api/agent`；鉴权用请求头 `Authorization: Bearer <Agent Key>`（独立于登录 session）。
- **写限频**：写操作 10 次/10 分钟；删除限频 10 次/1 小时；缺 Key/失效返回 `401`，超限返回 `429`。
- 现有端点：`GET /books`（查询）、`GET /books/:id`、`GET /categories`、`GET /tags`、`POST /books`、`PATCH /books/:id`、`DELETE /books/:id`（仅软删）、`GET /export/books`。

### 6A.2 POST /api/agent/books/metadata/fetch
- 鉴权：Bearer Agent Key；写限频
- 请求：`{ "url"?: "https://book.douban.com/...", "isbn"?: "9787..." }`（二选一）
- 成功 `200`：`{ "data": { "title","author","translator","publisher","publish_year","isbn","page_count","original_title","description","cover_url","douban_rating","douban_url","source":"douban" } }`（`cover_url` 为站内 R2 代理路径或原豆瓣图）
- 说明：供外部 AI 拿到豆瓣链接/ISBN 后抓取元数据回填，再以结果作为 `POST /api/agent/books` 的创建字段；不直接入库。失败 `400`。

## 7. AI 查询（query）

### 7.1 POST /api/query
- 鉴权：登录
- 请求：`{ "question": "我想看今年上半年读完的科幻书" }`
- 处理：服务端用 `AI_BASE_URL`+`AI_API_KEY` 调 LLM（OpenAI 兼容）→ LLM 返回过滤条件 JSON → 应用参数化只读查询（**默认 `deleted_at IS NULL`**）。
- 过滤 JSON 结构（LLM 产出、应用校验后用）：`{ "status"?: "unread|reading|finished", "category_id"?: int, "tags"?: string[], "authorContains"?: string, "titleContains"?: string, "finishedAfter"?: "YYYY-MM-DD", "finishedBefore"?: "YYYY-MM-DD" }`（日期范围作用于 `finished_at`；无对应时间字段时退化为 `updated_at` 代理）。
- 成功 `200`：`{ "data": { "items": [Book], "filter": { "status":"finished", "tags":["科幻"] }, "row_count": 5 } }`
- **每次查询后写 `ai_query_log`**（query_text / filter_json / row_count / ip / ok）。
- 失败 `400`（LLM/解析异常）或 `500`。**仅只读，绝不返回写操作。**

## 8. 导出（export）

### 8.1 GET /api/export
- 鉴权：登录
- 查询：`format`(`json|csv`)、`status`、`category_id`、`tag`、`q`（与列表同筛选，缺省全量）
- 成功 `200`：`Content-Disposition: attachment`；JSON 为书籍数组，CSV 为表头 + 行。**默认不含回收站（`deleted_at IS NULL`）。**
- 与导入互逆（字段一一对应）：导出含 `category_name` 与 `tags`（name 数组），导入按名复用。

## 9. 导入（import）

### 9.1 POST /api/import
- 鉴权：登录
- 请求：`{ "format":"json|csv", "content": "原始文本或 base64" }`
- 匹配：优先 `isbn`，否则 `title+author`；命中更新、未命中新建；分类/标签按名复用或新建。
- 成功 `200`：`{ "data": { "imported": 3, "updated": 2, "skipped": 0, "errors": [ { "row": 5, "reason": "缺少 title" } ] } }`
- 幂等：相同 ISBN 重复导入为更新；错误行进 `errors`，不中断整体。

## 10. 健康检查

### 10.1 GET /api/health
- 鉴权：公开
- 成功 `200`：`{ "ok": true }`。

## 11. 错误码表

| code | HTTP | 含义 |
|------|------|------|
| VALIDATION_ERROR | 400 | 参数校验失败 |
| INVALID_CREDENTIALS | 401 | 口令错误 / 未登录 |
| BRUTE_FORCE_LOCKED | 429 | 登录失败过多被封锁 |
| BUSINESS_ERROR | 400/500 | 业务异常（如抓取失败） |
| NOT_FOUND | 404 | 资源不存在 |
