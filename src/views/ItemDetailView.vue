<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, Share2, MapPin, Clock, BadgeCheck, MessageCircle, ShoppingBag, Phone, Tag, Store, Loader2 } from 'lucide-vue-next'
import ImageCarousel from '@/components/ImageCarousel.vue'
import SellerAvatar from '@/components/SellerAvatar.vue'
import OrderModal from '@/components/OrderModal.vue'
import { itemsApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useNow } from '@/composables/useNow'
import { toast } from '@/composables/useToast'
import { errorMessage } from '@/api/http'
import { ITEM_TYPES, countdown, formatPrice, formatTime, timeAgo } from '@/utils/format'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const auth = useAuthStore()
const now = useNow()

const item = ref(null)
const loading = ref(true)
const notFound = ref(false)
const showOrder = ref(false)
const statusBusy = ref(false)

async function load() {
  loading.value = true
  notFound.value = false
  try {
    item.value = await itemsApi.get(props.id)
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })

const type = computed(() => item.value && ITEM_TYPES[item.value.itemType])
const isFree = computed(() => item.value && formatPrice(item.value) === 'FREE')
const isMine = computed(() => item.value?.sellerId === auth.user?.userId)
const cutoffLeft = computed(() => item.value?.orderCutoffTime && countdown(item.value.orderCutoffTime, now.value))
const cutoffPassed = computed(() => item.value?.itemType === 'FOOD' && item.value.orderCutoffTime && !cutoffLeft.value)

const orderLabel = computed(() => {
  if (!item.value) return ''
  if (item.value.status !== 'AVAILABLE') return item.value.status === 'SOLD' ? 'ຂາຍໝົດແລ້ວ' : 'ມີຄົນຈອງແລ້ວ'
  if (cutoffPassed.value) return 'ປິດຮັບອໍເດີແລ້ວ'
  return isFree.value ? 'ຈອງເຄື່ອງ' : 'ສັ່ງຊື້ / ຈອງເຄື່ອງ'
})
const canOrder = computed(() => item.value?.status === 'AVAILABLE' && !cutoffPassed.value && !isMine.value)

const back = () => (window.history.state?.back ? router.back() : router.push('/'))

async function share() {
  const data = { title: item.value.title, url: location.href }
  if (navigator.share) return navigator.share(data).catch(() => {})
  await navigator.clipboard?.writeText(location.href)
  toast('ຄັດລອກລິ້ງແລ້ວ')
}

async function setItemStatus(status) {
  statusBusy.value = true
  try {
    item.value = await itemsApi.updateStatus(item.value.itemId, status)
    toast('ອັບເດດສະຖານະແລ້ວ', 'success')
  } catch (e) {
    toast(errorMessage(e, 'ອັບເດດບໍ່ສຳເລັດ'), 'error')
  } finally {
    statusBusy.value = false
  }
}

// Status becomes RESERVED once an order exists
function closeOrder() {
  showOrder.value = false
  itemsApi.get(props.id).then((fresh) => (item.value = fresh)).catch(() => {})
}
</script>

