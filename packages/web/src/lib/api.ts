const rawBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:4347'
const apiBase = rawBase.replace(/\/$/, '')

export interface MangaListItem {
  id: number
  title: string
  coverPath: string | null
  type: string | null
  tags: string[] | null
  rating: number | null
}

export interface MangaMeta {
  id: number
  title: string
  slug: string
  type: string | null
  tags: string[] | null
  meta: string | null
  rating: number | null
}

export interface MangaPage {
  id: number
  mangaId: number
  pageIndex: number
  path: string
  width: number | null
  height: number | null
  ratio: number | null
}

export interface Paginated<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ImageOptions {
  width?: number
  height?: number
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside'
  format?: 'auto' | 'avif' | 'jpeg' | 'png' | 'webp'
  quality?: number
}

export function buildImageUrl(path: string, options: ImageOptions = {}): string {
  const params = new URLSearchParams({ path })
  if (typeof options.width === 'number' && options.width > 0) {
    params.set('w', String(Math.round(options.width)))
  }
  if (typeof options.height === 'number' && options.height > 0) {
    params.set('h', String(Math.round(options.height)))
  }
  if (options.fit) {
    params.set('fit', options.fit)
  }
  if (options.format) {
    params.set('format', options.format)
  }
  if (typeof options.quality === 'number' && options.quality > 0) {
    params.set('q', String(Math.round(options.quality)))
  }
  return `${apiBase}/image?${params.toString()}`
}

export async function fetchMangaPage(
  page: number,
  pageSize: number,
  type?: string | null,
): Promise<Paginated<MangaListItem>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (type) {
    params.set('type', type)
  }
  return fetchJson(`/manga?${params.toString()}`)
}

export async function fetchMangaPages(mangaId: number): Promise<MangaPage[]> {
  const response = await fetchJson<{ data: MangaPage[] }>(
    `/manga/${mangaId}/pages`,
  )
  return response.data
}

export async function fetchMangaMeta(mangaId: number): Promise<MangaMeta> {
  return fetchJson(`/manga/${mangaId}`)
}

export async function fetchMangaTypes(): Promise<string[]> {
  const response = await fetchJson<{ data: string[] }>('/manga/types')
  return response.data
}

export async function updateMangaRating(
  mangaId: number,
  rating: number | null,
): Promise<{ rating: number | null }> {
  return fetchJson(`/manga/${mangaId}/rating`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  })
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBase}${path}`, { ...init, headers })
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}
