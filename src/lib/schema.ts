import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Drizzle schema（M0 仅建 users，供后续里程碑复用；其余表按需补充）。
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username'),
  displayName: text('display_name'),
  passwordHash: text('password_hash').notNull(),
  isAdmin: integer('is_admin').notNull().default(1),
  mustChangePassword: integer('must_change_password').notNull().default(1),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

export const books = sqliteTable('books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  author: text('author'),
  translator: text('translator'),
  publisher: text('publisher'),
  publishYear: integer('publish_year'),
  pageCount: integer('page_count'),
  originalTitle: text('original_title'),
  isbn: text('isbn'),
  description: text('description'),
  coverUrl: text('cover_url'),
  doubanUrl: text('douban_url'),
  rating: integer('rating'),
  status: text('status').notNull().default('unread'),
  categoryId: integer('category_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  source: text('source').notNull().default('manual'),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});
