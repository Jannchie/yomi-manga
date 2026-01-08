<script setup lang="ts">
import type { MangaListItem } from '../lib/api'

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Waterfall } from 'vue-wf'

import PaginationBar from '../components/PaginationBar.vue'
import { buildImageUrl, fetchMangaPage, fetchMangaTypes } from '../lib/api'

const route = useRoute()
const router = useRouter()
const page = ref(parsePage(route.query.page) ?? 1)
const pageSize = 12
const items = ref<MangaListItem[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const types = ref<string[]>([])
const selectedType = ref<string | null>(parseType(route.query.type))
const scrollElement = ref<Window | null>(null)
const columns = ref(1)
const loadedCovers = ref<Record<number, boolean>>({})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const waterfallItems = computed(() => items.value.map(() => ({ width: 2, height: 3 })))
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
    error.value = error_ instanceof Error ? error_.message : 'Failed to load manga'
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
  scrollElement.value = globalThis.window
  updateColumns()
  globalThis.window.addEventListener('resize', updateColumns)
  void loadTypes()
  void load()
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
      parts.push(trimmed)
    }
  }
  if (item.tags && item.tags.length > 0) {
    const tags = item.tags.map(tag => tag.trim()).filter(Boolean)
    parts.push(...tags)
  }
  return parts.length > 0 ? parts.join(' · ') : null
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
  return trimmed ? trimmed : null
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
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span class="text-xs uppercase tracking-[0.2em] text-(--muted)">
        Category
      </span>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-1 text-xs transition-colors"
          :class="selectedType === null ? 'border-(--border) bg-(--surface-muted) text-(--ink)' : 'border-(--border) text-(--muted) hover:border-blue-400 hover:text-blue-600'"
          :aria-pressed="selectedType === null"
          @click="selectType(null)"
        >
          All
        </button>
        <button
          v-for="type in types"
          :key="type"
          type="button"
          class="rounded-md border px-3 py-1 text-xs transition-colors"
          :class="selectedType === type ? 'border-(--border) bg-(--surface-muted) text-(--ink)' : 'border-(--border) text-(--muted) hover:border-blue-400 hover:text-blue-600'"
          :aria-pressed="selectedType === type"
          @click="selectType(type)"
        >
          {{ type }}
        </button>
      </div>
    </div>
    <div
      v-if="error"
      class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
    >
      {{ error }}
    </div>
    <div
      v-else-if="loading"
      class="text-sm text-(--muted)"
    >
      Loading manga...
    </div>
    <div
      v-else-if="items.length === 0"
      class="rounded-md border border-(--border) bg-(--surface) px-4 py-6 text-sm text-(--muted)"
    >
      No manga yet.
    </div>
    <Waterfall
      v-else
      class="mt-6"
      :items="waterfallItems"
      :cols="columns"
      :gap="16"
      :item-padding="{ x: 0, y: 56 }"
      :scroll-element="scrollElement"
    >
      <RouterLink
        v-for="item in items"
        :key="item.id"
        :to="`/manga/${item.id}`"
        class="flex flex-col bg-(--surface)"
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
            :alt="`${item.title} cover`"
            class="manga-image manga-image-cover absolute inset-0 z-10 h-full w-full object-cover"
            loading="lazy"
            @load="markCoverLoaded(item.id)"
            @error="markCoverLoaded(item.id)"
          >
          <div
            v-else
            class="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-(--muted)"
          >
            No cover
          </div>
        </div>
        <div class="px-3 py-2">
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
    </Waterfall>

    <PaginationBar
      v-if="items.length > 0 && totalPages > 1"
      :page="page"
      :total-pages="totalPages"
      :disabled="loading"
      @change="updatePageQuery($event)"
    />
  </section>
</template>
