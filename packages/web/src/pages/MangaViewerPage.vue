<script setup lang="ts">
import type { MangaPage } from '../lib/api'
import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Waterfall } from 'vue-wf'

import AuxlineBtn from '../components/auxline/Btn.vue'
import StarRating from '../components/StarRating.vue'
import { buildImageUrl, fetchMangaMeta, fetchMangaPages, updateMangaRating } from '../lib/api'

type ErrorState = { message: string } | { key: 'invalidMangaId' | 'loadManga' }

const route = useRoute()
const router = useRouter()
const { t, te, locale } = useI18n()
const pages = ref<MangaPage[]>([])
const mangaTitle = ref<string | null>(null)
const mangaTags = ref<string[] | null>(null)
const mangaType = ref<string | null>(null)
const mangaRating = ref<number | null>(null)
const loading = ref(false)
const error = ref<ErrorState | null>(null)
const scrollElement = ref<Window | null>(null)
const currentOffset = ref<number | null>(null)
const loadedPages = ref<Record<number, boolean>>({})
const ratingUpdating = ref(false)
const ratingError = ref<string | null>(null)
const tagButtonClass = 'type-filter-btn px-3 py-1.5 text-xs !h-auto !leading-4 !normal-case !tracking-normal !font-sans !text-(--muted) hover:!bg-(--muted) hover:!text-(--surface)'

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
const mangaTypeLabel = computed(() => {
  if (!mangaType.value) {
    return null
  }

  const trimmed = mangaType.value.trim()
  return trimmed ? typeLabel(trimmed) : null
})
const mangaTagsList = computed(() => {
  if (!mangaTags.value || mangaTags.value.length === 0) {
    return []
  }

  return mangaTags.value.map(tag => tag.trim()).filter(Boolean)
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
const ratingLabel = computed(() => {
  if (mangaRating.value === null) {
    return t('rating.unrated')
  }
  return t('rating.valueShort', { value: mangaRating.value })
})
const ratingDisabled = computed(
  () => loading.value || ratingUpdating.value || error.value !== null,
)

function updateDocumentTitle(): void {
  if (typeof document === 'undefined') {
    return
  }

  const resolvedTitle = mangaTitle.value?.trim()
  if (resolvedTitle) {
    document.title = t('meta.viewerTitle', { title: resolvedTitle })
    return
  }

  document.title = t('meta.viewerTitleFallback')
}

async function load(): Promise<void> {
  const mangaId = Number(route.params.id)
  if (!Number.isInteger(mangaId) || mangaId <= 0) {
    error.value = { key: 'invalidMangaId' }
    pages.value = []
    mangaTitle.value = null
    mangaTags.value = null
    mangaType.value = null
    mangaRating.value = null
    ratingError.value = null
    ratingUpdating.value = false
    loading.value = false
    return
  }

  loading.value = true
  error.value = null
  mangaTitle.value = null
  ratingError.value = null
  ratingUpdating.value = false

  try {
    const [meta, pageData] = await Promise.all([
      fetchMangaMeta(mangaId),
      fetchMangaPages(mangaId),
    ])
    mangaTitle.value = meta.title

    // 合并现有标签和从标题中提取的标签，去重
    const existingTags = meta.tags || []
    const extractedTags = extractBracketTags(meta.title)
    mangaTags.value = [...new Set([...existingTags, ...extractedTags])]

    mangaType.value = meta.type
    mangaRating.value = typeof meta.rating === 'number' ? meta.rating : null
    loadedPages.value = {}
    pages.value = pageData
  }
  catch (error_) {
    error.value = error_ instanceof Error ? { message: error_.message } : { key: 'loadManga' }
    mangaTitle.value = null
    mangaTags.value = null
    mangaType.value = null
    mangaRating.value = null
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

watch([locale, mangaTitle], updateDocumentTitle, { immediate: true })

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

function extractBracketTags(title: string): string[] {
  const matches = title.match(/\[([^\]]+)\]/g)
  if (!matches) {
    return []
  }

  const tags: string[] = []

  for (const match of matches) {
    const content = match.slice(1, -1).trim()

    if (!content) {
      continue
    }

    // 解析嵌套括号和斜杠分隔的内容
    const parsedTags = parseBracketContent(content)
    tags.push(...parsedTags)
  }

  return [...new Set(tags.filter(tag => tag.length > 0))]
}

function parseBracketContent(content: string): string[] {
  const tags: string[] = []

  // 先按斜杠分割（支持半角和全角斜杠）
  const slashParts = content.split(/[/／]/).map(part => part.trim()).filter(Boolean)

  for (const part of slashParts) {
    // 检查是否有嵌套括号
    const parenMatch = part.match(/\(([^)]+)\)/)

    if (parenMatch) {
      // 提取括号外的内容
      const outerContent = part.replace(/\([^)]+\)/, '').trim()

      if (outerContent) {
        tags.push(outerContent)
      }

      // 提取括号内的内容
      const innerContent = parenMatch[1]?.trim()

      if (innerContent) {
        tags.push(innerContent)
      }
    }
    else {
      // 没有嵌套括号，直接添加
      tags.push(part)
    }
  }

  return tags
}

function pageAspectRatio(page: MangaPage): string {
  return String(getPageRatio(page))
}

function markPageLoaded(id: number): void {
  loadedPages.value = { ...loadedPages.value, [id]: true }
}

function navigateToTag(tag: string): void {
  void router.push({
    path: '/',
    query: {
      q: tag,
    },
  })
}

async function updateRating(nextRating: number | null): Promise<void> {
  if (ratingUpdating.value || nextRating === mangaRating.value) {
    return
  }

  const mangaId = Number(route.params.id)
  if (!Number.isInteger(mangaId) || mangaId <= 0) {
    return
  }

  const previousRating = mangaRating.value
  mangaRating.value = nextRating
  ratingUpdating.value = true
  ratingError.value = null

  try {
    const response = await updateMangaRating(mangaId, nextRating)
    mangaRating.value = response.rating
  }
  catch {
    mangaRating.value = previousRating
    ratingError.value = t('rating.updateFailed')
  }
  finally {
    ratingUpdating.value = false
  }
}
</script>

<template>
  <section>
    <div>
      <div class="viewer-header flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-(--border)">
        <div class="w-full children:pl-2">
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
          <div
            v-if="!errorMessage"
            class="mt-2 flex flex-wrap items-center gap-2 text-xs text-(--muted)"
          >
            <span>{{ t('rating.label') }}</span>
            <div
              v-if="loading"
              class="skeleton skeleton-line w-24"
              aria-hidden="true"
            />
            <template v-else>
              <StarRating
                :value="mangaRating"
                :disabled="ratingDisabled"
                @change="updateRating"
              />
              <span>{{ ratingLabel }}</span>
            </template>
          </div>
          <p
            v-if="!errorMessage && ratingError"
            class="mt-1 text-xs text-red-600"
          >
            {{ ratingError }}
          </p>
          <template v-if="loading">
            <div class="text-xs text-(--muted) flex flex-col">
              <div class="skeleton-lines my-1">
                <span
                  class="skeleton skeleton-line"
                  aria-hidden="true"
                />
                <span
                  class="skeleton skeleton-line"
                  aria-hidden="true"
                />
              </div>
            </div>
          </template>
          <template v-else>
            <div
              v-if="mangaTypeLabel"
              class=" text-xs text-(--muted) flex flex-col border-b border-[--border]"
            >
              <p class="my-1">
                {{ t('common.category') }}: {{ mangaTypeLabel }}
              </p>
            </div>
            <div
              v-if="mangaTagsList.length > 0"
              class="text-xs text-(--muted) flex flex-col"
            >
              <div class="flex flex-wrap items-center">
                <div class="type-filter-row type-filter-row--bordered flex flex-wrap">
                  <AuxlineBtn
                    v-for="tag in mangaTagsList"
                    :key="tag"
                    type="button"
                    size="sm"
                    :class="tagButtonClass"
                    @click="navigateToTag(tag)"
                  >
                    {{ tag }}
                  </AuxlineBtn>
                </div>
              </div>
            </div>
          </template>
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
