<script setup lang="ts">
import type { MangaListItem } from '../lib/api'

import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import AuxlineBtn from '../components/auxline/Btn.vue'
import PaginationBar from '../components/PaginationBar.vue'
import StarRating from '../components/StarRating.vue'
import { useMangaListQuery } from '../composables/useMangaListQuery'
import { buildImageUrl, fetchMangaPage, fetchMangaTypes } from '../lib/api'
import { resolveCategoryLabel } from '../lib/categories'

type ErrorState = { message: string } | { key: 'loadManga' }

const { t, te, locale } = useI18n()
const { page, searchInput, searchQuery, selectedType, setPage, setSearch, setType } = useMangaListQuery()
const pageSize = 12
const placeholderItems = Array.from({ length: pageSize }, (_, index) => index)
const items = ref<MangaListItem[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<ErrorState | null>(null)
const types = ref<string[]>([])
const loadedCovers = ref<Record<number, boolean>>({})
const coverImageSizes = '(min-width: 1280px) 24rem, (min-width: 1024px) 20rem, 50vw'

function updateDocumentTitle(): void {
  if (typeof document === 'undefined') {
    return
  }

  document.title = t('meta.listTitle')
}

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

function coverImageUrl(path: string, scale = 1): string {
  const width = Math.round(480 * scale)
  const height = Math.round(width * 1.5)
  return buildImageUrl(path, {
    width,
    height,
    fit: 'cover',
    format: 'auto',
    quality: 75,
  })
}

function coverImageSrcSet(path: string): string {
  return `${coverImageUrl(path)} 1x, ${coverImageUrl(path, 2)} 2x`
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    const response = await fetchMangaPage(
      page.value,
      pageSize,
      selectedType.value,
      searchQuery.value,
    )
    items.value = response.data
    total.value = response.total

    if (page.value > response.totalPages) {
      setPage(Math.max(1, response.totalPages))
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
  void loadTypes()
})

watch(locale, updateDocumentTitle, { immediate: true })

const commitSearch = useDebounceFn(() => {
  const nextSearch = normalizeSearch(searchInput.value)
  if (nextSearch === searchQuery.value && page.value === 1) {
    return
  }

  setSearch(nextSearch)
}, 300)

watch([page, selectedType, searchQuery], () => {
  void load()
}, { immediate: true })

watch(page, (value, previous) => {
  if (value === previous) {
    return
  }

  scrollToTop()
})

watch(searchInput, () => {
  if (searchInput.value === (searchQuery.value ?? '')) {
    return
  }

  commitSearch()
})

function markCoverLoaded(id: number): void {
  loadedCovers.value = { ...loadedCovers.value, [id]: true }
}

function buildMetaLine(item: MangaListItem): string | null {
  const parts: string[] = []
  if (item.type) {
    const trimmed = item.type.trim()
    if (trimmed) {
      parts.push(resolveCategoryLabel(trimmed, t, te))
    }
  }
  if (item.tags && item.tags.length > 0) {
    const tags = item.tags.map(tag => tag.trim()).filter(Boolean)
    parts.push(...tags)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function normalizeSearch(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

function scrollToTop(): void {
  if (globalThis.window === undefined) {
    return
  }

  window.scrollTo({ top: 0, behavior: 'auto' })
}
</script>

<template>
  <section style="container-type: inline-size">
    <div class="search-bar">
      <input
        v-model="searchInput"
        type="search"
        class="search-input text-sm"
        :placeholder="t('list.searchPlaceholder')"
        :aria-label="t('list.searchLabel')"
      >
    </div>
    <div class="type-filter-bar flex flex-col sm:flex-row sm:items-center">
      <div class="type-filter-row flex flex-wrap children:border-r">
        <AuxlineBtn
          type="button"
          size="sm"
          :aria-pressed="selectedType === null"
          :variant="selectedType === null ? 'contrast' : 'solid'"
          @click="setType(null)"
        >
          {{ t('common.all') }}
        </AuxlineBtn>
        <AuxlineBtn
          v-for="type in types"
          :key="type"
          type="button"
          size="sm"
          :aria-pressed="selectedType === type"
          :variant="selectedType === type ? 'contrast' : 'solid'"
          @click="setType(type)"
        >
          {{ resolveCategoryLabel(type, t, te) }}
        </AuxlineBtn>
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
      aria-hidden="true"
    >
      <div
        v-for="index in placeholderItems"
        :key="index"
        class="manga-card manga-card--placeholder flex flex-col bg-(--surface)"
      >
        <div class="relative aspect-2/3 w-full">
          <div class="skeleton absolute inset-0" />
        </div>
        <div class="manga-card-meta px-3 py-2">
          <div
            class="skeleton-lines"
            aria-hidden="true"
          >
            <div class="skeleton skeleton-line text-sm" />
            <div class="skeleton skeleton-line text-xs" />
          </div>
        </div>
      </div>
    </div>
    <div
      v-else-if="items.length === 0"
      class="bg-(--surface) px-4 py-6 text-sm text-(--muted)"
    >
      {{ t('list.empty') }}
    </div>
    <div
      v-else
      class="manga-grid"
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
            :sizes="coverImageSizes"
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
          <div class="flex items-center justify-between gap-2">
            <p class="line-clamp-1 text-sm font-semibold text-(--ink)">
              {{ item.title }}
            </p>
            <StarRating
              v-if="typeof item.rating === 'number'"
              :value="item.rating"
              size="sm"
              readonly
            />
          </div>
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
      @change="setPage($event)"
    />
    <div
      v-if="items.length > 0 && totalPages > 1"
      class="h-4"
      aria-hidden="true"
    />
  </section>
</template>
