import type { Dirent } from 'node:fs'

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { eq, inArray } from 'drizzle-orm'
import { imageSizeFromFile } from 'image-size/fromFile'

import { db } from '../db.js'
import { mangaData, mangaMeta } from '../schema.js'

type MangaMetaPayload = Record<string, unknown>

interface SyncOptions {
  root: string
  prune: boolean
}

interface MangaEntry {
  slug: string
  title: string
  type: string | null
  tagsJson: string | null
  metaJson: string | null
  publishedAt: number | null
  pages: Array<{
    path: string
    pageIndex: number
    width: number | null
    height: number | null
    ratio: number | null
  }>
}

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
])

const PUBLISH_DATE_KEYS = new Set([
  'created',
  'createdat',
  'date',
  'postdate',
  'posted',
  'postedat',
  'publishdate',
  'published',
  'publishedat',
  'publisheddate',
  'released',
  'releasedat',
  'releasedate',
  'release',
  'uploaddate',
  'uploadedat',
])

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

const options = parseArgs(process.argv.slice(2))

if (options) {
  await run(options)
}

async function run(options: SyncOptions): Promise<void> {
  let entries: Dirent[]
  try {
    entries = await readdir(options.root, { withFileTypes: true })
  }
  catch (error) {
    console.error(`Failed to read root directory: ${options.root}`)
    console.error(error)
    process.exitCode = 1
    return
  }

  const directories = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => entry.name)
    .toSorted((a, b) => collator.compare(a, b))

  const processedSlugs: string[] = []

  for (const dirName of directories) {
    const dirPath = path.resolve(options.root, dirName)
    const entry = await scanManga(options.root, dirPath)
    processedSlugs.push(entry.slug)
    await upsertManga(entry)
    console.info(`Synced ${entry.slug} (${entry.pages.length} pages)`)
  }

  if (options.prune) {
    await pruneManga(processedSlugs)
  }

  console.info(`Sync finished: ${processedSlugs.length} manga processed.`)
}

async function scanManga(root: string, dirPath: string): Promise<MangaEntry> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files = entries.filter(entry => entry.isFile()).map(entry => entry.name)

  const metaFile = pickMetaFile(files)
  const meta = await readMetaFile(dirPath, metaFile)
  const slug = normalizeRelative(root, dirPath)
  const title = pickTitle(meta, slug)
  const type = meta
    ? getString(meta, 'category') ?? getString(meta, 'type')
    : null
  const tagsJson = meta ? formatTags(meta) : null
  const metaJson = meta ? JSON.stringify(meta) : null
  const publishedAt = meta ? pickPublishedAt(meta) : null

  const imageNames = files
    .filter(name => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .toSorted((a, b) => collator.compare(a, b))

  const pages = []
  for (const [index, name] of imageNames.entries()) {
    const absolutePath = path.resolve(dirPath, name)
    const relativePath = normalizeRelative(root, absolutePath)
    const size = await readImageSize(absolutePath)
    const width = size?.width ?? null
    const height = size?.height ?? null
    const ratio
      = typeof width === 'number' && typeof height === 'number' && height > 0
        ? width / height
        : null

    pages.push({
      path: relativePath,
      pageIndex: index,
      width,
      height,
      ratio,
    })
  }

  return {
    slug,
    title,
    type,
    tagsJson,
    metaJson,
    publishedAt,
    pages,
  }
}

function pickMetaFile(files: string[]): string | null {
  const jsonFiles = files.filter(name => path.extname(name).toLowerCase() === '.json')
  if (jsonFiles.length === 0) {
    return null
  }

  const preferred = ['.album.json', 'meta.json', 'metadata.json', 'info.json']
  for (const candidate of preferred) {
    const match = jsonFiles.find(name => name.toLowerCase() === candidate)
    if (match) {
      return match
    }
  }

  return jsonFiles.toSorted((a, b) => collator.compare(a, b))[0] ?? null
}

async function readMetaFile(dirPath: string, metaFile: string | null): Promise<MangaMetaPayload | null> {
  if (!metaFile) {
    return null
  }

  try {
    const raw = await readFile(path.resolve(dirPath, metaFile), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') {
      return parsed as MangaMetaPayload
    }
    return null
  }
  catch (error) {
    console.warn(`Failed to parse metadata: ${dirPath}/${metaFile}`)
    console.warn(error)
    return null
  }
}

function pickTitle(meta: MangaMetaPayload | null, fallback: string): string {
  if (!meta) {
    return fallback
  }

  const titleCandidate = getString(meta, 'title') ?? getString(meta, 'name')
  if (titleCandidate) {
    return titleCandidate
  }

  return fallback
}

function getString(meta: MangaMetaPayload, key: string): string | null {
  const value = meta[key]
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function formatTags(meta: MangaMetaPayload): string | null {
  const value = meta.tags
  if (Array.isArray(value)) {
    const tags = value
      .filter((item): item is string => typeof item === 'string')
      .map(tag => tag.trim())
      .filter(Boolean)
    return tags.length > 0 ? JSON.stringify(tags) : null
  }

  if (typeof value === 'string') {
    const tags = value
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
    return tags.length > 0 ? JSON.stringify(tags) : null
  }

  return null
}

function pickPublishedAt(meta: MangaMetaPayload): number | null {
  const direct = pickPublishedAtFromRecord(meta)
  if (direct !== null) {
    return direct
  }

  for (const value of Object.values(meta)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue
    }

    const nested = pickPublishedAtFromRecord(value as Record<string, unknown>)
    if (nested !== null) {
      return nested
    }
  }

  return null
}