<template>
  <div class="pb-[calc(env(safe-area-inset-bottom)+80px)]">
    <div v-if="loading" class="grid h-dvh place-items-center"><Loader2 class="size-8 animate-spin text-brand" /></div>

    <div v-else-if="notFound" class="grid h-dvh place-items-center px-8 text-center">
      <div>
        <p class="text-5xl">🔍</p>
        <p class="mt-3 font-semibold">ບໍ່ພົບສິນຄ້ານີ້</p>
        <RouterLink to="/" class="mt-4 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white">ກັບໜ້າຫຼັກ</RouterLink>
      </div>
    </div>

    <template v-else>
      <!-- Floating top actions over the image -->
      <div class="fixed inset-x-0 top-0 z-30 mx-auto flex max-w-md justify-between p-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button class="grid size-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur" aria-label="ກັບຄືນ" @click="back">
          <ChevronLeft class="size-5" />
        </button>
        <button class="grid size-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur" aria-label="ແບ່ງປັນ" @click="share">
          <Share2 class="size-4" />
        </button>
      </div>

      <ImageCarousel :images="item.images">
        <div v-if="item.status !== 'AVAILABLE'" class="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <span class="-rotate-12 rounded-md border-[3px] border-white px-5 py-2 text-xl font-extrabold tracking-[0.25em] text-white">{{ item.status }}</span>
        </div>
      </ImageCarousel>

      <!-- Pre-order flash strip -->
      <div v-if="item.itemType === 'FOOD' && item.orderCutoffTime" class="flex items-center justify-between bg-linear-to-r from-brand to-accent px-3 py-2 text-white">
        <span class="flex items-center gap-1 text-sm font-extrabold italic"><Clock class="size-4" /> PRE-ORDER</span>
        <span v-if="cutoffLeft" class="text-xs">ປິດຮັບໃນ <b class="font-mono text-sm">{{ cutoffLeft }}</b></span>
        <span v-else class="text-xs font-semibold">ປິດຮັບອໍເດີແລ້ວ ({{ formatTime(item.orderCutoffTime) }})</span>
      </div>

      <!-- Price & title -->
      <section class="bg-white px-3 pt-3 pb-4">
        <p class="text-2xl font-extrabold" :class="isFree ? 'text-emerald-500' : 'text-brand'">{{ formatPrice(item) }}</p>
        <h1 class="mt-1 text-[15px] leading-snug font-medium text-neutral-900">{{ item.title }}</h1>
        <div class="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <span class="rounded-full px-2 py-0.5 font-semibold" :class="type.badge">{{ type.emoji }} {{ type.label }}</span>
          <span v-if="item.condition" class="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
            <Tag class="size-3" /> ສະພາບ: {{ item.condition }}
          </span>
          <span class="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-600">
            <MapPin class="size-3" /> {{ item.pickupLocation }}
          </span>
          <span class="ml-auto self-center text-neutral-400">{{ timeAgo(item.createdAt) }}</span>
        </div>
      </section>

      <!-- Seller card -->
      <section class="mt-2 bg-white p-3">
        <div class="flex items-center gap-3">
          <SellerAvatar :user="item.seller" size="size-12 text-lg" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold">{{ item.seller.fullName }}</p>
            <p v-if="item.seller.department" class="text-xs text-neutral-500">ພະແນກ {{ item.seller.department }}</p>
            <span class="mt-1 inline-flex items-center gap-0.5 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">
              <BadgeCheck class="size-3" /> ພະນັກງານຢືນຢັນແລ້ວ
            </span>
          </div>
          <div v-if="!isMine" class="flex gap-2">
            <a
              v-if="item.seller.phoneNumber"
              :href="`tel:${item.seller.phoneNumber.replace(/[^+\d]/g, '')}`"
              class="grid size-9 place-items-center rounded-full border border-neutral-200 text-neutral-600"
              aria-label="ໂທຫາ"
            >
              <Phone class="size-4" />
            </a>
            <RouterLink :to="`/chats/${item.itemId}`" class="grid size-9 place-items-center rounded-full border border-brand text-brand" aria-label="ແຊັດ">
              <MessageCircle class="size-4" />
            </RouterLink>
          </div>
          <span v-else class="rounded-full bg-neutral-100 px-2 py-1 text-[11px] text-neutral-500">ລາຍການຂອງທ່ານ</span>
        </div>
        <p v-if="item.seller.phoneNumber" class="mt-2 text-[11px] text-neutral-400">📞 {{ item.seller.phoneNumber }}</p>
      </section>

      <!-- Details -->
      <section class="mt-2 bg-white p-3">
        <h2 class="mb-2 text-sm font-semibold">ລາຍລະອຽດ</h2>
        <dl class="grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
          <dt class="text-neutral-500">ຈຸດຮັບເຄື່ອງ</dt>
          <dd>📍 {{ item.pickupLocation }}</dd>
          <template v-if="item.quantity">
            <dt class="text-neutral-500">ຈຳນວນ</dt>
            <dd>{{ item.quantity }} ຊິ້ນ</dd>
          </template>
          <template v-if="item.orderCutoffTime">
            <dt class="text-neutral-500">ປິດຮັບອໍເດີ</dt>
            <dd>{{ new Date(item.orderCutoffTime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) }}</dd>
          </template>
          <dt class="text-neutral-500">ການຊຳລະ</dt>
          <dd>{{ isFree ? 'ບໍ່ມີຄ່າໃຊ້ຈ່າຍ' : item.seller.qrPaymentUrl ? 'QR ຜູ້ຂາຍ + ອັບໂຫຼດສະລິບ' : 'ເງິນສົດເມື່ອຮັບເຄື່ອງ' }}</dd>
        </dl>
        <p v-if="item.description" class="mt-3 border-t border-neutral-100 pt-3 text-[13px] leading-relaxed whitespace-pre-line text-neutral-700">
          {{ item.description }}
        </p>
      </section>

      <!-- Sticky action bar -->
      <div class="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2 border-t border-neutral-200 bg-white px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <RouterLink to="/" class="flex w-12 flex-col items-center text-[10px] text-neutral-500">
          <Store class="size-5" /> ໜ້າຫຼັກ
        </RouterLink>
        <RouterLink
          v-if="!isMine"
          :to="`/chats/${item.itemId}`"
          class="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-brand bg-brand-50 text-[13px] font-semibold text-brand"
        >
          <MessageCircle class="size-4" /> ແຊັດສອບຖາມ
        </RouterLink>
        <button
          v-if="!isMine"
          class="flex h-11 flex-[1.3] items-center justify-center gap-1.5 rounded-full bg-linear-to-r from-brand to-accent text-[13px] font-semibold text-white shadow-md shadow-brand/30 disabled:from-neutral-300 disabled:to-neutral-300 disabled:shadow-none"
          :disabled="!canOrder"
          @click="showOrder = true"
        >
          <ShoppingBag class="size-4" /> {{ orderLabel }}
        </button>
        <template v-else>
          <RouterLink to="/profile?tab=sales" class="flex h-11 flex-1 items-center justify-center rounded-full border border-neutral-300 text-[13px] font-semibold text-neutral-700">
            ຄຳສັ່ງຊື້ຂອງລູກຄ້າ
          </RouterLink>
          <button
            v-if="item.status === 'AVAILABLE'"
            class="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-neutral-900 text-[13px] font-semibold text-white disabled:opacity-60"
            :disabled="statusBusy"
            @click="setItemStatus('SOLD')"
          >
            <Loader2 v-if="statusBusy" class="size-4 animate-spin" /> ໝາຍວ່າຂາຍແລ້ວ
          </button>
          <button
            v-else-if="item.status === 'SOLD'"
            class="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand text-[13px] font-semibold text-white disabled:opacity-60"
            :disabled="statusBusy"
            @click="setItemStatus('AVAILABLE')"
          >
            <Loader2 v-if="statusBusy" class="size-4 animate-spin" /> ເປີດຂາຍອີກຄັ້ງ
          </button>
        </template>
      </div>

      <OrderModal :open="showOrder" :item="item" @close="closeOrder" />
    </template>
  </div>
</template>
