<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()
const isViewer = computed(() => route.name === 'manga-viewer')
const mainClass = computed(() => (isViewer.value
  ? 'w-full px-0 py-8'
  : 'mx-auto max-w-6xl px-4 py-8'))
</script>

<template>
  <div class="min-h-screen">
    <header class="app-header">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <RouterLink
          class="text-lg font-semibold tracking-tight"
          to="/"
        >
          Yomi Manga
        </RouterLink>
      </div>
    </header>
    <main :class="mainClass">
      <RouterView />
    </main>
  </div>
</template>
