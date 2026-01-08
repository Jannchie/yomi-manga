import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const mangaMeta = sqliteTable(
  'manga_meta',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    type: text('type'),
    tags: text('tags'),
    meta: text('meta'),
    publishedAt: integer('published_at'),
  },
  table => ({
    slugIndex: uniqueIndex('manga_meta_slug_idx').on(table.slug),
  }),
)

export const mangaData = sqliteTable('manga_data', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mangaId: integer('manga_id').notNull(),
  pageIndex: integer('page_index').notNull(),
  path: text('path').notNull(),
  width: integer('width'),
  height: integer('height'),
  ratio: real('ratio'),
})
