-- 0004: 副标题列（替换 original_title“原作名”语义，存豆瓣书名下的一句话简介）
-- 幂等：仅当 subtitle 列缺失时执行；本地/线上已由 bootstrap 自动补列，此文件为正式迁移记录。
ALTER TABLE books ADD COLUMN subtitle TEXT;