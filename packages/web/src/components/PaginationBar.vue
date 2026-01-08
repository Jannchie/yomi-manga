<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
const { t } = useI18n()

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
    class="pagination-bar flex flex-wrap items-center justify-center"
    :aria-label="t('pagination.label')"
  >
    <button
      type="button"
      class="pagination-btn"
      :disabled="previousDisabled"
      @click="goTo(current - 1)"
    >
      {{ t('pagination.prev') }}
    </button>

    <div class="flex items-center">
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
      {{ t('pagination.next') }}
    </button>
  </nav>
</template>

<style scoped>
.pagination-bar {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  margin: 0;
  padding: 0;
}

.pagination-btn {
  border: 0;
  border-right: 1px solid var(--border);
  border-radius: 0;
  padding: 0.35rem 0.85rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  background-color: transparent;
  color: var(--muted);
  transition: background-color 150ms ease, color 150ms ease;
}

.pagination-bar > .pagination-btn:first-child {
  border-left: 1px solid var(--border);
}

.pagination-btn:not(:disabled):not(.pagination-btn--active):hover {
  background-color: var(--muted);
  color: var(--surface);
}

.pagination-btn:not(:disabled):active {
  background-color: var(--ink);
  color: var(--surface);
}

.pagination-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.pagination-btn--active {
  background-color: var(--ink);
  color: var(--surface);
}

.pagination-ellipsis {
  display: flex;
  align-items: center;
  border-right: 1px solid var(--border);
  padding: 0.35rem 0.85rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--muted);
}
</style>
