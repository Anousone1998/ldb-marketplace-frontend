<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ImagePlus, X, Loader2, AlertCircle, ChevronDown, Minus, Plus } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import { itemsApi, storageApi } from '@/api'
import { toast } from '@/composables/useToast'
import { CONDITIONS, ITEM_TYPES, PICKUP_LOCATIONS, packDescription, toLocalInput } from '@/utils/format'
import { errorMessage } from '@/api/http'

const MAX_IMAGES = 5
const MAX_QTY = 999
const MAX_SIZE_MB = 5 // backend limit
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

const router = useRouter()

function defaultCutoff() {
  const d = new Date()
  d.setHours(10, 30, 0, 0)
  if (d < new Date()) d.setDate(d.getDate() + 1)
  return toLocalInput(d)
}

const form = reactive({
  title: '',
  itemType: 'FOOD',
  price: '',
  quantity: 1,
  pickupLocation: 'Pantry ຊັ້ນ 2',
  orderCutoffTime: defaultCutoff(),
  condition: CONDITIONS[1],
  description: '',
})
const images = ref([]) // { key, preview, url, progress, status: 'uploading' | 'done' | 'error', file }
const fileInput = ref(null)
const submitting = ref(false)
const touched = ref(false)

watch(
  () => form.itemType,
  (type) => {
    if (type === 'FREE') form.price = ''
  },
)

const errors = computed(() => {
  const e = {}
  if (!images.value.length) e.images = 'ກະລຸນາເພີ່ມຮູບຢ່າງໜ້ອຍ 1 ຮູບ'
  if (form.title.trim().length < 3) e.title = 'ກະລຸນາໃສ່ຊື່ສິນຄ້າ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ)'
  if (!form.pickupLocation.trim()) e.pickupLocation = 'ກະລຸນາໃສ່ຈຸດຮັບເຄື່ອງ'
  if (form.itemType !== 'FREE' && !(Number(form.price) > 0)) e.price = 'ກະລຸນາໃສ່ລາຄາ'
  if (!(Number.isInteger(form.quantity) && form.quantity >= 1 && form.quantity <= MAX_QTY)) e.quantity = `ຈຳນວນຕ້ອງຢູ່ລະຫວ່າງ 1-${MAX_QTY}`
  if (form.itemType === 'FOOD' && new Date(form.orderCutoffTime) <= new Date()) e.orderCutoffTime = 'ເວລາປິດຮັບຕ້ອງເປັນອະນາຄົດ'
  return e
})
const priceDisplay = computed(() => (form.price ? Number(form.price).toLocaleString('en-US') : ''))

// Keep only digits in form.price, show them grouped (25,000), and keep the caret after the same digit.
function onPriceInput(event) {
  const el = event.target
  const digitsBeforeCaret = el.value.slice(0, el.selectionStart).replace(/\D/g, '').length
  form.price = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12)
  el.value = priceDisplay.value
  let caret = 0
  for (let seen = 0; caret < el.value.length && seen < digitsBeforeCaret; caret++) if (/\d/.test(el.value[caret])) seen++
  el.setSelectionRange(caret, caret)
}

const uploading = computed(() => images.value.some((i) => i.status === 'uploading'))

async function upload(img) {
  img.status = 'uploading'
  img.progress = 0
  try {
    img.url = await storageApi.upload(img.file, { folder: 'items', onProgress: (p) => (img.progress = p) })
    img.status = 'done'
  } catch {
    img.status = 'error'
  }
}

function onPick(event) {
  const files = [...event.target.files]
  event.target.value = ''
  for (const file of files) {
    if (images.value.length >= MAX_IMAGES) {
      toast(`ເພີ່ມໄດ້ສູງສຸດ ${MAX_IMAGES} ຮູບ`, 'error')
      break
    }
    if (!ACCEPT.includes(file.type)) {
      toast('ຮອງຮັບສະເພາະ JPG, PNG, WEBP', 'error')
      continue
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast(`ຮູບໃຫຍ່ເກີນ ${MAX_SIZE_MB}MB`, 'error')
      continue
    }
    images.value.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), url: null, progress: 0, status: 'uploading' })
    upload(images.value.at(-1))
  }
}

function removeImage(index) {
  URL.revokeObjectURL(images.value[index].preview)
  images.value.splice(index, 1)
}

