<script setup>
defineProps({
  count: { type: Number, default: 0 },
  inverted: { type: Boolean, default: false },
})
</script>

<template>
  <span
    v-if="count > 0"
    class="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] leading-none font-bold ring-2"
    :class="inverted ? 'bg-white text-brand ring-brand' : 'bg-red-500 text-white ring-white'"
  >
    {{ count > 99 ? '99+' : count }}
  </span>
</template>
