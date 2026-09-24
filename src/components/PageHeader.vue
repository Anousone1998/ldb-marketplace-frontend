<script setup>
import { useRouter } from 'vue-router'
import { ChevronLeft } from 'lucide-vue-next'

defineProps({ title: String })
const router = useRouter()
const back = () => (window.history.state?.back ? router.back() : router.push('/'))
</script>

<template>
  <header class="sticky top-0 z-30 flex h-12 items-center gap-1 border-b border-neutral-200 bg-white px-1 pt-[env(safe-area-inset-top)]">
    <button class="grid size-10 place-items-center rounded-full text-neutral-700 active:bg-neutral-100" aria-label="ກັບຄືນ" @click="back">
      <ChevronLeft class="size-6" />
    </button>
    <slot>
      <h1 class="text-[15px] font-semibold">{{ title }}</h1>
    </slot>
    <div class="ml-auto flex items-center pr-2"><slot name="right" /></div>
  </header>
</template>
