-- 增量为 books 表添加 notes（记录）列，供用户在属性中记录文字（≤2000 字）。
-- 幂等策略见 src/lib/bootstrap.ts 的 ensureBookNotesColumn；此处仅供 migrations_dir 记录及全新部署场景。
ALTER TABLE books ADD COLUMN notes TEXT;
