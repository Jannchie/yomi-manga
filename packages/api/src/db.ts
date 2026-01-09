import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema.js'

const dbPath = process.env.DATABASE_URL ?? 'data.db'
const sqlite = new Database(dbPath)

sqlite.pragma('journal_mode = WAL')
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS manga_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT,
    tags TEXT,
    meta TEXT,
    published_at INTEGER,
    rating INTEGER
  );
  CREATE TABLE IF NOT EXISTS manga_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manga_id INTEGER NOT NULL,
    page_index INTEGER NOT NULL,
    path TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    ratio REAL,
    FOREIGN KEY (manga_id) REFERENCES manga_meta(id)
  );
`)

const metaColumns = sqlite.prepare('PRAGMA table_info(\'manga_meta\')').all() as Array<{
  name: string
}>
const metaColumnNames = new Set(metaColumns.map(column => column.name))

if (!metaColumnNames.has('slug')) {
  sqlite.exec('ALTER TABLE manga_meta ADD COLUMN slug TEXT')
}

if (!metaColumnNames.has('meta')) {
  sqlite.exec('ALTER TABLE manga_meta ADD COLUMN meta TEXT')
}

if (!metaColumnNames.has('type')) {
  sqlite.exec('ALTER TABLE manga_meta ADD COLUMN type TEXT')
}

if (!metaColumnNames.has('tags')) {
  sqlite.exec('ALTER TABLE manga_meta ADD COLUMN tags TEXT')
}

if (!metaColumnNames.has('published_at')) {
  sqlite.exec('ALTER TABLE manga_meta ADD COLUMN published_at INTEGER')
}

if (!metaColumnNames.has('rating')) {
  sqlite.exec('ALTER TABLE manga_meta ADD COLUMN rating INTEGER')
}

sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS manga_meta_slug_idx ON manga_meta (slug)')

const dataColumns = sqlite.prepare('PRAGMA table_info(\'manga_data\')').all() as Array<{
  name: string
}>
const dataColumnNames = new Set(dataColumns.map(column => column.name))

if (!dataColumnNames.has('width')) {
  sqlite.exec('ALTER TABLE manga_data ADD COLUMN width INTEGER')
}

if (!dataColumnNames.has('height')) {
  sqlite.exec('ALTER TABLE manga_data ADD COLUMN height INTEGER')
}

if (!dataColumnNames.has('ratio')) {
  sqlite.exec('ALTER TABLE manga_data ADD COLUMN ratio REAL')
}

export const db = drizzle(sqlite, { schema })
