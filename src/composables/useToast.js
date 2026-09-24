import { reactive } from 'vue'

export const toasts = reactive([])
let id = 0

export function toast(message, type = 'info', duration = 2400) {
  const t = { id: ++id, message, type }
  toasts.push(t)
  setTimeout(() => toasts.splice(toasts.indexOf(t), 1), duration)
}
