<script setup>
import { computed, ref, watch } from 'vue'
import { X, Minus, Plus, CheckCircle2, MapPin, QrCode, Loader2, Upload, MessageCircle, Download } from 'lucide-vue-next'
import { useOrdersStore } from '@/stores/orders'
import { errorMessage } from '@/api/http'
import { toast } from '@/composables/useToast'
import { formatKip, formatPrice } from '@/utils/format'

const props = defineProps({
  open: Boolean,
  /** Item being ordered (needs seller.qrPaymentUrl from GET /items/:id to show the QR) */
  item: { type: Object, default: null },
  /** Existing PENDING order: jumps straight to the payment step */
  order: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const orders = useOrdersStore()

const step = ref('form') // form -> pay -> done
const quantity = ref(1)
const busy = ref(false)
const current = ref(null)
const slipInput = ref(null)
const slipPreview = ref('')

const target = computed(() => props.item ?? props.order?.item)
const seller = computed(() => props.item?.seller ?? props.order?.seller ?? {})
const isFree = computed(() => target.value?.itemType === 'FREE' || (props.order && !props.order.totalAmount))
const maxQty = computed(() => target.value?.quantity ?? (target.value?.itemType === 'FOOD' ? 20 : 1))
const total = computed(() => (target.value?.price ?? 0) * quantity.value)
const amount = computed(() => current.value?.totalAmount ?? total.value)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    quantity.value = 1
    slipPreview.value = ''
    current.value = props.order
    step.value = props.order ? 'pay' : 'form'
  },
)

async function placeOrder() {
  busy.value = true
  try {
    current.value = await orders.place(target.value, quantity.value)
    step.value = isFree.value ? 'done' : 'pay'
  } catch (e) {
    toast(errorMessage(e, 'ສັ່ງຊື້ບໍ່ສຳເລັດ, ລອງໃໝ່'), 'error')
  } finally {
    busy.value = false
  }
}

async function onSlip(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  slipPreview.value = URL.createObjectURL(file)
  busy.value = true
  try {
    current.value = await orders.uploadSlip(current.value.orderId, file)
    step.value = 'done'
  } catch (e) {
    slipPreview.value = ''
    toast(errorMessage(e, 'ອັບໂຫຼດສະລິບບໍ່ສຳເລັດ'), 'error')
  } finally {
    busy.value = false
  }
}

const close = () => emit('close', current.value)
</script>

