import { readFile } from 'node:fs/promises'

import path from 'node:path'
import { Hono } from 'hono'
import { createIPX, ipxFSStorage } from 'ipx'

class AsyncLimiter {
  private active = 0
  private queue: Array<() => void> = []

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await task()
    }
    finally {
      this.release()
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1
      return
    }

    await new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
    this.active += 1
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1)
    const next = this.queue.shift()
    if (next) {
      next()
    }
  }
}

const mediaRoot = path.resolve(
  process.cwd(),
  process.env.MANGA_ROOT ?? 'manga',
)
const imageMaxAge = Number(process.env.IMAGE_MAX_AGE ?? 3600)
const resolvedImageMaxAge = Number.isFinite(imageMaxAge) && imageMaxAge > 0
  ? imageMaxAge
  : 3600
const imageConcurrency = Number(process.env.IMAGE_MAX_CONCURRENCY ?? 2)
const resolvedImageConcurrency = Number.isFinite(imageConcurrency)
  ? Math.max(1, Math.floor(imageConcurrency))
  : 2
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
const imageProcessLimiter = new AsyncLimiter(resolvedImageConcurrency)

export const imageRoutes = new Hono()

imageRoutes.get('/image', async (c) => {
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

    const { data, format } = await imageProcessLimiter.run(() => img.process())
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
