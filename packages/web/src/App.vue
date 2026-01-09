<script setup lang="ts">
import type { Locale } from './i18n'

import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView } from 'vue-router'

import { isLocale, localeStorageKey } from './i18n'

const { locale, t } = useI18n()
const mainClass = 'mx-auto max-w-6xl w-full'

const localeOptions = computed(() => [
  { value: 'en', label: t('locale.english') },
  { value: 'zh', label: t('locale.chinese') },
  { value: 'ja', label: t('locale.japanese') },
])

const localeValue = computed<Locale>({
  get: () => (isLocale(locale.value) ? locale.value : 'en'),
  set: (value) => {
    locale.value = value
  },
})

watch(
  locale,
  (value) => {
    if (!isLocale(value)) {
      return
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = value
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(localeStorageKey, value)
      }
      catch {
        // Ignore storage failures (e.g. private mode restrictions).
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="app-header">
      <div class="content-frame mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <RouterLink
          class="text-lg font-semibold tracking-tight"
          to="/"
        >
          読み
        </RouterLink>
        <div class="flex items-center gap-3">
          <span class="text-xs uppercase tracking-[0.2em] text-(--muted)">
            {{ t('locale.label') }}
          </span>
          <select
            v-model="localeValue"
            class="locale-select px-1 py-1 text-xs"
            :aria-label="t('locale.label')"
          >
            <option
              v-for="option in localeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>
    </header>
    <main
      class="content-frame flex-1"
      :class="[mainClass]"
    >
      <RouterView />
    </main>
  </div>
</template>
