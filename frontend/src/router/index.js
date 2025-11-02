import { createRouter, createWebHistory } from 'vue-router'
import PortalView from '../views/PortalView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'portal',
      component: PortalView
    },
    {
      path: '/kiosk',
      name: 'kiosk',
      component: () => import('../views/KioskView.vue')
    },
    {
      path: '/done',
      name: 'done',
      component: () => import('../views/DoneView.vue')
    },
    {
      path: '/error',
      name: 'error',
      component: () => import('../views/ErrorView.vue')
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/SignupView.vue')
    }
  ]
})

export default router