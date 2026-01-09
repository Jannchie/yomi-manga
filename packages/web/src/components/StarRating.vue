<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface StarRatingProps {
  value: number | null
  max?: number
  readonly?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  ariaLabel?: string
}

interface StarRatingEmits {
  (event: 'change', value: number | null): void
  (event: 'update:value', value: number | null): void
}

const props = withDefaults(defineProps<StarRatingProps>(), {
  max: 5,
  readonly: false,
  disabled: false,
  size: 'md',
})
const emit = defineEmits<StarRatingEmits>()
const { t } = useI18n()

const hoverValue = ref<number | null>(null)
const safeMax = computed(() => Math.max(1, Math.round(props.max)))
const normalizedValue = computed(() => {
  if (typeof props.value !== 'number' || !Number.isFinite(props.value)) {
    return null
  }

  const rounded = Math.round(props.value)
  if (rounded < 1 || rounded > safeMax.value) {
    return null
  }

  return rounded
})
const isInteractive = computed(() => !props.readonly && !props.disabled)
const stars = computed(() => Array.from({ length: safeMax.value }, (_, index) => index + 1))
const sizeClass = computed(() => (props.size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'))
const previewValue = computed(() => {
  if (!isInteractive.value || hoverValue.value === null) {
    return normalizedValue.value
  }

  return hoverValue.value
})
const groupLabel = computed(() => {
  if (props.ariaLabel) {
    return props.ariaLabel
  }

  if (normalizedValue.value === null) {
    return t('rating.unrated')
  }

  return t('rating.value', { value: normalizedValue.value })
})

function isFilled(star: number): boolean {
  return previewValue.value !== null && star <= previewValue.value
}

function starIconClass(star: number): string {
  if (isFilled(star)) {
    return 'fill-current text-(--ink)'
  }

  return 'fill-transparent text-(--muted)'
}

function setHover(star: number): void {
  if (!isInteractive.value) {
    return
  }

  hoverValue.value = star
}

function clearHover(): void {
  if (hoverValue.value === null) {
    return
  }

  hoverValue.value = null
}

function select(star: number): void {
  if (!isInteractive.value) {
    return
  }

  const nextValue = normalizedValue.value === star ? null : star
  emit('update:value', nextValue)
  emit('change', nextValue)
}
</script>

<template>
  <div
    class="inline-flex items-center gap-1"
    :class="isInteractive ? '' : 'opacity-70'"
    role="group"
    :aria-label="groupLabel"
    @mouseleave="clearHover"
  >
    <template v-if="isInteractive">
      <button
        v-for="star in stars"
        :key="star"
        type="button"
        class="inline-flex items-center justify-center rounded-sm p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--ink)"
        :title="t('rating.set', { value: star })"
        :aria-label="t('rating.set', { value: star })"
        @mouseenter="setHover(star)"
        @focus="setHover(star)"
        @blur="clearHover"
        @click="select(star)"
      >
        <svg
          :class="[sizeClass, starIconClass(star)]"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path
            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </template>
    <template v-else>
      <span
        v-for="star in stars"
        :key="star"
        class="inline-flex items-center justify-center p-0.5"
      >
        <svg
          :class="[sizeClass, starIconClass(star)]"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path
            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </template>
  </div>
</template>
