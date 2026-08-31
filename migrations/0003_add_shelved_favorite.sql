-- 扩展 books.status 支持「搁置」(shelved)，并为 books 新增「收藏」(favorite) 列。
-- SQLite 无法直接修改 CHECK 约束，需重建表；重建时一并携带 favorite（旧表无此列，故 INSERT 需显式列清单）。
-- 重要：D1 在隐式事务中逐语句执行本文件，PRAGMA foreign_keys=OFF 无法阻止 DROP TABLE books 时
-- book_tags 经 ON DELETE CASCADE 被级联清空（本地实测已验证）。因此采用「重命名舞步」方案：
--   1) 创建 books_new + book_tags_new 辅助表并填充数据
--   2) 依次把旧表 RENAME 为 *_old
--   3) 把新表 RENAME 为正式名
--   4) DROP 旧表（此时 books_old 已无外键引用关联，book_tags 指向新的 books）
-- 该方案在本地 D1 实测通过（books/book_tags 数据完整保留）。
CREATE TABLE IF NOT EXISTS books_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  translator TEXT,
  publisher TEXT,
  publish_year INTEGER,
  page_count INTEGER,
  original_title TEXT,
  isbn TEXT,
  description TEXT,
  notes TEXT,
  reason TEXT,
  cover_url TEXT,
  douban_url TEXT,
  rating REAL,
  status TEXT NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread','reading','finished','shelved')),
  favorite INTEGER NOT NULL DEFAULT 0
    CHECK (favorite IN (0,1)),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('douban','neodb','openlibrary','googlebooks','manual')),
  started_at TEXT,
  finished_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO books_new (
  id, title, author, translator, publisher, publish_year, page_count, original_title,
  isbn, description, notes, reason, cover_url, douban_url, rating, status,
  category_id, sort_order, source, started_at, finished_at, deleted_at, created_at, updated_at
) SELECT
  id, title, author, translator, publisher, publish_year, page_count, original_title,
  isbn, description, notes, reason, cover_url, douban_url, rating, status,
  category_id, sort_order, source, started_at, finished_at, deleted_at, created_at, updated_at
FROM books;

CREATE TABLE IF NOT EXISTS book_tags_new (
  book_id INTEGER NOT NULL REFERENCES books_new(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);

INSERT INTO book_tags_new (book_id, tag_id) SELECT book_id, tag_id FROM book_tags;

ALTER TABLE books RENAME TO books_old;
ALTER TABLE books_new RENAME TO books;
ALTER TABLE book_tags RENAME TO book_tags_old;
ALTER TABLE book_tags_new RENAME TO book_tags;
DROP TABLE book_tags_old;
DROP TABLE books_old;

CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_updated ON books(updated_at);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_deleted ON books(deleted_at);