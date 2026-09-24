<script setup>
import { useRoute } from 'vue-router'
import { Home, MessageCircle, Plus, User } from 'lucide-vue-next'
import CountBadge from './CountBadge.vue'
import { useChatStore } from '@/stores/chat'

const route = useRoute()
const chat = useChatStore()

const tabs = [
  { to: '/', label: 'ໜ້າຫຼັກ', icon: Home, match: (p) => p === '/' },
  { to: '/chats', label: 'ຂໍ້ຄວາມ', icon: MessageCircle, match: (p) => p.startsWith('/chats'), badge: true },
  { to: '/profile', label: 'ໂປຣໄຟລ໌', icon: User, match: (p) => p.startsWith('/profile') },
]
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md justify-end px-4">
    <RouterLink
      to="/items/new"
      class="pointer-events-auto flex h-12 items-center gap-1.5 rounded-full bg-linear-to-br from-brand to-coral pr-5 pl-4 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition active:scale-95"
    >
      <Plus class="size-5" :stroke-width="2.75" />
      ລົງຂາຍ
    </RouterLink>
  </div>

  <nav class="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
    <ul class="grid h-14 grid-cols-3">
      <li v-for="tab in tabs" :key="tab.to">
        <RouterLink :to="tab.to" class="flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium">
          <span class="relative" :class="tab.match(route.path) ? 'text-brand' : 'text-neutral-500'">
            <component :is="tab.icon" class="size-6" :stroke-width="tab.match(route.path) ? 2.4 : 1.8" />
            <CountBadge v-if="tab.badge" :count="chat.totalUnread" />
          </span>
          <span :class="tab.match(route.path) ? 'text-brand' : 'text-neutral-500'">{{ tab.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
