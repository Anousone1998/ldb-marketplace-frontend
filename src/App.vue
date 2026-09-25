<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import ToastHost from '@/components/ToastHost.vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useOrdersStore } from '@/stores/orders'
import { toast } from '@/composables/useToast'
import { reloadApp, updateAvailable } from '@/composables/useAppUpdate'

const route = useRoute()
const auth = useAuthStore()
const chat = useChatStore()
const orders = useOrdersStore()

// Push (FCM). The SDK is loaded on demand, so logged-out users never download it.
// LoginView asks for permission right after login (it needs the tap); here we only resume.
const loadPush = () => import('@/services/firebase').then((m) => m.usePush())
let stopForeground = null

async function startPush() {
  const push = await loadPush()
  if (!push.configured) return
  // Subscribe first: on a first login the permission prompt (LoginView) may still be open,
  // and the listener simply stays idle until a token exists.
  stopForeground ??= await push.onForegroundMessage(({ notification, data }) => {
    const title = notification?.title ?? data?.title
    const body = notification?.body ?? data?.body
    toast(`🔔 ${[title, body].filter(Boolean).join(': ')}`, 'info', 4000)
  })
  await push.resume()
  // TODO: send push.token.value to the backend once it has a device-token endpoint
}

async function stopPush() {
  stopForeground?.()
  stopForeground = null
  await (await loadPush()).disable()
}

watch(
  () => auth.isAuthenticated,
  (loggedIn) => {
    if (!loggedIn) {
      chat.$reset()
      orders.$reset()
      if (stopForeground) stopPush().catch(() => {})
      return
    }
    chat.init()
    orders.load().catch(() => {})
    startPush().catch((e) => console.warn('[push]', e))
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
    <button
      v-if="updateAvailable"
      type="button"
      class="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-neutral-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg"
      @click="reloadApp()"
    >
      ມີເວີຊັນໃໝ່ <span class="font-semibold text-sky-300">ແຕະເພື່ອໂຫຼດໃໝ່</span>
    </button>
    <ToastHost />
  </div>
</template>
