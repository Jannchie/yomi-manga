<script setup lang="ts">
import type { MangaPage } from '../lib/api'

import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Waterfall } from 'vue-wf'

import { buildImageUrl, fetchMangaMeta, fetchMangaPages } from '../lib/api'

type ErrorState = { message: string } | { key: 'invalidMangaId' | 'loadManga' }

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()
const pages = ref<MangaPage[]>([])
const mangaTitle = ref<string | null>(null)
const mangaTags = ref<string[] | null>(null)
const mangaType = ref<string | null>(null)
const loading = ref(false)
const error = ref<ErrorState | null>(null)
const scrollElement = ref<Window | null>(null)
const currentOffset = ref<number | null>(null)
const loadedPages = ref<Record<number, boolean>>({})

const HASH_PREFIX = '#y='
let isActive = true

const waterfallItems = computed(() =>
  pages.value.map((page) => {
    const ratio = getPageRatio(page)
    return {
      width: ratio,
      height: 1,
    }
  }),
)
const mangaMetaLine = computed(() => {
  const parts: string[] = []
  if (mangaType.value) {
    const trimmed = mangaType.value.trim()
    if (trimmed) {
      parts.push(typeLabel(trimmed))
    }
  }
  if (mangaTags.value && mangaTags.value.length > 0) {
    const tags = mangaTags.value.map(tag => tag.trim()).filter(Boolean)
    parts.push(...tags)
  }
  return parts.length > 0 ? parts.join(' · ') : null
})
const errorMessage = computed(() => {
  if (!error.value) {
    return null
  }
  if ('message' in error.value) {
    return error.value.message
  }
  if (error.value.key === 'invalidMangaId') {
    return t('errors.invalidMangaId')
  }
  if (error.value.key === 'loadManga') {
    return t('errors.loadManga')
  }
  return null
})
const pageCountLabel = computed(() => {
  const count = pages.value.length
  if (count === 1) {
    return t('viewer.pageCountSingle', { count })
  }
  return t('viewer.pageCount', { count })
})

async function load(): Promise<void> {
  const mangaId = Number(route.params.id)
  if (!Number.isInteger(mangaId) || mangaId <= 0) {
    error.value = { key: 'invalidMangaId' }
    pages.value = []
    mangaTitle.value = null
    mangaTags.value = null
    mangaType.value = null
    loading.value = false
    return
  }

  loading.value = true
  error.value = null
  mangaTitle.value = null

  try {
    const [meta, pageData] = await Promise.all([
      fetchMangaMeta(mangaId),
      fetchMangaPages(mangaId),
    ])
    mangaTitle.value = meta.title
    mangaTags.value = meta.tags
    mangaType.value = meta.type
    loadedPages.value = {}
    pages.value = pageData
  }
  catch (error_) {
    error.value = error_ instanceof Error ? { message: error_.message } : { key: 'loadManga' }
    mangaTitle.value = null
    mangaTags.value = null
    mangaType.value = null
  }
  finally {
    loading.value = false
  }

  await nextTick()
  await nextFrame()
  await scrollToHash(route.hash)
}

const scheduleAnchorUpdate = useDebounceFn(() => {
  if (!isActive || !scrollElement.value) {
    return
  }

  const offset = Math.max(0, Math.round(window.scrollY))
  if (currentOffset.value !== offset) {
    currentOffset.value = offset
    updateHash(offset)
  }
}, 150)

onMounted(() => {
  scrollElement.value = globalThis.window
  window.addEventListener('scroll', scheduleAnchorUpdate, { passive: true })
  window.addEventListener('resize', scheduleAnchorUpdate)
  void load()
})

onBeforeUnmount(() => {
  isActive = false
  window.removeEventListener('scroll', scheduleAnchorUpdate)
  window.removeEventListener('resize', scheduleAnchorUpdate)
})

watch(
  () => route.params.id,
  () => {
    void load()
  },
)

function updateHash(offset: number): void {
  const nextHash = `${HASH_PREFIX}${offset}`
  if (route.hash === nextHash) {
    return
  }

  void router.replace({
    path: route.path,
    query: route.query,
    hash: nextHash,
  })
}

