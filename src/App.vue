<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import ToastHost from '@/components/ToastHost.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useOrdersStore } from '@/stores/orders'

const route = useRoute()
const auth = useAuthStore()
const chat = useChatStore()
const orders = useOrdersStore()

watch(
  () => auth.isAuthenticated,
  (loggedIn) => {
    if (!loggedIn) {
      chat.$reset()
      orders.$reset()
      return
    }
    chat.init()
    orders.load().catch(() => {})
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative mx-auto min-h-dvh max-w-md bg-page shadow-lg" :class="!route.meta.hideNav && 'pb-32'">
    <RouterView v-slot="{ Component }">
      <KeepAlive include="HomeView">
        <component :is="Component" :key="route.name === 'home' ? 'home' : route.fullPath" />
      </KeepAlive>
    </RouterView>
    <BottomNav v-if="!route.meta.hideNav" />
    <ToastHost />
  </div>
</template>
