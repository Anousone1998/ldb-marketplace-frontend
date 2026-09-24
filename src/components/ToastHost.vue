<script setup>
import { toasts } from '@/composables/useToast'
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-16 z-[100] mx-auto flex max-w-md flex-col items-center gap-2 px-6">
      <TransitionGroup
        enter-from-class="opacity-0 -translate-y-2"
        leave-to-class="opacity-0"
        enter-active-class="transition duration-200"
        leave-active-class="transition duration-200"
      >
        <div
          v-for="t in toasts"
          :key="t.id"
          class="rounded-full px-4 py-2 text-center text-[13px] font-medium text-white shadow-lg"
          :class="{ 'bg-neutral-900/85': t.type === 'info', 'bg-emerald-600': t.type === 'success', 'bg-red-600': t.type === 'error' }"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
