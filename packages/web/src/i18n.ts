import { createI18n } from 'vue-i18n'

import en from './locales/en'
import ja from './locales/ja'
import zh from './locales/zh'

export const supportedLocales = ['en', 'zh', 'ja'] as const
export type Locale = (typeof supportedLocales)[number]
export const localeStorageKey = 'yomi-locale'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && supportedLocales.includes(value as Locale)
}

type MessageSchema = typeof en

const messages: Record<Locale, MessageSchema> = {
  en,
  zh,
  ja,
}

function readStoredLocale(): Locale | null {
  if (typeof localStorage === 'undefined') {
    return null
  }

  try {
    const stored = localStorage.getItem(localeStorageKey)
    return isLocale(stored) ? stored : null
  }
  catch {
    return null
  }
}

function resolveBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return 'en'
  }

  const language = navigator.language.toLowerCase()
  if (language.startsWith('zh')) {
    return 'zh'
  }
  if (language.startsWith('ja')) {
    return 'ja'
  }

  return 'en'
}

const initialLocale = readStoredLocale() ?? resolveBrowserLocale()

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages,
})
