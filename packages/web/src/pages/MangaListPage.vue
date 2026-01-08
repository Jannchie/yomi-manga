<script setup lang="ts">
import type { MangaListItem } from '../lib/api'

import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import PaginationBar from '../components/PaginationBar.vue'
import { buildImageUrl, fetchMangaPage, fetchMangaTypes } from '../lib/api'

type ErrorState = { message: string } | { key: 'loadManga' }

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()
const page = ref(parsePage(route.query.page) ?? 1)
const pageSize = 12
const placeholderItems = Array.from({ length: pageSize }, (_, index) => index)
const items = ref<MangaListItem[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<ErrorState | null>(null)
const types = ref<string[]>([])
const selectedType = ref<string | null>(parseType(route.query.type))
const columns = ref(1)
const gridRef = ref<HTMLElement | null>(null)
const gridWidth = ref(0)
const loadedCovers = ref<Record<number, boolean>>({})
const gridGapX = 16
const gridGapY = 16
const gridMetaHeight = 64
const coverAspectRatio = 1.5

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const errorMessage = computed(() => {
  if (!error.value) {
    return null
  }
  if ('message' in error.value) {
    return error.value.message
  }
  if (error.value.key === 'loadManga') {
    return t('errors.loadManga')
  }
  return null
})
const gridStyle = computed<Record<string, string>>(() => {
  const columnCount = Math.max(1, columns.value)
  const styles: Record<string, string> = {
    '--grid-columns': String(columnCount),
    '--grid-gap-x': `${gridGapX}px`,
    '--grid-gap-y': `${gridGapY}px`,
    '--card-meta-height': `${gridMetaHeight}px`,
  }

  if (gridWidth.value > 0) {
    const columnWidth = Math.max(
      0,
      (gridWidth.value - gridGapX * (columnCount - 1)) / columnCount,
    )
    const rowHeight = columnWidth * coverAspectRatio + gridMetaHeight
    styles['--grid-col'] = `${columnWidth}px`
    styles['--grid-row'] = `${rowHeight}px`
    styles['--grid-x-step'] = `${columnWidth + gridGapX}px`
    styles['--grid-y-step'] = `${rowHeight + gridGapY}px`
  }

  return styles
})
const coverBaseWidth = computed(() => {
  if (columns.value >= 3) {
    return 360
  }

  if (columns.value === 2) {
    return 520
  }

  return 720
})

function coverImageUrl(path: string, scale = 1): string {
  const width = Math.round(coverBaseWidth.value * scale)
  const height = Math.round(width * 1.5)
  return buildImageUrl(path, {
    width,
    height,
    fit: 'cover',
    format: 'auto',
  })
}

function coverImageSrcSet(path: string): string {
  return `${coverImageUrl(path)} 1x, ${coverImageUrl(path, 2)} 2x`
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    const response = await fetchMangaPage(page.value, pageSize, selectedType.value)
    items.value = response.data
    total.value = response.total

    if (page.value > response.totalPages) {
      page.value = Math.max(1, response.totalPages)
    }
  }
  catch (error_) {
    error.value = error_ instanceof Error ? { message: error_.message } : { key: 'loadManga' }
  }
  finally {
    loading.value = false
  }
}

async function loadTypes(): Promise<void> {
  try {
    types.value = await fetchMangaTypes()
  }
  catch {
    types.value = []
  }
}

onMounted(() => {
  updateColumns()
  globalThis.window.addEventListener('resize', updateColumns)
  void loadTypes()
  void load()
  void refreshGridWidth()
})

onBeforeUnmount(() => {
  globalThis.window.removeEventListener('resize', updateColumns)
})

watch([page, selectedType], () => {
  void load()
})

watch(
  () => route.query.page,
  (value) => {
    const nextPage = parsePage(value) ?? 1
    if (nextPage !== page.value) {
      page.value = nextPage
    }
  },
)

watch(
  () => route.query.type,
  (value) => {
    const nextType = parseType(value)
    if (nextType !== selectedType.value) {
      selectedType.value = nextType
    }
  },
)

watch(gridRef, () => {
  void refreshGridWidth()
})

watch([items, columns], () => {
  void refreshGridWidth()
})

useResizeObserver(gridRef, (entries) => {
  const entry = entries[0]
  if (!entry) {
    return
  }

  gridWidth.value = entry.contentRect.width
})

async function refreshGridWidth(): Promise<void> {
  await nextTick()
  updateGridWidth()
}

function updateGridWidth(): void {
  if (!gridRef.value) {
    return
  }

  gridWidth.value = gridRef.value.getBoundingClientRect().width
}

function updateColumns(): void {
  const width = globalThis.window.innerWidth
  if (width >= 1024) {
    columns.value = 3
    return
  }

  if (width >= 640) {
    columns.value = 2
    return
  }

  columns.value = 1
}

function markCoverLoaded(id: number): void {
  loadedCovers.value = { ...loadedCovers.value, [id]: true }
}

