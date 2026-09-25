<script setup>
import { computed } from 'vue'
import { MapPin, Clock } from 'lucide-vue-next'
import SellerAvatar from './SellerAvatar.vue'
import { ITEM_TYPES, formatPrice, formatTime } from '@/utils/format'

const props = defineProps({ item: { type: Object, required: true } })

const type = computed(() => ITEM_TYPES[props.item.itemType] ?? ITEM_TYPES.SECOND_HAND)
const unavailable = computed(() => props.item.status !== 'AVAILABLE')
const isFree = computed(() => formatPrice(props.item) === 'FREE')
</script>

<template>
  <RouterLink
    :to="`/items/${item.itemId}`"
    class="block overflow-hidden rounded-lg bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition active:scale-[0.98]"
  >
    <div class="relative aspect-square bg-neutral-100">
      <img :src="item.thumbnail" :alt="item.title" loading="lazy" class="size-full object-cover" />

      <span class="absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold shadow-sm" :class="type.badge">
        {{ type.emoji }} {{ type.label }}
      </span>

      <span
        v-if="item.itemType === 'FOOD' && item.orderCutoffTime && !unavailable"
        class="absolute bottom-0 left-0 flex items-center gap-1 rounded-tr-lg bg-linear-to-r from-brand to-accent px-1.5 py-0.5 text-[10px] font-semibold text-white"
      >
        <Clock class="size-3" /> PRE-ORDER · ປິດ {{ formatTime(item.orderCutoffTime) }}
      </span>

      <div v-if="unavailable" class="absolute inset-0 grid place-items-center bg-black/45">
        <span class="-rotate-12 rounded border-2 border-white px-3 py-1 text-xs font-extrabold tracking-[0.2em] text-white">
          {{ item.status }}
        </span>
      </div>
    </div>

    <div class="space-y-1 p-2">
      <h3 class="line-clamp-2 min-h-[2.6em] text-[13px] leading-[1.3] text-neutral-800">{{ item.title }}</h3>

      <p class="text-base leading-tight font-bold" :class="isFree ? 'text-emerald-500' : 'text-brand'">
        <span v-if="isFree" class="rounded bg-linear-to-r from-emerald-500 to-pink-500 bg-clip-text text-transparent">FREE</span>
        <template v-else>{{ formatPrice(item) }}</template>
      </p>

      <span class="inline-flex max-w-full items-center gap-0.5 rounded bg-brand-50 px-1 py-0.5 text-[10px] text-brand-600">
        <MapPin class="size-3 shrink-0" />
        <span class="truncate">{{ item.pickupLocation }}</span>
      </span>

      <div class="flex items-center gap-1 pt-0.5 text-[11px] text-neutral-500">
        <SellerAvatar v-if="item.seller" :user="item.seller" />
        <span class="truncate">{{ item.seller?.fullName }}<template v-if="item.seller?.department"> ({{ item.seller.department }})</template></span>
      </div>
    </div>
  </RouterLink>
</template>