async function submit() {
  touched.value = true
  if (Object.keys(errors.value).length) return toast(Object.values(errors.value)[0], 'error')
  if (uploading.value) return toast('ລໍຖ້າອັບໂຫຼດຮູບໃຫ້ສຳເລັດກ່ອນ')
  if (images.value.some((i) => i.status === 'error')) return toast('ມີຮູບອັບໂຫຼດບໍ່ສຳເລັດ, ແຕະເພື່ອລອງໃໝ່ ຫຼື ລຶບອອກ', 'error')

  submitting.value = true
  try {
    const isFood = form.itemType === 'FOOD'
    const created = await itemsApi.create({
      title: form.title.trim(),
      description: packDescription(form.description, {
        orderCutoffTime: isFood ? new Date(form.orderCutoffTime).toISOString() : undefined,
        condition: isFood ? undefined : form.condition,
        quantity: form.quantity,
      }),
      itemType: form.itemType,
      price: form.itemType === 'FREE' ? 0 : Number(form.price),
      pickupLocation: form.pickupLocation.trim(),
      images: images.value.map((i) => i.url),
    })
    toast('ລົງຂາຍສຳເລັດ! 🎉', 'success')
    router.replace(`/items/${created.itemId}`)
  } catch (e) {
    toast(errorMessage(e, 'ລົງຂາຍບໍ່ສຳເລັດ, ລອງໃໝ່'), 'error')
  } finally {
    submitting.value = false
  }
}

const inputCls = 'mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-brand disabled:bg-neutral-100 disabled:text-neutral-400'
const borderFor = (field) => (touched.value && errors.value[field] ? 'border-red-400' : 'border-neutral-200')
</script>

