<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BadgeCheck, LogOut, Package, ReceiptText, Store, Loader2 } from 'lucide-vue-next'
import ProductCard from '@/components/ProductCard.vue'
import SellerAvatar from '@/components/SellerAvatar.vue'
import OrderModal from '@/components/OrderModal.vue'
import { itemsApi, ordersApi } from '@/api'
import { errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useOrdersStore } from '@/stores/orders'
import { toast } from '@/composables/useToast'
import { formatKip, orderStage, timeAgo } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const orders = useOrdersStore()

const TABS = [
  { key: 'purchases', label: 'ຊື້', icon: ReceiptText },
  { key: 'sales', label: 'ຂາຍໄດ້', icon: Store },
  { key: 'listings', label: 'ລາຍການ', icon: Package },
]
const tab = computed(() => (TABS.some((t) => t.key === route.query.tab) ? route.query.tab : 'purchases'))
const listings = ref([])
const payingOrder = ref(null)
const busyId = ref(null)

itemsApi.bySeller(auth.user.userId).then((rows) => (listings.value = rows)).catch(() => {})
orders.load().catch(() => {})

const stats = computed(() => [
  { label: 'ກຳລັງຂາຍ', value: listings.value.filter((i) => i.status === 'AVAILABLE').length },
  { label: 'ຄຳສັ່ງຊື້', value: orders.purchases.length },
  { label: 'ລໍຖ້າດຳເນີນການ', value: orders.actionCount },
])

const rows = computed(() => (tab.value === 'sales' ? orders.sales : orders.purchases))

async function setStatus(order, status) {
  if (status === 'CANCELLED' && !confirm('ຍົກເລີກຄຳສັ່ງຊື້ນີ້?')) return
  busyId.value = order.orderId
  try {
    await orders.setStatus(order.orderId, status)
    toast(status === 'COMPLETED' ? 'ປິດການຂາຍແລ້ວ ✅' : 'ຍົກເລີກແລ້ວ', 'success')
  } catch (e) {
    toast(errorMessage(e, 'ອັບເດດບໍ່ສຳເລັດ'), 'error')
  } finally {
    busyId.value = null
  }
}

async function pay(order) {
  busyId.value = order.orderId
  payingOrder.value = await ordersApi.get(order.orderId).catch(() => order)
  busyId.value = null
}

