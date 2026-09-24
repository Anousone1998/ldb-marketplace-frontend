export const ITEM_TYPES = {
  FOOD: { label: 'ອາຫານ', emoji: '🍱', badge: 'bg-orange-500 text-white' },
  SECOND_HAND: { label: 'ມືສອງ', emoji: '📱', badge: 'bg-indigo-600 text-white' },
  FREE: { label: 'ແຈກຟຣີ', emoji: '🎁', badge: 'bg-emerald-500 text-white' },
}

export const PICKUP_LOCATIONS = [
  'ຕຶກໃຫຍ່',
  'ຕຶກ IT',
  'Pantry ຊັ້ນ 2',
  'Pantry ຊັ້ນ 3',
  'Pantry ຊັ້ນ 4',
  'ລານຈອດລົດ',
]

export const CONDITIONS = ['ໃໝ່ (ບໍ່ເຄີຍໃຊ້)', 'ດີຫຼາຍ (90%+)', 'ດີ (70-90%)', 'ພໍໃຊ້ໄດ້']

export const ORDER_STATUS = {
  PENDING: { label: 'ລໍຖ້າດຳເນີນການ', cls: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'ສຳເລັດ', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'ຍົກເລີກ', cls: 'bg-red-100 text-red-600' },
}

/** Finer-grained label for a PENDING order, depending on who is looking. */
export function orderStage(order, role) {
  if (order.status !== 'PENDING') return ORDER_STATUS[order.status] ?? { label: order.status, cls: 'bg-neutral-100 text-neutral-600' }
  if (!(order.totalAmount > 0)) return { label: 'ຈອງແລ້ວ · ລໍຖ້າຮັບ', cls: 'bg-sky-100 text-sky-700' }
  if (!order.paymentSlipUrl) return { label: role === 'seller' ? 'ລໍຖ້າລູກຄ້າໂອນ' : 'ລໍຖ້າຊຳລະ', cls: 'bg-amber-100 text-amber-700' }
  return { label: role === 'seller' ? 'ກວດສອບສະລິບ' : 'ສົ່ງສະລິບແລ້ວ', cls: 'bg-sky-100 text-sky-700' }
}

// The backend has no columns for pre-order cutoff or item condition, so they travel
// as tagged lines at the end of `description` and are parsed back out for display.
const META_RE = /^\[(cutoff|condition)\]\s*(.+)$/gm

export function packDescription(text, { orderCutoffTime, condition } = {}) {
  const lines = [text.trim()]
  if (orderCutoffTime) lines.push(`[cutoff] ${orderCutoffTime}`)
  if (condition) lines.push(`[condition] ${condition}`)
  return lines.filter(Boolean).join('\n')
}

export function unpackDescription(description) {
  const meta = {}
  const text = (description ?? '').replace(META_RE, (_, key, value) => {
    meta[key === 'cutoff' ? 'orderCutoffTime' : 'condition'] = value.trim()
    return ''
  })
  return { description: text.trim(), ...meta }
}

export const isImageMessage = (text) =>
  /^(https?:\/\/\S+\.(png|jpe?g|webp|gif)(\?\S*)?|data:image\/\S+)$/i.test((text ?? '').trim())

export function formatKip(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('en-US')} ₭`
}

export function formatPrice(item) {
  return item.itemType === 'FREE' || !item.price ? 'FREE' : formatKip(item.price)
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'ຫາກໍ່ນີ້'
  if (diff < 3600) return `${Math.floor(diff / 60)} ນາທີກ່ອນ`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ຊົ່ວໂມງກ່ອນ`
  return `${Math.floor(diff / 86400)} ມື້ກ່ອນ`
}

/** "01:23:45" until `iso`, or null when already passed. */
export function countdown(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const s = Math.floor(ms / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

const AVATAR_COLORS = ['#F85606', '#6366F1', '#10B981', '#EC4899', '#0EA5E9', '#8B5CF6', '#F59E0B']

export function avatarColor(seed = '') {
  let h = 0
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
