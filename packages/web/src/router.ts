import { createRouter, createWebHistory } from 'vue-router'

import MangaListPage from './pages/MangaListPage.vue'
import MangaViewerPage from './pages/MangaViewerPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'manga-list',
      component: MangaListPage,
    },
    {
      path: '/manga/:id',
      name: 'manga-viewer',
      component: MangaViewerPage,
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }

    if (to.path !== from.path) {
      return { top: 0 }
    }
  },
})

export default router
