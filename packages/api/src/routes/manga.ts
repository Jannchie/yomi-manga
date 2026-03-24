import type { Context } from 'hono'

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '../db.js'
import { buildMangaWhere, normalizeQueryValue, normalizeRating, parseTags } from '../lib/manga.js'
import { mangaData, mangaMeta } from '../schema.js'

type JsonRecord = Record<string, unknown>

export const mangaRoutes = new Hono()

mangaRoutes.get('/manga', (c) => {
  const pageParam = c.req.query('page')
  const pageSizeParam = c.req.query('pageSize')
  const typeParam = c.req.query('type')
  const searchParam = c.req.query('q')
  const page = pageParam ? Number(pageParam) : 1
  const pageSize = pageSizeParam ? Number(pageSizeParam) : 12
  const normalizedType = normalizeQueryValue(typeParam)
  const normalizedSearch = normalizeQueryValue(searchParam)
  const whereClause = buildMangaWhere(normalizedType, normalizedSearch)

  if (!Number.isInteger(page) || page < 1) {
    return c.json({ error: 'invalid_page' }, 400)
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    return c.json({ error: 'invalid_page_size' }, 400)
  }

  const totalRow = (whereClause
    ? db
        .select({ count: sql<number>`count(*)` })
        .from(mangaMeta)
        .where(whereClause)
    : db
        .select({ count: sql<number>`count(*)` })
        .from(mangaMeta))
    .all()[0]
  const total = totalRow?.count ?? 0

  const baseMetaQuery = db
    .select({
      id: mangaMeta.id,
      title: mangaMeta.title,
      type: mangaMeta.type,
      tags: mangaMeta.tags,
      rating: mangaMeta.rating,
    })
    .from(mangaMeta)
    .orderBy(
      sql`${mangaMeta.publishedAt} IS NULL`,
      desc(mangaMeta.publishedAt),
      desc(mangaMeta.id),
    )
  const metaRows = (whereClause ? baseMetaQuery.where(whereClause) : baseMetaQuery)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all() as Array<{
    id: number
    title: string
    type: string | null
    tags: string | null
    rating: number | null
  }>

  const mangaIds = metaRows.map(row => row.id)
  const coverRows = mangaIds.length > 0
    ? (db
        .select({
          mangaId: mangaData.mangaId,
          path: mangaData.path,
        })
        .from(mangaData)
        .where(
          and(
            inArray(mangaData.mangaId, mangaIds),
            eq(mangaData.pageIndex, 0),
          ),
        )
        .all() as Array<{ mangaId: number, path: string }>)
    : []

  const coverMap = new Map(coverRows.map(row => [row.mangaId, row.path]))
  const data = metaRows.map(row => ({
    id: row.id,
    title: row.title,
    coverPath: coverMap.get(row.id) ?? null,
    type: row.type,
    tags: parseTags(row.tags),
    rating: row.rating,
  }))

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return c.json({
    data,
    page,
    pageSize,
    total,
    totalPages,
  })
})

mangaRoutes.get('/manga/types', () => {
  const rows = db
    .select({ type: mangaMeta.type })
    .from(mangaMeta)
    .all() as Array<{ type: string | null }>

  const types = new Set<string>()
  for (const row of rows) {
    const trimmed = row.type?.trim()
    if (trimmed) {
      types.add(trimmed)
    }
  }

  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
  const data = [...types].toSorted((a, b) => collator.compare(a, b))
  return Response.json({ data })
})

mangaRoutes.post('/manga', async (c) => {
  const payload = await readJsonObject(c)
  if (!payload) {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const title = readNonEmptyString(payload.title)
  if (!title) {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const rawSlug = typeof payload.slug === 'string' ? payload.slug : title
  const normalizedSlug = rawSlug.trim().replaceAll(/[\\/]/g, '-')
  if (!normalizedSlug) {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const existing = db
    .select({ id: mangaMeta.id })
    .from(mangaMeta)
    .where(eq(mangaMeta.slug, normalizedSlug))
    .all()[0]
  if (existing) {
    return c.json({ error: 'slug_exists' }, 409)
  }

  const result = db
    .insert(mangaMeta)
    .values({ slug: normalizedSlug, title })
    .run()
  return c.json({ id: Number(result.lastInsertRowid) })
})

mangaRoutes.get('/manga/:id', (c) => {
  const mangaId = parseMangaId(c.req.param('id'))
  if (mangaId === null) {
    return c.json({ error: 'invalid_manga_id' }, 400)
  }

  const row = db
    .select({
      id: mangaMeta.id,
      title: mangaMeta.title,
      slug: mangaMeta.slug,
      type: mangaMeta.type,
      tags: mangaMeta.tags,
      meta: mangaMeta.meta,
      rating: mangaMeta.rating,
    })
    .from(mangaMeta)
    .where(eq(mangaMeta.id, mangaId))
    .all()[0]

  if (!row) {
    return c.json({ error: 'not_found' }, 404)
  }

  return c.json({
    ...row,
    tags: parseTags(row.tags),
  })
})

mangaRoutes.post('/manga/:id/rating', async (c) => {
  const mangaId = parseMangaId(c.req.param('id'))
  if (mangaId === null) {
    return c.json({ error: 'invalid_manga_id' }, 400)
  }

  const payload = await readJsonObject(c)
  if (!payload) {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const normalizedRating = normalizeRating(payload.rating)
  if (normalizedRating === undefined) {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const existing = db
    .select({ id: mangaMeta.id })
    .from(mangaMeta)
    .where(eq(mangaMeta.id, mangaId))
    .all()[0]
  if (!existing) {
    return c.json({ error: 'not_found' }, 404)
  }

  db.update(mangaMeta)
    .set({ rating: normalizedRating })
    .where(eq(mangaMeta.id, mangaId))
    .run()

  return c.json({ rating: normalizedRating })
})

mangaRoutes.get('/manga/:id/pages', (c) => {
  const mangaId = parseMangaId(c.req.param('id'))
  if (mangaId === null) {
    return c.json({ error: 'invalid_manga_id' }, 400)
  }

  const data = db
    .select()
    .from(mangaData)
    .where(eq(mangaData.mangaId, mangaId))
    .orderBy(asc(mangaData.pageIndex))
    .all()

  return c.json({ data })
})

mangaRoutes.post('/manga/:id/pages', async (c) => {
  const mangaId = parseMangaId(c.req.param('id'))
  if (mangaId === null) {
    return c.json({ error: 'invalid_manga_id' }, 400)
  }

  const payload = await readJsonObject(c)
  if (!payload) {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const pageIndex = payload.pageIndex
  const pagePath = readNonEmptyString(payload.path)

  if (
    typeof pageIndex !== 'number'
    || !Number.isInteger(pageIndex)
    || pageIndex < 0
    || !pagePath
  ) {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  db.insert(mangaData).values({
    mangaId,
    pageIndex,
    path: pagePath,
  }).run()

  return c.json({ ok: true })
})

function parseMangaId(value: string): number | null {
  const mangaId = Number(value)
  if (!Number.isInteger(mangaId) || mangaId <= 0) {
    return null
  }

  return mangaId
}

async function readJsonObject(c: Context): Promise<JsonRecord | null> {
  const payload = await c.req.json().catch(() => null)
  return payload && typeof payload === 'object' ? payload as JsonRecord : null
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}