function logout() {
  auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div>
    <header class="bg-linear-to-br from-brand to-coral px-4 pt-[calc(env(safe-area-inset-top)+20px)] pb-14 text-white">
      <div class="flex items-center gap-3">
        <SellerAvatar :user="auth.user" size="size-16 text-2xl ring-4 ring-white/30" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-lg font-bold">{{ auth.user.fullName }}</p>
          <p class="text-xs opacity-90">{{ auth.user.userId }}<template v-if="auth.user.department"> · ພະແນກ {{ auth.user.department }}</template></p>
          <span class="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
            <BadgeCheck class="size-3" /> Verified Employee
          </span>
        </div>
        <button class="grid size-9 place-items-center rounded-full bg-white/20" aria-label="ອອກຈາກລະບົບ" @click="logout">
          <LogOut class="size-4" />
        </button>
      </div>
    </header>

    <div class="relative z-10 mx-3 -mt-10 grid grid-cols-3 divide-x divide-neutral-100 rounded-xl bg-white py-3 shadow-sm">
      <div v-for="s in stats" :key="s.label" class="text-center">
        <p class="text-lg font-bold text-neutral-900">{{ s.value }}</p>
        <p class="text-[11px] text-neutral-500">{{ s.label }}</p>
      </div>
    </div>

    <div class="sticky top-0 z-20 mt-3 flex border-b border-neutral-200 bg-white">
      <RouterLink
        v-for="t in TABS"
        :key="t.key"
        :to="{ query: { tab: t.key } }"
        replace
        class="flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-[13px] font-medium"
        :class="tab === t.key ? 'border-brand text-brand' : 'border-transparent text-neutral-500'"
      >
        <component :is="t.icon" class="size-4" /> {{ t.label }}
        <span v-if="t.key === 'sales' && orders.sales.some((o) => o.status === 'PENDING')" class="size-1.5 rounded-full bg-red-500" />
      </RouterLink>
    </div>

    <!-- Purchases / sales -->
    <section v-if="tab !== 'listings'" class="space-y-2 p-3">
      <div v-if="!rows.length" class="py-16 text-center text-sm text-neutral-400">
        <p class="text-4xl">🧾</p>
        <p class="mt-2">{{ tab === 'sales' ? 'ຍັງບໍ່ມີຄົນສັ່ງຊື້' : 'ຍັງບໍ່ມີຄຳສັ່ງຊື້' }}</p>
      </div>
      <article v-for="o in rows" :key="o.orderId" class="rounded-xl bg-white p-3 shadow-sm">
        <div class="flex items-center justify-between text-[11px] text-neutral-400">
          <span>#{{ o.orderId }} · {{ timeAgo(o.createdAt) }}</span>
          <span class="rounded-full px-2 py-0.5 font-semibold" :class="orderStage(o, tab === 'sales' ? 'seller' : 'buyer').cls">
            {{ orderStage(o, tab === 'sales' ? 'seller' : 'buyer').label }}
          </span>
        </div>
        <RouterLink :to="`/items/${o.itemId}`" class="mt-2 flex gap-3">
          <img :src="o.item?.thumbnail" alt="" class="size-16 rounded-lg bg-neutral-100 object-cover" />
          <div class="min-w-0 flex-1">
            <p class="line-clamp-2 text-[13px]">{{ o.item?.title }}</p>
            <p class="mt-0.5 text-xs text-neutral-500">× {{ o.quantity }}</p>
            <p class="text-[11px] text-neutral-400">
              {{ tab === 'sales' ? `ຜູ້ຊື້: ${o.buyer?.fullName ?? o.buyerId}` : `ຜູ້ຂາຍ: ${o.seller?.fullName ?? o.sellerId}` }}
            </p>
          </div>
        </RouterLink>
        <a v-if="o.paymentSlipUrl" :href="o.paymentSlipUrl" target="_blank" class="mt-2 flex items-center gap-2 rounded-lg bg-neutral-50 p-2 text-xs text-neutral-600">
          <img :src="o.paymentSlipUrl" alt="" class="size-10 rounded object-cover" /> ເບິ່ງສະລິບໂອນເງິນ
        </a>
        <div class="mt-2 flex items-center gap-2 border-t border-neutral-100 pt-2">
          <span class="mr-auto text-xs text-neutral-500">ລວມ <b class="text-sm text-brand">{{ o.totalAmount ? formatKip(o.totalAmount) : 'FREE' }}</b></span>
          <Loader2 v-if="busyId === o.orderId" class="size-4 animate-spin text-neutral-400" />
          <template v-else-if="o.status === 'PENDING'">
            <button class="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600" @click="setStatus(o, 'CANCELLED')">ຍົກເລີກ</button>
            <button v-if="tab === 'sales'" class="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white" @click="setStatus(o, 'COMPLETED')">
              ສົ່ງເຄື່ອງແລ້ວ
            </button>
            <button v-else-if="o.totalAmount > 0" class="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white" @click="pay(o)">
              {{ o.paymentSlipUrl ? 'ປ່ຽນສະລິບ' : 'ຊຳລະເງິນ' }}
            </button>
          </template>
          <RouterLink
            :to="tab === 'sales' ? { path: `/chats/${o.itemId}`, query: { peer: o.buyerId } } : `/chats/${o.itemId}`"
            class="rounded-full border border-brand px-3 py-1.5 text-xs text-brand"
          >
            ແຊັດ
          </RouterLink>
        </div>
      </article>
    </section>

    <!-- Listings -->
    <section v-else class="p-3">
      <div v-if="!listings.length" class="py-16 text-center text-sm text-neutral-400">
        <p class="text-4xl">📦</p>
        <p class="mt-2">ຍັງບໍ່ມີລາຍການ</p>
        <RouterLink to="/items/new" class="mt-4 inline-block rounded-full bg-brand px-5 py-2 font-semibold text-white">+ ລົງຂາຍເລີຍ</RouterLink>
      </div>
      <div v-else class="grid grid-cols-2 gap-2">
        <ProductCard v-for="item in listings" :key="item.itemId" :item="item" />
      </div>
    </section>

    <OrderModal :open="!!payingOrder" :order="payingOrder" @close="payingOrder = null" />
  </div>
</template>
