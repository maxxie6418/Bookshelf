# Tasks

- [x] Task 1: 列表接口字段瘦身
  - [x] SubTask 1.1: 在 `src/lib/books.ts` 中新增 `LIST_SELECT`（显式列清单，排除 `description`/`notes`/`reason`），并让 `listBooks()` 使用它；`getBook()` 保持全量。
  - [x] SubTask 1.2: 检索前端列表渲染代码，确认 `BookListItem`/列表模板不读取 `description`/`notes`/`reason`；若前端类型与详情共用类型，调整为列表瘦类型 + 详情全量类型。
  - [x] SubTask 1.3: `npm run typecheck` 通过。
- [x] Task 2: 刷新拆分 books / stats + 竞态保护
  - [x] SubTask 2.1: 在 `src/web/refresh.ts` 新增 `refreshBooks()`（只请求列表），`refresh()` 保留列表+统计；两者加入请求序号防竞态。
  - [x] SubTask 2.2: 搜索（桌面+移动端）、翻页、筛选改调 `refreshBooks()`；新增/编辑/删除/恢复/导入等保留或改调 `refresh()`。
  - [x] SubTask 2.3: `npm run typecheck` 通过。
- [x] Task 3: 移动端搜索防抖
  - [x] SubTask 3.1: 在 `src/web/components/app-shell.ts` 移动端 `oninput` 增加 300ms debounce（与桌面端对齐）。
  - [x] SubTask 3.2: `npm run typecheck` 通过。
- [x] Task 4: 封面图异步解码
  - [x] SubTask 4.1: 在 `src/web/components/book-list.ts` 与 `book-inline-edit.ts` 的封面 `<img>` 增加 `decoding="async"`。
  - [x] SubTask 4.2: `npm run typecheck` 通过。
- [x] Task 5: 字体减负 + 构建体积对比
  - [x] SubTask 5.1: 确认 `@fontsource/noto-serif-sc` 与 `@fontsource/jetbrains-mono` 各字重实际使用情况，删除 `src/web/main.ts` 未使用的字重 import。
  - [x] SubTask 5.2: 记录优化前后 `npm run build` 的最大 JS chunk 与字体文件数量/合计字节。
- [x] Task 6: 版本号 +0.1（1.1.1 → 1.2.0）
  - [x] SubTask 6.1: 更新 `package.json` 版本为 `1.2.0`。
  - [x] SubTask 6.2: 更新 `package-lock.json` 根节点版本。
  - [x] SubTask 6.3: 更新 `src/web/components/app-shell.ts` 顶栏文案版本号。
  - [x] SubTask 6.4: 更新 `README.md` 发布记录（追加 v1.2.0 条目）。

# Task Dependencies
- [Task 2] 依赖 [Task 1]（列表类型确定后再调整刷新与调用点）。
- 其余 Task 相互独立，可并行。