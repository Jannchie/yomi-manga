import type { SQL } from 'drizzle-orm'

import { and, eq, or, sql } from 'drizzle-orm'

import { mangaMeta } from '../schema.js'

export function parseTags(raw: string | null): string[] | null {
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

export function normalizeRating(value: unknown): number | null | undefined {
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

export function buildMangaWhere(
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

export function normalizeQueryValue(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}