function parseHashOffset(hash: string): number | null {
  if (!hash.startsWith(HASH_PREFIX)) {
    return null
  }

  const value = Number(hash.slice(HASH_PREFIX.length))
  if (!Number.isFinite(value) || value < 0) {
    return null
  }

  return Math.round(value)
}

async function scrollToHash(hash: string): Promise<void> {
  const offset = parseHashOffset(hash)
  if (offset === null) {
    return
  }

  window.scrollTo({ top: offset, behavior: 'auto' })
  currentOffset.value = offset
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.requestAnimationFrame(() => resolve())
  })
}

function getPageRatio(page: MangaPage): number {
  if (typeof page.width === 'number' && typeof page.height === 'number' && page.height > 0) {
    return page.width / page.height
  }

  if (typeof page.ratio === 'number' && page.ratio > 0) {
    return page.ratio
  }

  return 2 / 3
}

function typeLabel(type: string): string {
  const key = `categories.${type}`
  return te(key) ? t(key) : type
}

function pageAspectRatio(page: MangaPage): string {
  return String(getPageRatio(page))
}

function markPageLoaded(id: number): void {
  loadedPages.value = { ...loadedPages.value, [id]: true }
}
</script>

<template>
  <section>
    <div class="mx-auto max-w-6xl">
      <div class="viewer-header flex flex-col sm:flex-row sm:items-end sm:justify-between pb-2">
        <div class="viewer-meta">
          <RouterLink
            class="text-xs uppercase tracking-[0.2em] text-(--muted)"
            to="/"
          >
            {{ t('viewer.backToList') }}
          </RouterLink>
          <h1 class="text-2xl font-semibold text-(--ink)">
            <span
              v-if="loading"
              class="skeleton skeleton-line"
              aria-hidden="true"
            />
            <span v-else>
              {{ mangaTitle ?? t('common.manga') }}
            </span>
          </h1>
          <p
            v-if="loading"
            class="text-sm text-(--muted)"
          >
            <span
              class="skeleton skeleton-line"
              aria-hidden="true"
            />
          </p>
          <p
            v-else
            class="text-sm text-(--muted)"
          >
            {{ pageCountLabel }}
          </p>
          <p
            v-if="loading"
            class="mt-1 text-xs text-(--muted)"
          >
            <span
              class="skeleton skeleton-line"
              aria-hidden="true"
            />
          </p>
          <p
            v-else-if="mangaMetaLine"
            class="mt-1 line-clamp-1 text-xs text-(--muted)"
          >
            {{ mangaMetaLine }}
          </p>
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
      >
        {{ errorMessage }}
      </div>
      <div
        v-else-if="loading"
        class="mt-6"
        aria-hidden="true"
      >
        <div class="skeleton-lines">
          <div class="skeleton skeleton-line text-sm" />
          <div class="skeleton skeleton-line text-sm" />
        </div>
      </div>
      <div
        v-else-if="pages.length === 0"
        class="mt-6 rounded-md border border-(--border) bg-(--surface) px-4 py-6 text-sm text-(--muted)"
      >
        {{ t('viewer.empty') }}
      </div>
    </div>

    <Waterfall
      v-if="!errorMessage && !loading && pages.length > 0"
      class="mx-auto mt-4 w-full max-w-6xl"
      :items="waterfallItems"
      :cols="1"
      :gap="0"
      :range-expand="2000"
      :item-padding="{ x: 0, y: 0 }"
      :scroll-element="scrollElement"
    >
      <div
        v-for="(page, index) in pages"
        :key="page.id"
      >
        <div
          class="relative w-full"
          :style="{ aspectRatio: pageAspectRatio(page) }"
        >
          <div
            v-if="!loadedPages[page.id]"
            class="manga-placeholder absolute inset-0"
          />
          <img
            :src="buildImageUrl(page.path)"
            :alt="t('viewer.pageAlt', { index: index + 1 })"
            class="manga-image relative z-10 h-full w-full object-contain"
            loading="lazy"
            decoding="async"
            @load="markPageLoaded(page.id)"
            @error="markPageLoaded(page.id)"
          >
        </div>
      </div>
    </Waterfall>
  </section>
</template>
