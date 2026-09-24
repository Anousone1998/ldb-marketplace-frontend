<script setup>
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Search, Bell, MessageCircle, ChevronDown, MapPin, Zap, ArrowUpDown, PackageOpen } from 'lucide-vue-next'
import ProductCard from '@/components/ProductCard.vue'
import CountBadge from '@/components/CountBadge.vue'
import { itemsApi } from '@/api'
import { apiState } from '@/api/http'
import { useChatStore } from '@/stores/chat'
import { useOrdersStore } from '@/stores/orders'
import { useNow } from '@/composables/useNow'
import { toast } from '@/composables/useToast'
import { PICKUP_LOCATIONS, countdown, formatKip, formatTime } from '@/utils/format'

const chat = useChatStore()
const orders = useOrdersStore()
const now = useNow()

const categories = [
  { emoji: '🍱', label: 'ອາຫານທ່ຽງ', bg: 'from-orange-100 to-orange-50', type: 'FOOD' },
  { emoji: '📱', label: 'ເຄື່ອງມືສອງ', bg: 'from-indigo-100 to-indigo-50', type: 'SECOND_HAND' },
  { emoji: '🎁', label: 'ແຈກຟຣີ', bg: 'from-emerald-100 to-emerald-50', type: 'FREE' },
  { emoji: '☕', label: 'ກາເຟ/ຂະໜົມ', bg: 'from-amber-100 to-amber-50', type: 'FOOD', keyword: 'ກາເຟ|ຂະໜົມ|ເຄັກ|coffee|cake' },
  { emoji: '🚗', label: 'Carpool', bg: 'from-sky-100 to-sky-50', soon: true },
]

const chips = [
  { label: 'ທັງໝົດ', type: '' },
  { label: 'ອາຫານ (Pre-order)', type: 'FOOD' },
  { label: 'ມືສອງ', type: 'SECOND_HAND' },
  { label: 'ແຈກຟຣີ', type: 'FREE' },
]

const sorts = [
  { label: 'ລ່າສຸດ', value: '' },
  { label: 'ລາຄາ ຕ່ຳ → ສູງ', value: 'price_asc' },
  { label: 'ລາຄາ ສູງ → ຕ່ຳ', value: 'price_desc' },
]

// Filter bar sticks right below the header, whatever its height
const header = ref(null)
const headerHeight = ref(0)
let resizeObserver
onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => (headerHeight.value = entry.target.offsetHeight))
  resizeObserver.observe(header.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())

const filters = reactive({ q: '', type: '', keyword: '', location: '', sort: '' })
const items = ref([])
const page = ref(1)
const totalPages = ref(1)
const preorders = ref([])
const loading = ref(true)
const loadingMore = ref(false)
const error = ref(false)

// The API filters by q / itemType and pages by createdAt. Pickup location, the
// coffee keyword and price sorting are applied on the client to loaded pages.
const visibleItems = computed(() => {
  const keyword = filters.keyword && new RegExp(filters.keyword, 'i')
  const rows = items.value.filter(
    (i) => (!filters.location || i.pickupLocation === filters.location) && (!keyword || keyword.test(i.title)),
  )
  if (filters.sort === 'price_asc') return [...rows].sort((a, b) => a.price - b.price)
  if (filters.sort === 'price_desc') return [...rows].sort((a, b) => b.price - a.price)
  return rows
})

// Preset landmarks plus any free-text locations sellers have used
const locations = computed(() => [...new Set([...PICKUP_LOCATIONS, ...items.value.map((i) => i.pickupLocation).filter(Boolean)])])

const serverQuery = () => ({ q: filters.q.trim(), itemType: filters.type, size: 20 })

async function load() {
  loading.value = true
  error.value = false
  try {
    const res = await itemsApi.list({ ...serverQuery(), page: 1 })
    items.value = res.items
    page.value = 1
    totalPages.value = res.meta?.totalPages ?? 1
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || page.value >= totalPages.value) return
  loadingMore.value = true
  try {
    const res = await itemsApi.list({ ...serverQuery(), page: page.value + 1 })
    const seen = new Set(items.value.map((i) => i.itemId))
    items.value.push(...res.items.filter((i) => !seen.has(i.itemId)))
    page.value++
    totalPages.value = res.meta?.totalPages ?? page.value
  } finally {
    loadingMore.value = false
  }
}

// Infinite scroll
const sentinel = ref(null)
let intersection
onMounted(() => {
  intersection = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { rootMargin: '400px' })
  intersection.observe(sentinel.value)
})
onBeforeUnmount(() => intersection?.disconnect())

async function loadPreorders() {
  const { items: food } = await itemsApi.list({ itemType: 'FOOD', size: 50 }).catch(() => ({ items: [] }))
  preorders.value = food
    .filter((i) => i.orderCutoffTime && new Date(i.orderCutoffTime) > Date.now())
    .sort((a, b) => new Date(a.orderCutoffTime) - new Date(b.orderCutoffTime))
}

