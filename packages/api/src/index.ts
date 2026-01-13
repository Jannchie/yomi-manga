import type { SQL } from 'drizzle-orm'
import { readFile } from 'node:fs/promises'

import path from 'node:path'
import { serve } from '@hono/node-server'
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createIPX, ipxFSStorage } from 'ipx'

import { db } from './db.js'
import { mangaData, mangaMeta } from './schema.js'

const app = new Hono()

const mediaRoot = path.resolve(
  process.cwd(),
  process.env.MANGA_ROOT ?? process.env.MEDIA_ROOT ?? 'manga',
)
const imageMaxAge = Number(process.env.IMAGE_MAX_AGE ?? 3600)
const resolvedImageMaxAge = Number.isFinite(imageMaxAge) && imageMaxAge > 0
  ? imageMaxAge
  : 3600
const ipx = createIPX({
  maxAge: resolvedImageMaxAge,
  storage: ipxFSStorage({
    dir: mediaRoot,
    maxAge: resolvedImageMaxAge,
  }),
})
const safeMediaRoot = mediaRoot.endsWith(path.sep)
  ? mediaRoot
  : `${mediaRoot}${path.sep}`

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

app.get('/', c => c.json({ ok: true, message: 'yomi-manga api' }))

app.get('/manga', (c) => {
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

app.get('/manga/types', (c) => {
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
  return c.json({ data })
})

app.post('/manga', async (c) => {
  const payload = await c.req.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const { title, slug } = payload as { title?: unknown, slug?: unknown }
  if (typeof title !== 'string') {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const rawSlug = typeof slug === 'string' ? slug : trimmedTitle
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
    .values({ slug: normalizedSlug, title: trimmedTitle })
    .run()
  return c.json({ id: Number(result.lastInsertRowid) })
})

app.get('/manga/:id', (c) => {
  const mangaId = Number(c.req.param('id'))
  if (!Number.isInteger(mangaId) || mangaId <= 0) {
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

app.post('/manga/:id/rating', async (c) => {
  const mangaId = Number(c.req.param('id'))
  if (!Number.isInteger(mangaId) || mangaId <= 0) {
    return c.json({ error: 'invalid_manga_id' }, 400)
  }

  const payload = await c.req.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const { rating } = payload as { rating?: unknown }
  const normalizedRating = normalizeRating(rating)
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

app.get('/manga/:id/pages', (c) => {
  const mangaId = Number(c.req.param('id'))
  if (!Number.isInteger(mangaId) || mangaId <= 0) {
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

app.post('/manga/:id/pages', async (c) => {
  const mangaId = Number(c.req.param('id'))
  if (!Number.isInteger(mangaId) || mangaId <= 0) {
    return c.json({ error: 'invalid_manga_id' }, 400)
  }

  const payload = await c.req.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const { pageIndex, path } = payload as {
    pageIndex?: unknown
    path?: unknown
  }

  if (
    typeof pageIndex !== 'number'
    || !Number.isInteger(pageIndex)
    || pageIndex < 0
    || typeof path !== 'string'
  ) {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  const trimmedPath = path.trim()
  if (!trimmedPath) {
    return c.json({ error: 'invalid_payload' }, 400)
  }

  db.insert(mangaData).values({
    mangaId,
    pageIndex,
    path: trimmedPath,
  }).run()

  return c.json({ ok: true })
})

app.get('/image', async (c) => {
  const requestedPath = c.req.query('path')
  if (!requestedPath) {
    return c.json({ error: 'missing_path' }, 400)
  }

  const normalizedPath = normalizeImagePath(requestedPath)
  if (!normalizedPath) {
    return c.json({ error: 'invalid_path' }, 400)
  }

  const query = c.req.query()
  const acceptHeader = c.req.header('accept')
  const { modifiers, hasModifiers, varyAccept } = buildImageModifiers(query, acceptHeader)

  if (!hasModifiers) {
    const targetPath = path.resolve(mediaRoot, normalizedPath)
    if (!targetPath.startsWith(safeMediaRoot)) {
      return c.json({ error: 'invalid_path' }, 400)
    }

    try {
      const data = await readFile(targetPath)
      return c.body(toResponseBody(data), 200, {
        'Cache-Control': `public, max-age=${resolvedImageMaxAge}`,
        'Content-Type': contentType(targetPath),
      })
    }
    catch {
      return c.json({ error: 'not_found' }, 404)
    }
  }

  try {
    const img = ipx(normalizedPath, modifiers)
    const sourceMeta = await img.getSourceMeta()
    const ifModifiedSince = c.req.header('if-modified-since')
    if (sourceMeta.mtime && ifModifiedSince) {
      const since = new Date(ifModifiedSince)
      if (!Number.isNaN(since.getTime()) && since >= sourceMeta.mtime) {
        return new Response(null, { status: 304 })
      }
    }

    const { data, format } = await img.process()
    const headers: Record<string, string> = {
      'Cache-Control': `public, max-age=${sourceMeta.maxAge ?? resolvedImageMaxAge}`,
      'Content-Type': format ? `image/${format}` : contentType(normalizedPath),
    }

    if (sourceMeta.mtime) {
      headers['Last-Modified'] = sourceMeta.mtime.toUTCString()
    }

    if (varyAccept) {
      headers.Vary = 'Accept'
    }

    return c.body(toResponseBody(data), 200, headers)
  }
  catch (error) {
    const status = extractIpxStatus(error)
    if (status === 404) {
      return c.json({ error: 'not_found' }, 404)
    }
    if (status === 403) {
      return c.json({ error: 'invalid_path' }, 403)
    }
    if (status === 400) {
      return c.json({ error: 'invalid_image' }, 400)
    }
    return c.json({ error: 'image_processing_failed' }, 500)
  }
})

function normalizeImagePath(requestedPath: string): string | null {
  const normalizedPath = requestedPath.replace(/^[/\\]+/, '').trim()
  return normalizedPath || null
}

function buildImageModifiers(
  query: Record<string, string>,
  acceptHeader?: string,
): {
  modifiers: Record<string, string>
  hasModifiers: boolean
  varyAccept: boolean
} {
  const modifiers: Record<string, string> = {}
  const width = parsePositiveNumber(query.w ?? query.width)
  const height = parsePositiveNumber(query.h ?? query.height)
  const dpr = parsePositiveNumber(query.dpr ?? query.d)
  const fit = parseFit(query.fit)
  const quality = parsePositiveNumber(query.q ?? query.quality)
  const rawFormat = (query.format ?? query.f)?.toLowerCase()

  const scale = dpr ?? 1
  const scaledWidth = width ? Math.round(width * scale) : null
  const scaledHeight = height ? Math.round(height * scale) : null

  if (scaledWidth && scaledHeight) {
    modifiers.resize = `${scaledWidth}x${scaledHeight}`
  }
  else {
    if (scaledWidth) {
      modifiers.w = String(scaledWidth)
    }

    if (scaledHeight) {
      modifiers.h = String(scaledHeight)
    }
  }

  if (fit) {
    modifiers.fit = fit
  }

  if (quality) {
    const normalizedQuality = Math.min(100, Math.max(1, Math.round(quality)))
    modifiers.q = String(normalizedQuality)
  }

  let varyAccept = false
  if (rawFormat) {
    if (rawFormat === 'auto') {
      modifiers.format = detectAutoFormat(acceptHeader)
      varyAccept = true
    }
    else {
      modifiers.format = rawFormat
    }
  }

  const hasModifiers = Object.keys(modifiers).length > 0
  return { modifiers, hasModifiers, varyAccept }
}

function parsePositiveNumber(value?: string): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function parseFit(value?: string): string | null {
  if (!value) {
    return null
  }

  switch (value) {
    case 'contain':
    case 'cover':
    case 'fill':
    case 'inside':
    case 'outside': {
      return value
    }
    default: {
      return null
    }
  }
}

function detectAutoFormat(acceptHeader?: string): string {
  const accept = acceptHeader?.toLowerCase() ?? ''
  if (accept.includes('image/avif')) {
    return 'avif'
  }
  if (accept.includes('image/webp')) {
    return 'webp'
  }
  if (accept.includes('image/jpeg')) {
    return 'jpeg'
  }
  if (accept.includes('image/png')) {
    return 'png'
  }
  return 'jpeg'
}

function extractIpxStatus(error: unknown): number | null {
  if (typeof error !== 'object' || !error) {
    return null
  }

  const maybeStatus = (error as { statusCode?: unknown }).statusCode
  if (typeof maybeStatus === 'number') {
    return maybeStatus
  }

  return null
}

function contentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.avif': {
      return 'image/avif'
    }
    case '.bmp': {
      return 'image/bmp'
    }
    case '.gif': {
      return 'image/gif'
    }
    case '.jpeg':
    case '.jpg': {
      return 'image/jpeg'
    }
    case '.png': {
      return 'image/png'
    }
    case '.svg': {
      return 'image/svg+xml'
    }
    case '.webp': {
      return 'image/webp'
    }
    default: {
      return 'application/octet-stream'
    }
  }
}

function toResponseBody(
  data: string | Uint8Array,
): string | Uint8Array<ArrayBuffer> {
  if (typeof data === 'string') {
    return data
  }

  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy
}

function parseTags(raw: string | null): string[] | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return null
    }
    const tags = parsed
      .filter((item): item is string => typeof item === 'string')
      .map(tag => tag.trim())
      .filter(Boolean)
    return tags.length > 0 ? tags : null
  }
  catch {
    return null
  }
}

function normalizeRating(value: unknown): number | null | undefined {
  if (value === null) {
    return null
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  const rounded = Math.round(value)
  if (!Number.isInteger(rounded) || rounded < 1 || rounded > 5) {
    return undefined
  }

  return rounded
}

function buildMangaWhere(
  type: string | null,
  search: string | null,
): SQL | undefined {
  const conditions: SQL[] = []
  if (type) {
    conditions.push(eq(mangaMeta.type, type))
  }

  if (search) {
    const pattern = `%${search}%`
    const searchCondition = or(
      sql`${mangaMeta.title} LIKE ${pattern}`,
      sql`COALESCE(${mangaMeta.tags}, '') LIKE ${pattern}`,
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (conditions.length === 0) {
    return undefined
  }

  if (conditions.length === 1) {
    return conditions[0]
  }

  return and(...conditions)
}

function normalizeQueryValue(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

const port = Number(process.env.PORT ?? 4347)

serve({ fetch: app.fetch, port })
