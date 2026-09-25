<script setup>
import { ref } from 'vue'
import { QrCode, Upload, Trash2, Loader2 } from 'lucide-vue-next'
import { storageApi, usersApi } from '@/api'
import { errorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToast'

const MAX_SIZE_MB = 5 // backend limit
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

const auth = useAuthStore()
const fileInput = ref(null)
const busy = ref(false)
const progress = ref(0)

async function save(qrPaymentUrl, successText) {
  const profile = await usersApi.updatePaymentQr(qrPaymentUrl)
  auth.setProfile({ qrPaymentUrl: profile.qrPaymentUrl ?? null })
  toast(successText, 'success')
}

async function onPick(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (!ACCEPT.includes(file.type)) return toast('ຮອງຮັບສະເພາະ JPG, PNG, WEBP', 'error')
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return toast(`ຮູບໃຫຍ່ເກີນ ${MAX_SIZE_MB}MB`, 'error')

  busy.value = true
  progress.value = 0
  try {
    const url = await storageApi.upload(file, { folder: 'qr-codes', onProgress: (p) => (progress.value = p) })
    await save(url, 'ບັນທຶກ QR ແລ້ວ ✅')
  } catch (e) {
    toast(errorMessage(e, 'ອັບໂຫຼດ QR ບໍ່ສຳເລັດ'), 'error')
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (!confirm('ລຶບ QR ຊຳລະເງິນ? ຜູ້ຊື້ຈະຕ້ອງຈ່າຍເງິນສົດເມື່ອຮັບເຄື່ອງ')) return
  busy.value = true
  try {
    await save(null, 'ລຶບ QR ແລ້ວ')
  } catch (e) {
    toast(errorMessage(e, 'ລຶບ QR ບໍ່ສຳເລັດ'), 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
    <a
      v-if="auth.user.qrPaymentUrl"
      :href="auth.user.qrPaymentUrl"
      target="_blank"
      class="relative size-16 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white"
      aria-label="ເບິ່ງ QR ເຕັມ"
    >
      <img :src="auth.user.qrPaymentUrl" alt="QR ຊຳລະເງິນ" class="size-full object-contain" />
    </a>
    <div v-else class="grid size-16 shrink-0 place-items-center rounded-lg border-2 border-dashed border-brand/40 bg-brand-50 text-brand">
      <QrCode class="size-7" />
    </div>

    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold">QR ຊຳລະເງິນ</p>
      <p class="text-[11px] leading-snug text-neutral-500">
        {{ auth.user.qrPaymentUrl ? 'ຜູ້ຊື້ຈະເຫັນ QR ນີ້ຕອນຊຳລະເງິນ' : 'ອັບໂຫຼດ QR ທະນາຄານ ເພື່ອໃຫ້ຜູ້ຊື້ໂອນເງິນໄດ້' }}
      </p>
      <div class="mt-1.5 flex gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          :disabled="busy"
          @click="fileInput.click()"
        >
          <Loader2 v-if="busy" class="size-3.5 animate-spin" />
          <Upload v-else class="size-3.5" />
          {{ busy ? (progress < 100 ? `${progress}%` : 'ກຳລັງບັນທຶກ...') : auth.user.qrPaymentUrl ? 'ປ່ຽນ QR' : 'ອັບໂຫຼດ QR' }}
        </button>
        <button
          v-if="auth.user.qrPaymentUrl && !busy"
          type="button"
          class="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600"
          @click="remove"
        >
          <Trash2 class="size-3.5" /> ລຶບ
        </button>
      </div>
    </div>
    <input ref="fileInput" type="file" :accept="ACCEPT.join(',')" class="hidden" @change="onPick" />
  </section>
</template>