const nextCutoff = computed(() => preorders.value[0] && countdown(preorders.value[0].orderCutoffTime, now.value))

let debounce
watch(
  () => [filters.q, filters.type],
  () => {
    clearTimeout(debounce)
    debounce = setTimeout(load, 300)
  },
)

function pickCategory(cat) {
  if (cat.soon) return toast('🚗 Carpool ກຳລັງຈະມາໄວໆນີ້!')
  filters.type = cat.type
  filters.keyword = cat.keyword ?? ''
}

function pickChip(type) {
  filters.type = type
  filters.keyword = ''
}

load()
loadPreorders()
// KeepAlive: refresh when returning (e.g. after posting or ordering an item)
let first = true
onActivated(() => {
  if (first) return (first = false)
  load()
  loadPreorders()
})
</script>

<template>
  <div>
    <!-- Sticky gradient header -->
    <header ref="header" class="sticky top-0 z-30 bg-linear-to-r from-brand to-coral px-3 pt-[calc(env(safe-area-inset-top)+10px)] pb-3">
      <div class="mb-2 flex items-center justify-between text-white">
        <p class="text-[15px] font-extrabold tracking-tight">
          Office<span class="font-medium opacity-90">Market</span>
          <span v-if="apiState.mock" class="ml-1 rounded bg-white/25 px-1.5 py-0.5 align-middle text-[9px] font-semibold tracking-wider">DEMO</span>
        </p>
        <div class="flex items-center gap-4">
          <RouterLink to="/profile?tab=purchases" class="relative" aria-label="ແຈ້ງເຕືອນ">
            <Bell class="size-[22px]" />
            <CountBadge :count="orders.actionCount" inverted />
          </RouterLink>
          <RouterLink to="/chats" class="relative" aria-label="ຂໍ້ຄວາມ">
            <MessageCircle class="size-[22px]" />
            <CountBadge :count="chat.totalUnread" inverted />
          </RouterLink>
        </div>
      </div>
      <label class="flex h-9 items-center gap-2 rounded-full bg-white pr-1 pl-3 shadow-sm">
        <Search class="size-4 shrink-0 text-neutral-400" />
        <input
          v-model="filters.q"
          type="search"
          enterkeyhint="search"
          placeholder="ຄົ້ນຫາສິນຄ້າ, ອາຫານ, ໝູ່ຮ່ວມງານ..."
          class="min-w-0 flex-1 bg-transparent text-[13px] text-neutral-800 outline-none placeholder:text-neutral-400"
        />
        <span class="rounded-full bg-linear-to-r from-brand to-coral px-3 py-1 text-xs font-semibold text-white">ຄົ້ນຫາ</span>
      </label>
    </header>

    <!-- Promo banner -->
    <div class="bg-linear-to-b from-coral/0 to-page px-3 pt-3">
      <div class="relative overflow-hidden rounded-xl bg-linear-to-r from-navy to-indigo-600 p-4 text-white">
        <p class="text-[11px] font-semibold tracking-wider text-amber-300 uppercase">Internal only · ບໍ່ມີຄ່າທຳນຽມ</p>
        <p class="mt-1 text-lg leading-tight font-bold">ສັ່ງເຂົ້າທ່ຽງ ຈາກໝູ່ຮ່ວມງານ<br />ຮັບທີ່ Pantry ໃກ້ໂຕະ 🍱</p>
        <span class="absolute -right-3 -bottom-4 text-7xl opacity-90">🛍️</span>
      </div>
    </div>

    <!-- Category bubbles -->
    <section class="mx-3 mt-3 rounded-xl bg-white px-2 py-3">
      <div class="grid grid-cols-5 gap-1">
        <button v-for="cat in categories" :key="cat.label" class="flex flex-col items-center gap-1.5" @click="pickCategory(cat)">
          <span
            class="relative grid size-12 place-items-center rounded-2xl bg-linear-to-br text-2xl shadow-sm transition active:scale-90"
            :class="[cat.bg, filters.type === cat.type && filters.keyword === (cat.keyword ?? '') && !cat.soon && 'ring-2 ring-brand']"
          >
            {{ cat.emoji }}
            <span v-if="cat.soon" class="absolute -top-1 -right-1 rounded bg-red-500 px-1 text-[8px] font-bold text-white">SOON</span>
          </span>
          <span class="text-center text-[11px] leading-tight text-neutral-700">{{ cat.label }}</span>
        </button>
      </div>
    </section>

    <!-- Pre-order flash strip -->
    <section v-if="preorders.length" class="mx-3 mt-3 overflow-hidden rounded-xl bg-white">
      <div class="flex items-center justify-between px-3 pt-3">
        <h2 class="flex items-center gap-1 text-[15px] font-extrabold text-brand italic">
          <Zap class="size-4 fill-brand" /> PRE-ORDER ມື້ນີ້
        </h2>
        <span v-if="nextCutoff" class="flex items-center gap-1 text-[11px] text-neutral-500">
          ປິດຮັບໃນ
          <span v-for="(part, i) in nextCutoff.split(':')" :key="i" class="rounded bg-neutral-900 px-1 py-0.5 font-mono text-[11px] font-bold text-white">{{ part }}</span>
        </span>
      </div>
      <div class="no-scrollbar flex gap-2 overflow-x-auto p-3">
        <RouterLink v-for="p in preorders" :key="p.itemId" :to="`/items/${p.itemId}`" class="w-28 shrink-0">
          <div class="relative">
            <img :src="p.thumbnail" alt="" class="aspect-square w-full rounded-lg object-cover" />
            <span class="absolute top-1 left-1 rounded bg-black/55 px-1 text-[10px] text-white">⏰ {{ formatTime(p.orderCutoffTime) }}</span>
          </div>
          <p class="mt-1 text-[13px] font-bold text-brand">{{ formatKip(p.price) }}</p>
          <p class="truncate text-[11px] text-neutral-500">{{ p.title }}</p>
        </RouterLink>
      </div>
    </section>

    <!-- Filter & sort bar -->
    <section class="sticky z-20 mt-3 space-y-2 bg-page px-3 py-2" :style="{ top: `${headerHeight}px` }">
      <div class="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
        <button
          v-for="chip in chips"
          :key="chip.label"
          class="shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition"
          :class="filters.type === chip.type && !filters.keyword ? 'border-brand bg-brand-50 text-brand' : 'border-neutral-200 bg-white text-neutral-600'"
          @click="pickChip(chip.type)"
        >
          {{ chip.label }}
        </button>
      </div>
      <div class="flex gap-2">
        <label class="relative flex flex-1 items-center rounded-lg bg-white pl-2.5 text-[12px] text-neutral-700 shadow-sm">
          <MapPin class="size-3.5 shrink-0 text-brand" />
          <select v-model="filters.location" class="h-8 w-full appearance-none bg-transparent pr-6 pl-1.5 outline-none">
            <option value="">ທຸກຈຸດຮັບເຄື່ອງ</option>
            <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
          </select>
          <ChevronDown class="pointer-events-none absolute right-2 size-3.5 text-neutral-400" />
        </label>
        <label class="relative flex items-center rounded-lg bg-white pl-2.5 text-[12px] text-neutral-700 shadow-sm">
          <ArrowUpDown class="size-3.5 shrink-0 text-neutral-500" />
          <select v-model="filters.sort" class="h-8 appearance-none bg-transparent pr-6 pl-1.5 outline-none">
            <option v-for="s in sorts" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
          <ChevronDown class="pointer-events-none absolute right-2 size-3.5 text-neutral-400" />
        </label>
      </div>
    </section>

    <!-- Product grid -->
    <section class="px-3 pb-4">
      <h2 class="mb-2 text-[13px] font-semibold text-neutral-700">ແນະນຳສຳລັບທ່ານ</h2>

      <div v-if="loading && !items.length" class="grid grid-cols-2 gap-2">
        <div v-for="n in 6" :key="n" class="animate-pulse overflow-hidden rounded-lg bg-white">
          <div class="aspect-square bg-neutral-200" />
          <div class="space-y-2 p-2">
            <div class="h-3 rounded bg-neutral-200" />
            <div class="h-3 w-2/3 rounded bg-neutral-200" />
            <div class="h-4 w-1/2 rounded bg-neutral-200" />
          </div>
        </div>
      </div>

      <div v-else-if="error" class="py-16 text-center text-sm text-neutral-500">
        ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ
        <button class="ml-1 font-semibold text-brand" @click="load">ລອງໃໝ່</button>
      </div>

      <div v-else-if="!visibleItems.length" class="flex flex-col items-center py-16 text-neutral-400">
        <PackageOpen class="size-12" :stroke-width="1.5" />
        <p class="mt-2 text-sm">ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ</p>
      </div>

      <div v-else class="grid grid-cols-2 gap-2 transition-opacity" :class="loading && 'opacity-60'">
        <ProductCard v-for="item in visibleItems" :key="item.itemId" :item="item" />
      </div>
      <div ref="sentinel" class="flex h-12 items-center justify-center text-xs text-neutral-400">
        <template v-if="loadingMore">ກຳລັງໂຫຼດ...</template>
        <template v-else-if="items.length && page >= totalPages">— ໝົດແລ້ວ —</template>
      </div>
    </section>
  </div>
</template>
