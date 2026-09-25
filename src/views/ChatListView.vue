<script setup>
import { onActivated, onMounted } from 'vue'
import { MessageCircleDashed } from 'lucide-vue-next'
import SellerAvatar from '@/components/SellerAvatar.vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { isImageMessage, timeAgo } from '@/utils/format'

const chat = useChatStore()
const auth = useAuthStore()

// Shown until the peer's name is loaded (never the employee ID)
const roleOf = (conv) => (conv.sellerId === auth.user?.userId ? 'ຜູ້ຊື້' : 'ຜູ້ຂາຍ')

onMounted(() => chat.initialized && chat.refreshInbox())
onActivated(() => chat.refreshInbox())

function preview(conv) {
  if (conv.typing) return 'ກຳລັງພິມ...'
  if (!conv.lastMessageText) return 'ເລີ່ມການສົນທະນາ'
  const prefix = conv.lastSenderId === auth.user?.userId ? 'ທ່ານ: ' : ''
  return prefix + (isImageMessage(conv.lastMessageText) ? '📷 ຮູບພາບ' : conv.lastMessageText)
}
</script>

<template>
  <div>
    <header class="sticky top-0 z-30 bg-linear-to-r from-brand to-accent px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-3 text-white">
      <h1 class="text-lg font-bold">ຂໍ້ຄວາມ</h1>
      <p class="text-xs opacity-90">
        <span class="mr-1 inline-block size-2 rounded-full" :class="chat.connected ? 'bg-emerald-300' : 'bg-white/50'" />
        {{ chat.connected ? 'ເຊື່ອມຕໍ່ແບບ Real-time' : 'ບໍ່ໄດ້ເຊື່ອມຕໍ່ Real-time' }}
      </p>
    </header>

    <div v-if="!chat.list.length" class="flex flex-col items-center py-24 text-neutral-400">
      <MessageCircleDashed class="size-14" :stroke-width="1.4" />
      <p class="mt-3 text-sm">ຍັງບໍ່ມີຂໍ້ຄວາມ</p>
      <RouterLink to="/" class="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white">ໄປເລືອກສິນຄ້າ</RouterLink>
    </div>

    <ul v-else class="divide-y divide-neutral-100 bg-white">
      <li v-for="conv in chat.list" :key="conv.key">
        <RouterLink :to="{ path: `/chats/${conv.itemId}`, query: { peer: conv.peerId } }" class="flex gap-3 px-3 py-3 active:bg-neutral-50">
          <div class="relative shrink-0">
            <img :src="conv.itemImage" alt="" class="size-14 rounded-lg bg-neutral-100 object-cover" />
            <SellerAvatar
              :user="{ userId: conv.peerId, fullName: conv.peerName ?? roleOf(conv) }"
              size="size-6 text-[10px] ring-2 ring-white"
              class="absolute -right-1.5 -bottom-1.5"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <p class="truncate text-sm font-semibold">{{ conv.peerName ?? roleOf(conv) }}</p>
              <span class="shrink-0 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500">
                {{ conv.sellerId === auth.user?.userId ? 'ຜູ້ຊື້' : 'ຜູ້ຂາຍ' }}
              </span>
              <span v-if="conv.lastMessageAt" class="ml-auto shrink-0 text-[11px] text-neutral-400">{{ timeAgo(conv.lastMessageAt) }}</span>
            </div>
            <p class="truncate text-xs text-neutral-500">{{ conv.itemTitle }}</p>
            <div class="mt-0.5 flex items-center gap-2">
              <p class="truncate text-[13px]" :class="conv.unread ? 'font-semibold text-neutral-900' : 'text-neutral-500'">{{ preview(conv) }}</p>
              <span v-if="conv.unread" class="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                {{ conv.unread }}
              </span>
            </div>
          </div>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