<template>
  <div class="pb-[calc(env(safe-area-inset-bottom)+88px)]">
    <PageHeader title="ລົງຂາຍສິນຄ້າ" />

    <form class="space-y-2" @submit.prevent="submit">
      <!-- Images -->
      <section class="bg-white p-3">
        <div class="flex items-baseline justify-between">
          <h2 class="text-sm font-semibold">ຮູບພາບ <span class="text-red-500">*</span></h2>
          <span class="text-xs text-neutral-400">{{ images.length }}/{{ MAX_IMAGES }} · ຮູບທຳອິດແມ່ນໜ້າປົກ</span>
        </div>
        <div class="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          <div v-for="(img, i) in images" :key="img.key" class="relative size-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
            <img :src="img.preview" alt="" class="size-full object-cover" />
            <span v-if="i === 0" class="absolute inset-x-0 bottom-0 bg-brand/90 py-0.5 text-center text-[10px] font-semibold text-white">ໜ້າປົກ</span>
            <div v-if="img.status === 'uploading'" class="absolute inset-0 grid place-items-center bg-black/40 text-[11px] font-semibold text-white">
              <span class="flex flex-col items-center gap-1"><Loader2 class="size-5 animate-spin" />{{ img.progress }}%</span>
            </div>
            <button v-else-if="img.status === 'error'" type="button" class="absolute inset-0 grid place-items-center bg-red-500/60 text-[11px] font-semibold text-white" @click="upload(img)">
              <span class="flex flex-col items-center gap-1"><AlertCircle class="size-5" />ລອງໃໝ່</span>
            </button>
            <button type="button" class="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white" aria-label="ລຶບຮູບ" @click="removeImage(i)">
              <X class="size-3" />
            </button>
          </div>
          <button
            v-if="images.length < MAX_IMAGES"
            type="button"
            class="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-brand"
            :class="touched && errors.images ? 'border-red-400 bg-red-50' : 'border-brand/40 bg-brand-50'"
            @click="fileInput.click()"
          >
            <ImagePlus class="size-6" /> ເພີ່ມຮູບ
          </button>
        </div>
        <input ref="fileInput" type="file" :accept="ACCEPT.join(',')" multiple class="hidden" @change="onPick" />
      </section>

      <!-- Type -->
      <section class="bg-white p-3">
        <h2 class="text-sm font-semibold">ປະເພດ <span class="text-red-500">*</span></h2>
        <div class="mt-2 grid grid-cols-3 gap-2">
          <label
            v-for="(t, key) in ITEM_TYPES"
            :key="key"
            class="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 py-3 text-xs font-medium transition"
            :class="form.itemType === key ? 'border-brand bg-brand-50 text-brand' : 'border-neutral-200 text-neutral-600'"
          >
            <input v-model="form.itemType" type="radio" :value="key" class="sr-only" />
            <span class="text-2xl">{{ t.emoji }}</span>{{ t.label }}
          </label>
        </div>
      </section>

      <!-- Details -->
      <section class="space-y-3 bg-white p-3">
        <label class="block">
          <span class="text-sm font-semibold">ຊື່ສິນຄ້າ <span class="text-red-500">*</span></span>
          <input v-model="form.title" maxlength="200" placeholder="ເຊັ່ນ: ເຂົ້າມັນໄກ່ ສູດແມ່" :class="[inputCls, borderFor('title')]" />
          <span v-if="touched && errors.title" class="text-xs text-red-500">{{ errors.title }}</span>
        </label>

        <label class="block">
          <span class="text-sm font-semibold">ລາຄາ (₭) <span v-if="form.itemType !== 'FREE'" class="text-red-500">*</span></span>
          <div class="relative">
            <input
              :value="priceDisplay"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              @input="onPriceInput"
              :disabled="form.itemType === 'FREE'"
              :placeholder="form.itemType === 'FREE' ? 'FREE — ແຈກຟຣີ' : '0'"
              :class="[inputCls, borderFor('price'), 'pr-10']"
            />
            <span class="absolute top-1/2 right-3 -translate-y-1/2 pt-1 text-sm text-neutral-400">₭</span>
          </div>
          <span v-if="touched && errors.price" class="text-xs text-red-500">{{ errors.price }}</span>
        </label>

        <div>
          <span class="text-sm font-semibold">ຈຳນວນ <span class="text-red-500">*</span></span>
          <div class="mt-1 flex h-11 w-36 items-center rounded-lg border" :class="borderFor('quantity')">
            <button type="button" class="grid h-full w-10 place-items-center disabled:opacity-30" aria-label="ຫຼຸດຈຳນວນ" :disabled="form.quantity <= 1" @click="form.quantity--">
              <Minus class="size-4" />
            </button>
            <input
              v-model.number="form.quantity"
              type="number"
              inputmode="numeric"
              min="1"
              :max="MAX_QTY"
              aria-label="ຈຳນວນ"
              class="h-full min-w-0 flex-1 bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" class="grid h-full w-10 place-items-center disabled:opacity-30" aria-label="ເພີ່ມຈຳນວນ" :disabled="form.quantity >= MAX_QTY" @click="form.quantity++">
              <Plus class="size-4" />
            </button>
          </div>
          <span v-if="touched && errors.quantity" class="text-xs text-red-500">{{ errors.quantity }}</span>
        </div>

        <label v-if="form.itemType === 'FOOD'" class="block">
          <span class="text-sm font-semibold">ເວລາປິດຮັບອໍເດີ <span class="text-red-500">*</span></span>
          <input v-model="form.orderCutoffTime" type="datetime-local" :class="[inputCls, borderFor('orderCutoffTime')]" />
          <span v-if="touched && errors.orderCutoffTime" class="text-xs text-red-500">{{ errors.orderCutoffTime }}</span>
        </label>

        <label v-else class="relative block">
          <span class="text-sm font-semibold">ສະພາບສິນຄ້າ</span>
          <select v-model="form.condition" :class="[inputCls, 'appearance-none border-neutral-200']">
            <option v-for="c in CONDITIONS" :key="c">{{ c }}</option>
          </select>
          <ChevronDown class="pointer-events-none absolute right-3 bottom-3.5 size-4 text-neutral-400" />
        </label>

        <label class="block">
          <span class="text-sm font-semibold">ຈຸດຮັບເຄື່ອງ <span class="text-red-500">*</span></span>
          <input v-model="form.pickupLocation" list="pickup-locations" maxlength="150" placeholder="ເລືອກ ຫຼື ພິມເອງ" :class="[inputCls, borderFor('pickupLocation')]" />
          <datalist id="pickup-locations">
            <option v-for="loc in PICKUP_LOCATIONS" :key="loc" :value="loc" />
          </datalist>
          <span v-if="touched && errors.pickupLocation" class="text-xs text-red-500">{{ errors.pickupLocation }}</span>
        </label>

        <label class="block">
          <span class="text-sm font-semibold">ລາຍລະອຽດ</span>
          <textarea
            v-model="form.description"
            rows="4"
            maxlength="4500"
            placeholder="ບອກລາຍລະອຽດ, ເວລານັດຮັບ, ເງື່ອນໄຂ..."
            class="mt-1 w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
      </section>

      <div class="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-neutral-200 bg-white px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <button
          type="submit"
          class="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-brand to-coral text-[15px] font-bold text-white shadow-lg shadow-brand/30 disabled:opacity-60"
          :disabled="submitting"
        >
          <Loader2 v-if="submitting || uploading" class="size-5 animate-spin" />
          {{ uploading ? 'ກຳລັງອັບໂຫຼດຮູບ...' : 'ລົງຂາຍເລີຍ' }}
        </button>
      </div>
    </form>
  </div>
</template>
