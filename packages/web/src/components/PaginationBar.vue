<script setup lang="ts">
import { computed } from 'vue'

interface PaginationProps {
  page: number
  totalPages: number
  disabled?: boolean
  siblingCount?: number
}

interface PaginationEmits {
  (event: 'change', page: number): void
}

type PaginationItem = number | 'ellipsis'

const props = defineProps<PaginationProps>()
const emit = defineEmits<PaginationEmits>()

const total = computed(() => Math.max(1, props.totalPages))
const current = computed(() => Math.min(Math.max(props.page, 1), total.value))
const siblings = computed(() => Math.max(0, props.siblingCount ?? 1))
const isDisabled = computed(() => props.disabled ?? false)

const items = computed(() => {
  const totalPages = total.value
  const currentPage = current.value
  const siblingCount = siblings.value
  const maxVisible = siblingCount * 2 + 5

  if (totalPages <= maxVisible) {
    return range(1, totalPages)
  }

  const leftSibling = Math.max(currentPage - siblingCount, 2)
  const rightSibling = Math.min(currentPage + siblingCount, totalPages - 1)
  const showLeftDots = leftSibling > 2
  const showRightDots = rightSibling < totalPages - 1

  const list: PaginationItem[] = [1]

  if (showLeftDots) {
    list.push('ellipsis')
  }
  else {
    list.push(...range(2, leftSibling - 1))
  }

  list.push(...range(leftSibling, rightSibling))

  if (showRightDots) {
    list.push('ellipsis')
  }
  else {
    list.push(...range(rightSibling + 1, totalPages - 1))
  }

  list.push(totalPages)
  return list
})

const previousDisabled = computed(() => isDisabled.value || current.value <= 1)
const nextDisabled = computed(() => isDisabled.value || current.value >= total.value)

function range(start: number, end: number): number[] {
  if (start > end) {
    return []
  }

  const values: number[] = []
  for (let index = start; index <= end; index += 1) {
    values.push(index)
  }
  return values
}

function goTo(target: number): void {
  if (isDisabled.value) {
    return
  }

  const clamped = Math.min(Math.max(target, 1), total.value)
  if (clamped === current.value) {
    return
  }

  emit('change', clamped)
}
</script>

<template>
  <nav
    class="mt-8 flex flex-wrap items-center justify-center gap-2"
    aria-label="Pagination"
  >
    <button
      type="button"
      class="pagination-btn"
      :disabled="previousDisabled"
      @click="goTo(current - 1)"
    >
      Prev
    </button>

    <div class="flex items-center gap-1">
      <template
        v-for="(item, index) in items"
        :key="`${item}-${index}`"
      >
        <span
          v-if="item === 'ellipsis'"
          class="pagination-ellipsis"
        >
          ...
        </span>
        <button
          v-else
          type="button"
          class="pagination-btn"
          :class="item === current ? 'pagination-btn--active' : ''"
          :aria-current="item === current ? 'page' : undefined"
          :disabled="isDisabled"
          @click="goTo(item)"
        >
          {{ item }}
        </button>
      </template>
    </div>

    <button
      type="button"
      class="pagination-btn"
      :disabled="nextDisabled"
      @click="goTo(current + 1)"
    >
      Next
    </button>
  </nav>
</template>

<style scoped>
.pagination-btn {
  border: 0;
  border-radius: 0.375rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  background-color: var(--surface-muted);
  color: var(--muted);
  transition: background-color 150ms ease, color 150ms ease;
}

.pagination-btn:hover {
  background-color: var(--surface);
  color: var(--ink);
}

.pagination-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.pagination-btn--active {
  background-color: var(--surface);
  color: var(--ink);
}

.pagination-ellipsis {
  padding: 0 0.5rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--muted);
}
</style>
