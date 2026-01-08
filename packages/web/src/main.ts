import { createApp } from 'vue'

import App from './App.vue'
import { i18n } from './i18n'
import router from './router'
import './style.css'
import 'uno.css'

function applyPlatformClass(): void {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return
  }

  const userAgent = navigator.userAgent
  const isWindows = userAgent.includes('Windows')
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)

  if (isWindows && !isMobile) {
    document.documentElement.classList.add('platform-windows')
  }
}

applyPlatformClass()

const app = createApp(App)

app.use(i18n)
app.use(router)
app.mount('#app')
