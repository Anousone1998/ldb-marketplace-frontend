<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ImagePlus, SendHorizontal, Loader2, AlertCircle, Check, CheckCheck } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import SellerAvatar from '@/components/SellerAvatar.vue'
import { itemsApi, storageApi } from '@/api'
import { errorMessage } from '@/api/http'
import { convKey, useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToast'
import { formatPrice, formatTime, isImageMessage } from '@/utils/format'

const props = defineProps({ itemId: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const chat = useChatStore()
const auth = useAuthStore()

const item = ref(null)
const key = ref(null)
const text = ref('')
const sendingImage = ref(false)
const scroller = ref(null)
const fileInput = ref(null)

const conv = computed(() => chat.conversations[key.value])
const messages = computed(() => conv.value?.messages ?? [])
const isMine = (m) => m.senderId === auth.user?.userId
const partner = computed(() => conv.value && { userId: conv.value.peerId, fullName: conv.value.peerName ?? conv.value.peerId })
const partnerIsSeller = computed(() => item.value && conv.value?.peerId === item.value.sellerId)

async function scrollToBottom(smooth = true) {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
}

async function open() {
  try {
    item.value = await itemsApi.get(props.itemId)
  } catch {
    toast('ບໍ່ພົບສິນຄ້າ', 'error')
    return router.replace('/chats')
  }
  const me = auth.user.userId
  // A buyer talks to the seller; a seller must pick the buyer (?peer=)
  const peerId = route.query.peer || item.value.sellerId
  if (peerId === me) {
    toast('ເລືອກການສົນທະນາກັບຜູ້ຊື້ຈາກກ່ອງຂໍ້ຄວາມ')
    return router.replace('/chats')
  }
  key.value = convKey(item.value.itemId, peerId)
  const peerName = peerId === item.value.sellerId ? item.value.seller?.fullName : chat.conversations[key.value]?.peerName
  try {
    await chat.openRoom({ item: item.value, peerId, peerName })
  } catch (e) {
    toast(errorMessage(e, 'ເປີດແຊັດບໍ່ສຳເລັດ'), 'error')
  }
  scrollToBottom(false)
}
open()

watch(() => messages.value.length, () => scrollToBottom())
watch(() => conv.value?.typing, (typing) => typing && scrollToBottom())
onBeforeUnmount(() => chat.leaveRoom())

async function send(messageText) {
  try {
    await chat.send(key.value, messageText)
  } catch (e) {
    toast(errorMessage(e, e.message || 'ສົ່ງຂໍ້ຄວາມບໍ່ສຳເລັດ'), 'error')
  }
}

function submit() {
  const value = text.value.trim()
  if (!value || !conv.value) return
  text.value = ''
  send(value)
}

function retry(m) {
  conv.value.messages.splice(conv.value.messages.indexOf(m), 1)
  send(m.messageText)
}

// Messages are text-only on the backend, so an image is sent as its uploaded URL
async function onPickImage(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file || !conv.value) return
  sendingImage.value = true
  try {
    await send(await storageApi.upload(file, { folder: 'items' }))
  } catch (e) {
    toast(errorMessage(e, 'ສົ່ງຮູບບໍ່ສຳເລັດ'), 'error')
  } finally {
    sendingImage.value = false
  }
}

const showDateDivider = (i) =>
  i === 0 || new Date(messages.value[i - 1].createdAt).toDateString() !== new Date(messages.value[i].createdAt).toDateString()
</script>

<template>
  <div class="flex h-dvh flex-col">
    <PageHeader>
      <div v-if="partner" class="flex min-w-0 items-center gap-2">
        <SellerAvatar :user="partner" size="size-8 text-sm" />
        <div class="min-w-0 leading-tight">
          <p class="truncate text-sm font-semibold">
            {{ partner.fullName }}
            <span v-if="partnerIsSeller && item.seller?.department" class="font-normal text-neutral-400">({{ item.seller.department }})</span>
          </p>
          <p class="text-[11px]" :class="conv?.typing ? 'text-brand' : 'text-neutral-400'">
            {{ conv?.typing ? 'ກຳລັງພິມ...' : partnerIsSeller ? 'ຜູ້ຂາຍ' : 'ຜູ້ຊື້' }}
            <template v-if="!chat.connected"> · offline</template>
          </p>
        </div>
      </div>
    </PageHeader>

    <!-- Pinned item widget -->
    <RouterLink v-if="item" :to="`/items/${item.itemId}`" class="flex items-center gap-3 border-b border-neutral-200 bg-white px-3 py-2 shadow-sm">
      <img :src="item.thumbnail" alt="" class="size-11 rounded-md bg-neutral-100 object-cover" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-[13px]">{{ item.title }}</p>
        <p class="text-sm font-bold" :class="item.itemType === 'FREE' ? 'text-emerald-500' : 'text-brand'">{{ formatPrice(item) }}</p>
      </div>
      <span
        class="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
        :class="item.status === 'AVAILABLE' && partnerIsSeller ? 'bg-brand text-white' : 'bg-neutral-200 text-neutral-500'"
      >
        {{ item.status === 'AVAILABLE' ? (partnerIsSeller ? 'ສັ່ງຊື້' : 'AVAILABLE') : item.status }}
      </span>
    </RouterLink>

    <!-- Messages -->
    <div ref="scroller" class="flex-1 space-y-2 overflow-y-auto px-3 py-3">
      <button v-if="conv?.hasMore" class="mx-auto block text-xs text-brand" @click="chat.loadOlder(key)">ໂຫຼດຂໍ້ຄວາມກ່ອນໜ້າ</button>
      <p class="mx-auto w-fit rounded-full bg-neutral-200/70 px-3 py-1 text-center text-[11px] text-neutral-500">
        🔒 ແຊັດພາຍໃນອົງກອນ · ນັດຮັບເຄື່ອງໃນບໍລິເວນບໍລິສັດເທົ່ານັ້ນ
      </p>

      <template v-for="(m, i) in messages" :key="m.messageId">
        <p v-if="showDateDivider(i)" class="py-1 text-center text-[11px] text-neutral-400">
          {{ new Date(m.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }}
        </p>
        <div class="flex items-end gap-1.5" :class="isMine(m) ? 'flex-row-reverse' : ''">
          <SellerAvatar v-if="!isMine(m) && partner" :user="partner" size="size-7 text-xs" />
          <a v-if="isImageMessage(m.messageText)" :href="m.messageText" target="_blank" class="block max-w-[65%] overflow-hidden rounded-2xl shadow-sm">
            <img :src="m.messageText" alt="" class="max-h-60 object-cover" />
          </a>
          <div
            v-else
            class="max-w-[72%] rounded-2xl px-3 py-2 text-sm shadow-sm"
            :class="isMine(m) ? 'rounded-br-md bg-linear-to-br from-brand to-coral text-white' : 'rounded-bl-md bg-white text-neutral-800'"
          >
            <p class="break-words whitespace-pre-line">{{ m.messageText }}</p>
          </div>
          <span class="flex shrink-0 items-center gap-0.5 pb-0.5 text-[10px] text-neutral-400">
            <template v-if="isMine(m)">
              <Loader2 v-if="m.status === 'sending'" class="size-3 animate-spin" />
              <button v-else-if="m.status === 'failed'" class="flex items-center gap-0.5 text-red-500" @click="retry(m)">
                <AlertCircle class="size-3" /> ລອງໃໝ່
              </button>
              <CheckCheck v-else-if="m.isRead" class="size-3.5 text-brand" />
              <Check v-else class="size-3 text-neutral-400" />
            </template>
            {{ formatTime(m.createdAt) }}
          </span>
        </div>
      </template>

      <div v-if="conv?.typing" class="flex items-end gap-1.5">
        <SellerAvatar v-if="partner" :user="partner" size="size-7 text-xs" />
        <div class="flex gap-1 rounded-2xl rounded-bl-md bg-white px-3 py-3 shadow-sm">
          <span v-for="d in 3" :key="d" class="size-1.5 animate-bounce rounded-full bg-neutral-400" :style="{ animationDelay: `${d * 120}ms` }" />
        </div>
      </div>
    </div>

    <!-- Composer -->
    <form class="flex items-end gap-2 border-t border-neutral-200 bg-white px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]" @submit.prevent="submit">
      <button
        type="button"
        class="grid size-10 shrink-0 place-items-center rounded-full text-brand active:bg-brand-50"
        aria-label="ແນບຮູບ"
        :disabled="sendingImage || !conv"
        @click="fileInput.click()"
      >
        <Loader2 v-if="sendingImage" class="size-5 animate-spin" />
        <ImagePlus v-else class="size-6" />
      </button>
      <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onPickImage" />
      <textarea
        v-model="text"
        rows="1"
        maxlength="2000"
        placeholder="ພິມຂໍ້ຄວາມ..."
        class="field-sizing-content max-h-28 min-h-10 flex-1 resize-none rounded-2xl bg-neutral-100 px-4 py-2.5 text-sm outline-none"
        @keydown.enter.exact="(e) => !e.isComposing && (e.preventDefault(), submit())"
      />
      <button
        type="submit"
        class="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand to-coral text-white transition disabled:from-neutral-300 disabled:to-neutral-300"
        :disabled="!text.trim() || !conv"
        aria-label="ສົ່ງ"
      >
        <SendHorizontal class="size-5" />
      </button>
    </form>
  </div>
</template>
