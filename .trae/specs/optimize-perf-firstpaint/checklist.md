# Checklist

- [x] 列表接口 `GET /api/books` 响应不再包含 `description`/`notes`/`reason`
- [x] 详情接口 `GET /api/books/:id` 保持完整字段
- [x] 前端列表渲染不依赖被删字段，无运行时异常
- [x] 搜索、翻页、筛选仅请求列表，不请求 `/api/books/stats`
- [x] 新增/编辑/删除/恢复/导入后列表与统计都刷新
- [x] 移动端搜索输入有 300ms 防抖
- [x] 并发刷新请求不会用旧结果覆盖新结果
- [x] 封面 `<img>` 设置 `decoding="async"`（列表与行内编辑）
- [x] `main.ts` 仅保留实际使用的字体字重
- [x] 已记录优化前后 build 体积对比
- [x] `package.json` 版本为 `1.2.0`，锁文件、顶栏文案、README 同步
- [x] `npm run typecheck` 通过
- [x] `npm run build` 通过