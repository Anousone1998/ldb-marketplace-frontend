<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IdCard, Phone, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToast'
import { errorMessage } from '@/api/http'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ userId: '', phoneNumber: '' })
const busy = ref(false)

async function submit() {
  busy.value = true
  try {
    await auth.login({ userId: form.userId.trim(), phoneNumber: form.phoneNumber.trim() })
    router.replace(route.query.redirect || '/')
  } catch (e) {
    toast(errorMessage(e, 'ລະຫັດພະນັກງານ ຫຼື ເບີໂທບໍ່ຖືກຕ້ອງ'), 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-linear-to-br from-brand via-[#ff4a3a] to-coral">
    <div class="flex flex-1 flex-col items-center justify-center px-6 pt-10 text-white">
      <div class="grid size-20 place-items-center rounded-3xl bg-white/20 text-4xl shadow-lg backdrop-blur">🛍️</div>
      <h1 class="mt-4 text-2xl font-extrabold">Office Market</h1>
      <p class="mt-1 text-sm opacity-90">ຕະຫຼາດພາຍໃນອົງກອນ · ຊື້-ຂາຍ-ແຈກ ກັບໝູ່ຮ່ວມງານ</p>
    </div>

    <form class="space-y-3 rounded-t-3xl bg-white px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+32px)]" @submit.prevent="submit">
      <h2 class="text-lg font-bold">ເຂົ້າສູ່ລະບົບ</h2>
      <label class="flex h-12 items-center gap-2 rounded-xl border border-neutral-200 px-3 focus-within:border-brand">
        <IdCard class="size-5 text-neutral-400" />
        <input v-model="form.userId" required maxlength="50" autocomplete="username" autocapitalize="characters" placeholder="ລະຫັດພະນັກງານ (ເຊັ່ນ LDB1067)" class="flex-1 text-sm outline-none" />
      </label>
      <label class="flex h-12 items-center gap-2 rounded-xl border border-neutral-200 px-3 focus-within:border-brand">
        <Phone class="size-5 text-neutral-400" />
        <input v-model="form.phoneNumber" required type="tel" inputmode="tel" autocomplete="tel" placeholder="ເບີໂທທີ່ລົງທະບຽນກັບ HR (020 ...)" class="flex-1 text-sm outline-none" />
      </label>
      <button
        class="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-brand to-coral font-bold text-white shadow-lg shadow-brand/30 disabled:opacity-60"
        :disabled="busy"
      >
        <Loader2 v-if="busy" class="size-5 animate-spin" /> ເຂົ້າສູ່ລະບົບ
      </button>
      <p class="text-center text-[11px] text-neutral-400">ຖ້າເຊື່ອມຕໍ່ Server ບໍ່ໄດ້ ລະບົບຈະເຂົ້າໂໝດ Demo ອັດຕະໂນມັດ</p>
    </form>
  </div>
</template>