<template>
  <Teleport to="body">
    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition" leave-active-class="transition">
      <div v-if="open && target" class="fixed inset-0 z-50 mx-auto flex max-w-md flex-col justify-end bg-black/50" @click.self="close">
        <div class="max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-white pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <div class="sticky top-0 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3">
            <h2 class="text-[15px] font-semibold">
              {{ step === 'form' ? (isFree ? 'ຈອງເຄື່ອງ' : 'ສັ່ງຊື້ສິນຄ້າ') : step === 'pay' ? 'ຊຳລະເງິນ' : 'ສຳເລັດ' }}
            </h2>
            <button class="grid size-8 place-items-center rounded-full bg-neutral-100" aria-label="ປິດ" @click="close">
              <X class="size-4" />
            </button>
          </div>

          <!-- Step 1: quantity -->
          <div v-if="step === 'form'" class="space-y-4 px-4 pt-4">
            <div class="flex gap-3">
              <img :src="target.thumbnail" class="size-20 rounded-lg object-cover" alt="" />
              <div class="min-w-0 flex-1">
                <p class="line-clamp-2 text-[13px]">{{ target.title }}</p>
                <p class="mt-1 text-lg font-bold" :class="isFree ? 'text-emerald-500' : 'text-brand'">{{ formatPrice(target) }}</p>
                <p class="flex items-center gap-1 text-[11px] text-neutral-500"><MapPin class="size-3" /> {{ target.pickupLocation }}</p>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm">ຈຳນວນ <span v-if="target.quantity || maxQty === 1" class="text-xs text-neutral-400">(ມີ {{ maxQty }} ຊິ້ນ)</span></span>
              <div class="flex items-center rounded-lg border border-neutral-200">
                <button class="grid size-8 place-items-center disabled:opacity-30" :disabled="quantity <= 1" @click="quantity--"><Minus class="size-4" /></button>
                <span class="w-10 text-center text-sm font-semibold">{{ quantity }}</span>
                <button class="grid size-8 place-items-center disabled:opacity-30" :disabled="quantity >= maxQty" @click="quantity++"><Plus class="size-4" /></button>
              </div>
            </div>

            <p class="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-600">
              💬 ມີຄຳຂໍພິເສດ (ບໍ່ເຜັດ, ເວລາມາຮັບ)? ບອກຜູ້ຂາຍທາງແຊັດຫຼັງສັ່ງຊື້.
            </p>

            <div class="flex items-center justify-between border-t border-dashed border-neutral-200 pt-3">
              <span class="text-sm text-neutral-600">ລວມທັງໝົດ</span>
              <span class="text-xl font-bold text-brand">{{ isFree ? 'FREE' : formatKip(total) }}</span>
            </div>

            <button
              class="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-brand to-coral font-semibold text-white shadow-md shadow-brand/30 disabled:opacity-60"
              :disabled="busy"
              @click="placeOrder"
            >
              <Loader2 v-if="busy" class="size-5 animate-spin" />
              {{ isFree ? 'ຢືນຢັນການຈອງ' : 'ຢືນຢັນ & ໄປຊຳລະເງິນ' }}
            </button>
          </div>

          <!-- Step 2: pay with the seller's QR, then upload the slip -->
          <div v-else-if="step === 'pay' && current" class="px-4 pt-4 text-center">
            <div class="mx-auto w-64 overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
              <div class="flex items-center justify-center gap-1.5 bg-navy py-2 text-xs font-semibold text-white">
                <QrCode class="size-4" /> QR ຂອງ {{ seller.fullName ?? 'ຜູ້ຂາຍ' }}
              </div>
              <img v-if="seller.qrPaymentUrl" :src="seller.qrPaymentUrl" alt="QR ຊຳລະເງິນ" class="mx-auto aspect-square w-full object-contain p-3" />
              <div v-else class="grid aspect-square place-items-center p-6 text-sm text-neutral-500">
                <div>
                  <p class="text-4xl">💵</p>
                  <p class="mt-2">ຜູ້ຂາຍຍັງບໍ່ໄດ້ຕັ້ງ QR.<br />ຊຳລະເງິນສົດ ຫຼື ຂໍເລກບັນຊີທາງແຊັດ.</p>
                </div>
              </div>
              <div class="border-t border-neutral-100 py-2">
                <p class="text-[11px] text-neutral-500">ຈຳນວນເງິນ</p>
                <p class="text-xl font-bold text-brand">{{ formatKip(amount) }}</p>
              </div>
            </div>
            <a v-if="seller.qrPaymentUrl" :href="seller.qrPaymentUrl" download target="_blank" class="mt-2 inline-flex items-center gap-1 text-xs text-neutral-500 underline">
              <Download class="size-3" /> ບັນທຶກ QR ໄປສະແກນໃນແອັບທະນາຄານ
            </a>
            <p class="mt-1 text-xs text-neutral-400">ເລກຄຳສັ່ງຊື້ #{{ current.orderId }}</p>

            <img v-if="slipPreview" :src="slipPreview" alt="" class="mx-auto mt-3 h-28 rounded-lg object-contain" />

            <input ref="slipInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onSlip" />
            <button
              class="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-brand to-coral font-semibold text-white disabled:opacity-60"
              :disabled="busy"
              @click="slipInput.click()"
            >
              <Loader2 v-if="busy" class="size-5 animate-spin" />
              <Upload v-else class="size-5" /> ໂອນແລ້ວ · ອັບໂຫຼດສະລິບ
            </button>
            <RouterLink :to="`/chats/${current.itemId ?? target.itemId}`" class="mt-2 flex h-10 items-center justify-center gap-1 text-sm text-neutral-500" @click="close">
              <MessageCircle class="size-4" /> ຈ່າຍເງິນສົດ / ຕິດຕໍ່ຜູ້ຂາຍ
            </RouterLink>
          </div>

          <!-- Step 3: done -->
          <div v-else-if="step === 'done'" class="px-4 pt-6 pb-2 text-center">
            <CheckCircle2 class="mx-auto size-16 text-emerald-500" />
            <p class="mt-3 text-lg font-bold">{{ isFree ? 'ຈອງສຳເລັດ!' : 'ສົ່ງສະລິບແລ້ວ!' }}</p>
            <p class="mt-1 text-sm text-neutral-500">
              {{ isFree ? 'ນັດຮັບເຄື່ອງກັບຜູ້ໃຫ້ທາງແຊັດ' : 'ລໍຖ້າຜູ້ຂາຍກວດສອບ ແລະ ຢືນຢັນ' }}<br />
              📍 {{ target.pickupLocation ?? 'ຕາມຈຸດນັດ' }}
            </p>
            <button class="mt-5 h-12 w-full rounded-full bg-brand font-semibold text-white" @click="close">ຕົກລົງ</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
