import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to, from, saved) => saved ?? { top: 0 },
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true, hideNav: true } },
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/items/new', name: 'item-new', component: () => import('@/views/PostItemView.vue'), meta: { hideNav: true } },
    { path: '/items/:id', name: 'item', component: () => import('@/views/ItemDetailView.vue'), props: true, meta: { hideNav: true } },
    { path: '/chats', name: 'chats', component: () => import('@/views/ChatListView.vue') },
    { path: '/chats/:itemId', name: 'chat', component: () => import('@/views/ChatRoomView.vue'), props: true, meta: { hideNav: true } },
    { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.name === 'login' && auth.isAuthenticated) return { name: 'home' }
})

export default router
