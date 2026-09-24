<script setup>
import { computed } from 'vue'
import { avatarColor } from '@/utils/format'

const props = defineProps({
  user: { type: Object, required: true },
  size: { type: String, default: 'size-5 text-[10px]' },
})
const initial = computed(() => [...(props.user.fullName ?? '?')][0])
</script>

<template>
  <span
    class="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
    :class="size"
    :style="{ backgroundColor: avatarColor(user.userId) }"
  >
    {{ initial }}
  </span>
</template>
