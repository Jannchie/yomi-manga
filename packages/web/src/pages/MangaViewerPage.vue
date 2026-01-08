<script setup lang="ts">
import type { MangaPage } from '../lib/api'

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Waterfall } from 'vue-wf'

import { buildImageUrl, fetchMangaMeta, fetchMangaPages } from '../lib/api'

const route = useRoute()
const router = useRouter()
const pages = ref<MangaPage[]>([])
const mangaTitle = ref<string | null>(null)
const mangaTags = ref<string[] | null>(null)
const mangaType = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const scrollElement = ref<Window | null>(null)
const currentOffset = ref<number | null>(null)
const loadedPages = ref<Record<number, boolean>>({})

const HASH_PREFIX = '#y='
let rafId: number | null = null

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
      parts.push(trimmed)
    }
  }
  if (mangaTags.value && mangaTags.value.length > 0) {
    const tags = mangaTags.value.map(tag => tag.trim()).filter(Boolean)
    parts.push(...tags)
  }
  return parts.length > 0 ? parts.join(' · ') : null
})

async function load(): Promise<void> {
  const mangaId = Number(route.params.id)
  if (!Number.isInteger(mangaId) || mangaId <= 0) {
    error.value = 'Invalid manga id'
    pages.value = []
    mangaTitle.value = null
    mangaType.value = null
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
    error.value = error_ instanceof Error ? error_.message : 'Failed to load manga'
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

onMounted(() => {
  scrollElement.value = globalThis.window
  window.addEventListener('scroll', scheduleAnchorUpdate, { passive: true })
  window.addEventListener('resize', scheduleAnchorUpdate)
  void load()
})

onBeforeUnmount(() => {
  if (rafId !== null) {
    globalThis.cancelAnimationFrame(rafId)
    rafId = null
  }

  window.removeEventListener('scroll', scheduleAnchorUpdate)
  window.removeEventListener('resize', scheduleAnchorUpdate)
})

watch(
  () => route.params.id,
  () => {
    void load()
  },
)

function scheduleAnchorUpdate(): void {
  if (rafId !== null) {
    return
  }

  rafId = globalThis.requestAnimationFrame(() => {
    rafId = null
    updateAnchorFromScroll()
  })
}

function updateAnchorFromScroll(): void {
  if (!scrollElement.value) {
    return
  }

  const offset = Math.max(0, Math.round(window.scrollY))
  if (currentOffset.value !== offset) {
    currentOffset.value = offset
    updateHash(offset)
  }
}

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

function pageAspectRatio(page: MangaPage): string {
  return String(getPageRatio(page))
}

function markPageLoaded(id: number): void {
  loadedPages.value = { ...loadedPages.value, [id]: true }
}
</script>

<template>
  <section>
    <div class="mx-auto max-w-6xl px-4">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <RouterLink
            class="text-xs uppercase tracking-[0.2em] text-(--muted)"
            to="/"
          >
            Back to list
          </RouterLink>
          <h1 class="text-2xl font-semibold text-(--ink)">
            {{ mangaTitle ?? 'Manga' }}
          </h1>
          <p class="text-sm text-(--muted)">
            {{ pages.length }} pages
          </p>
        <p
          v-if="mangaMetaLine"
          class="mt-1 line-clamp-1 text-xs text-(--muted)"
        >
          {{ mangaMetaLine }}
        </p>
        </div>
      </div>

      <div
        v-if="error"
        class="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
      >
        {{ error }}
      </div>
      <div
        v-else-if="loading"
        class="mt-6 text-sm text-(--muted)"
      >
        Loading pages...
      </div>
      <div
        v-else-if="pages.length === 0"
        class="mt-6 rounded-md border border-(--border) bg-(--surface) px-4 py-6 text-sm text-(--muted)"
      >
        No pages found.
      </div>
    </div>

    <Waterfall
      v-if="!error && !loading && pages.length > 0"
      class="mx-auto mt-6 w-full max-w-6xl"
      :items="waterfallItems"
      :cols="1"
      :gap="0"
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
            :alt="`Page ${index + 1}`"
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
