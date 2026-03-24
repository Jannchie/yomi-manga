import type { LocationQuery, LocationQueryRaw, LocationQueryValue } from 'vue-router'

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface MangaListQueryPatch {
  page?: string | null
  type?: string | null
  q?: string | null
}

export function useMangaListQuery() {
  const route = useRoute()
  const router = useRouter()

  const page = computed(() => parsePage(route.query.page) ?? 1)
  const selectedType = computed(() => parseQueryString(route.query.type))
  const searchQuery = computed(() => parseQueryString(route.query.q))
  const searchInput = ref(searchQuery.value ?? '')

  watch(searchQuery, (value) => {
    if ((value ?? '') !== searchInput.value) {
      searchInput.value = value ?? ''
    }
  })

  function setPage(nextPage: number): void {
    const normalizedPage = Math.max(1, Math.round(nextPage))
    if (normalizedPage === page.value) {
      return
    }

    pushQuery({
      page: String(normalizedPage),
    })
  }

  function setType(nextType: string | null): void {
    const normalizedType = normalizeQueryString(nextType)
    if (normalizedType === selectedType.value && page.value === 1) {
      return
    }

    pushQuery({
      page: '1',
      type: normalizedType,
    })
  }

  function setSearch(nextSearch: string | null): void {
    const normalizedSearch = normalizeQueryString(nextSearch)
    if (normalizedSearch === searchQuery.value && page.value === 1) {
      return
    }

    pushQuery({
      page: '1',
      q: normalizedSearch,
    })
  }

  function pushQuery(patch: MangaListQueryPatch): void {
    void router.push({
      path: route.path,
      query: buildNextQuery(route.query, patch),
    })
  }

  return {
    page,
    searchInput,
    searchQuery,
    selectedType,
    setPage,
    setSearch,
    setType,
  }
}

function buildNextQuery(query: LocationQuery, patch: MangaListQueryPatch): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...query }

  for (const [key, value] of Object.entries(patch)) {
    if (value) {
      nextQuery[key] = value
    }
    else {
      delete nextQuery[key]
    }
  }

  return nextQuery
}

function parsePage(value: LocationQueryValue | LocationQueryValue[] | undefined): number | null {
  const rawValue = parseQueryString(value)
  if (!rawValue) {
    return null
  }

  const parsed = Number(rawValue)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

function parseQueryString(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return parseQueryString(value[0])
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function normalizeQueryString(value: string | null): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}
