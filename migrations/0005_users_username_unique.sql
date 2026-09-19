-- 0005: users.username 唯一索引（防并发 seed 竞态插入重复 admin 行）
-- 注意：若存量库已存在重复 username 行，本语句会失败；需先人工清理重复行再执行。
-- Worker 侧由 src/lib/bootstrap.ts 的幂等 ensure 兜底执行（失败仅记录日志，不阻塞引导）。
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
