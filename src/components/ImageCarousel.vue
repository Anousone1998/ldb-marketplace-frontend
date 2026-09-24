<script setup>
import { ref } from 'vue'

defineProps({ images: { type: Array, default: () => [] } })
const track = ref(null)
const index = ref(0)

function onScroll() {
  const el = track.value
  index.value = Math.round(el.scrollLeft / el.clientWidth)
}

function goTo(i) {
  track.value.scrollTo({ left: i * track.value.clientWidth, behavior: 'smooth' })
}
</script>

<template>
  <div class="relative aspect-square bg-neutral-200">
    <div ref="track" class="no-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto" @scroll.passive="onScroll">
      <img v-for="(src, i) in images" :key="i" :src="src" alt="" class="size-full shrink-0 snap-center object-cover" />
    </div>

    <div v-if="images.length > 1" class="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
      <button
        v-for="(_, i) in images"
        :key="i"
        class="h-1.5 rounded-full transition-all"
        :class="i === index ? 'w-4 bg-brand' : 'w-1.5 bg-white/70'"
        :aria-label="`ຮູບທີ ${i + 1}`"
        @click="goTo(i)"
      />
    </div>
    <span class="absolute right-3 bottom-3 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white">
      {{ index + 1 }}/{{ images.length || 1 }}
    </span>
    <slot />
  </div>
</template>