function buildMetaLine(item: MangaListItem): string | null {
  const parts: string[] = []
  if (item.type) {
    const trimmed = item.type.trim()
    if (trimmed) {
      parts.push(typeLabel(trimmed))
    }
  }
  if (item.tags && item.tags.length > 0) {
    const tags = item.tags.map(tag => tag.trim()).filter(Boolean)
    parts.push(...tags)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function typeLabel(type: string): string {
  const key = `categories.${type}`
  return te(key) ? t(key) : type
}

function parsePage(value: unknown): number | null {
  if (Array.isArray(value)) {
    return parsePage(value[0])
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

function parseType(value: unknown): string | null {
  if (Array.isArray(value)) {
    return parseType(value[0])
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function updatePageQuery(nextPage: number): void {
  const currentPage = parsePage(route.query.page) ?? 1
  if (currentPage === nextPage) {
    return
  }

  void router.push({
    path: route.path,
    query: {
      ...route.query,
      page: String(nextPage),
    },
  })
}

function selectType(nextType: string | null): void {
  if (selectedType.value === nextType && page.value === 1) {
    return
  }

  selectedType.value = nextType
  if (page.value !== 1) {
    page.value = 1
  }
  updateTypeQuery(nextType)
}

function updateTypeQuery(nextType: string | null): void {
  const currentType = parseType(route.query.type)
  if (currentType === nextType && page.value === 1) {
    return
  }

  const nextQuery: Record<string, string | string[] | null | undefined> = {
    ...route.query,
    page: '1',
  }

  if (nextType) {
    nextQuery.type = nextType
  }
  else {
    delete nextQuery.type
  }

  void router.push({
    path: route.path,
    query: nextQuery,
  })
}
</script>

<template>
  <section>
    <div class="type-filter-bar flex flex-col sm:flex-row sm:items-center">
      <div class="type-filter-row flex flex-wrap">
        <button
          type="button"
          class="type-filter-btn px-3 py-1.5 text-xs"
          :class="selectedType === null ? 'type-filter-btn--active' : ''"
          :aria-pressed="selectedType === null"
          @click="selectType(null)"
        >
          {{ t('common.all') }}
        </button>
        <button
          v-for="type in types"
          :key="type"
          type="button"
          class="type-filter-btn px-3 py-1.5 text-xs"
          :class="selectedType === type ? 'type-filter-btn--active' : ''"
          :aria-pressed="selectedType === type"
          @click="selectType(type)"
        >
          {{ typeLabel(type) }}
        </button>
      </div>
    </div>
    <div
      v-if="errorMessage"
      class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
    >
      {{ errorMessage }}
    </div>
    <div
      v-else-if="loading"
      class="manga-grid"
      ref="gridRef"
      :style="gridStyle"
      aria-hidden="true"
    >
      <div
        v-for="index in placeholderItems"
        :key="index"
        class="manga-card manga-card--placeholder flex flex-col bg-(--surface)"
      >
        <div class="relative aspect-2/3 w-full bg-(--surface-muted)" />
        <div class="manga-card-meta px-3 py-2" />
      </div>
    </div>
    <div
      v-else-if="items.length === 0"
      class="rounded-md border border-(--border) bg-(--surface) px-4 py-6 text-sm text-(--muted)"
    >
      {{ t('list.empty') }}
    </div>
    <div
      v-else
      class="manga-grid"
      ref="gridRef"
      :style="gridStyle"
    >
      <RouterLink
        v-for="item in items"
        :key="item.id"
        :to="`/manga/${item.id}`"
        class="manga-card flex flex-col bg-(--surface)"
      >
        <div class="relative aspect-2/3 w-full overflow-hidden bg-(--surface-muted)">
          <div
            v-if="item.coverPath && !loadedCovers[item.id]"
            class="manga-placeholder absolute inset-0"
          />
          <img
            v-if="item.coverPath"
            :src="coverImageUrl(item.coverPath)"
            :srcset="coverImageSrcSet(item.coverPath)"
            :alt="t('list.coverAlt', { title: item.title })"
            class="manga-image manga-image-cover absolute inset-0 z-10 h-full w-full object-cover"
            loading="lazy"
            @load="markCoverLoaded(item.id)"
            @error="markCoverLoaded(item.id)"
          >
          <div
            v-else
            class="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-(--muted)"
          >
            {{ t('list.noCover') }}
          </div>
        </div>
        <div class="manga-card-meta px-3 py-2">
          <p class="line-clamp-1 text-sm font-semibold text-(--ink)">
            {{ item.title }}
          </p>
          <p
            v-if="buildMetaLine(item)"
            class="mt-1 line-clamp-1 text-xs text-(--muted)"
          >
            {{ buildMetaLine(item) }}
          </p>
        </div>
      </RouterLink>
    </div>

    <PaginationBar
      v-if="items.length > 0 && totalPages > 1"
      :page="page"
      :total-pages="totalPages"
      :disabled="loading"
      @change="updatePageQuery($event)"
    />
    <div
      v-if="items.length > 0 && totalPages > 1"
      class="h-4"
      aria-hidden="true"
    />
  </section>
</template>