function pickPublishedAtFromRecord(record: Record<string, unknown>): number | null {
  for (const [key, value] of Object.entries(record)) {
    if (!PUBLISH_DATE_KEYS.has(normalizeKey(key))) {
      continue
    }

    const parsed = parseDateValue(value)
    if (parsed !== null) {
      return parsed
    }
  }

  return null
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseDateValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return normalizeTimestamp(value)
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4))
    const month = Number(trimmed.slice(4, 6))
    const day = Number(trimmed.slice(6, 8))
    return buildUtcDate(year, month, day)
  }

  if (/^\d+$/.test(trimmed)) {
    return normalizeTimestamp(Number(trimmed))
  }

  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) {
    return parsed
  }

  const dateMatch = trimmed.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?/,
  )
  if (dateMatch) {
    const year = Number(dateMatch[1])
    const month = Number(dateMatch[2])
    const day = Number(dateMatch[3])
    const hour = dateMatch[4] ? Number(dateMatch[4]) : 0
    const minute = dateMatch[5] ? Number(dateMatch[5]) : 0
    const second = dateMatch[6] ? Number(dateMatch[6]) : 0
    return buildUtcDate(year, month, day, hour, minute, second)
  }

  return null
}

function buildUtcDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number | null {
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second)
  return Number.isNaN(timestamp) ? null : timestamp
}

function normalizeTimestamp(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  if (value > 1_000_000_000_000) {
    return Math.round(value)
  }

  if (value > 1_000_000_000) {
    return Math.round(value * 1000)
  }

  return null
}

function normalizeRelative(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join('/')
}

async function readImageSize(
  filePath: string,
): Promise<{ width?: number, height?: number } | null> {
  try {
    return await imageSizeFromFile(filePath)
  }
  catch (error) {
    console.warn(`Failed to read image size: ${filePath}`)
    console.warn(error)
    return null
  }
}

async function upsertManga(entry: MangaEntry): Promise<void> {
  const existing = db
    .select({ id: mangaMeta.id })
    .from(mangaMeta)
    .where(eq(mangaMeta.slug, entry.slug))
    .all()[0]

  const mangaId = existing
    ? existing.id
    : Number(
        db
          .insert(mangaMeta)
          .values({
            slug: entry.slug,
            title: entry.title,
            type: entry.type,
            tags: entry.tagsJson,
            meta: entry.metaJson,
            publishedAt: entry.publishedAt,
          })
          .run()
          .lastInsertRowid,
      )

  if (existing) {
    db.update(mangaMeta)
      .set({
        title: entry.title,
        type: entry.type,
        tags: entry.tagsJson,
        meta: entry.metaJson,
        publishedAt: entry.publishedAt,
      })
      .where(eq(mangaMeta.id, mangaId))
      .run()
  }

  db.delete(mangaData).where(eq(mangaData.mangaId, mangaId)).run()
  if (entry.pages.length > 0) {
    db.insert(mangaData)
      .values(
        entry.pages.map(page => ({
          mangaId,
          pageIndex: page.pageIndex,
          path: page.path,
          width: page.width,
          height: page.height,
          ratio: page.ratio,
        })),
      )
      .run()
  }
}

async function pruneManga(activeSlugs: string[]): Promise<void> {
  const existing = db
    .select({ slug: mangaMeta.slug, id: mangaMeta.id })
    .from(mangaMeta)
    .all() as Array<{ slug: string, id: number }>
  const stale = existing.filter(row => !activeSlugs.includes(row.slug))

  if (stale.length === 0) {
    return
  }

  const staleIds = stale.map(row => row.id)
  db.delete(mangaData).where(inArray(mangaData.mangaId, staleIds)).run()
  db.delete(mangaMeta).where(inArray(mangaMeta.id, staleIds)).run()

  console.info(`Pruned ${staleIds.length} manga entries.`)
}

function parseArgs(args: string[]): SyncOptions | null {
  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    return null
  }

  const rootArg = readArgValue(args, '--root') ?? readArgValue(args, '-r')
  const rootFromEnv = process.env.MANGA_ROOT ?? process.env.MEDIA_ROOT ?? '/mnt/nas/h-manga'
  const root = path.resolve(process.cwd(), rootArg ?? rootFromEnv)

  return {
    root,
    prune: args.includes('--prune'),
  }
}

function readArgValue(args: string[], key: string): string | null {
  const index = args.indexOf(key)
  if (index !== -1 && index < args.length - 1) {
    return args[index + 1]
  }

  const prefix = `${key}=`
  const inline = args.find(arg => arg.startsWith(prefix))
  if (inline) {
    return inline.slice(prefix.length)
  }

  return null
}

function printUsage(): void {
  console.info('Usage: pnpm --filter @yomi-manga/api sync [--root <dir>] [--prune]')
}
