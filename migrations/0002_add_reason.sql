-- 增量为 books 表添加 reason（录入理由）列，供用户在书籍属性中记录（≤1000 字）。
-- 幂等策略见 src/lib/bootstrap.ts 的 ensureBookReasonColumn；此处仅供 migrations_dir 记录及全新部署场景。
ALTER TABLE books ADD COLUMN reason TEXT;