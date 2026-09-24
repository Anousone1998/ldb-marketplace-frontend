import http, { withFallback } from './http'
import { db, ME, USERS, nextId } from './mock/db'
import { readAsDataURL, unpackDescription } from '@/utils/format'

const httpError = (status, message) => Object.assign(new Error(message), { response: { status, data: { message } } })
const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
const summary = (u) => u && { userId: u.userId, fullName: u.fullName, department: u.department }

function paginate(rows, { page = 1, size = 20 } = {}) {
  return {
    items: rows.slice((page - 1) * size, page * size),
    meta: { page, size, total: rows.length, totalPages: Math.ceil(rows.length / size) },
  }
}

/** Backend Item -> view model (numeric price, thumbnail, parsed description meta). */
export function normalizeItem(raw) {
  if (!raw) return raw
  return {
    ...raw,
    ...unpackDescription(raw.description),
    price: Number(raw.price) || 0,
    images: raw.images ?? [],
    thumbnail: raw.images?.[0] ?? '',
  }
}

function normalizeOrder(raw) {
  return { ...raw, totalAmount: Number(raw.totalAmount) || 0, item: raw.item && normalizeItem(raw.item) }
}

// ---------------------------------------------------------------- auth
export const authApi = {
  /** { userId: 'LDB1067', phoneNumber: '020 2244 6630' } -> { accessToken, user } */
  login(credentials) {
    return withFallback(
      () => http.post('/auth/login', credentials),
      () => ({ accessToken: `mock.${btoa(credentials.userId)}.token`, tokenType: 'Bearer', user: summary(ME) }),
    )
  },
}

// ---------------------------------------------------------------- items
export const itemsApi = {
  /** GET /items?q&itemType&status&sellerId&page&size -> { items, meta } */
  async list(params = {}) {
    const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    const res = await withFallback(
      () => http.get('/items', { params: query }),
      () => {
        const q = (query.q ?? '').toLowerCase()
        const rows = db.items
          .filter(
            (i) =>
              i.status === (query.status ?? 'AVAILABLE') &&
              (!query.itemType || i.itemType === query.itemType) &&
              (!query.sellerId || i.sellerId === query.sellerId) &&
              (!q || `${i.title} ${i.description}`.toLowerCase().includes(q)),
          )
          .map((i) => ({ ...i, seller: summary(i.seller) }))
          .sort(byNewest)
        return paginate(rows, query)
      },
    )
    return { items: res.items.map(normalizeItem), meta: res.meta }
  },

  /** Includes seller.phoneNumber and seller.qrPaymentUrl. */
  async get(id) {
    const raw = await withFallback(
      () => http.get(`/items/${id}`),
      () => db.items.find((i) => i.itemId === Number(id)) ?? Promise.reject(httpError(404, `Item ${id} not found`)),
    )
    return normalizeItem(raw)
  },

  /** All of a seller's items across statuses (the feed endpoint filters one status at a time). */
  async bySeller(sellerId) {
    const pages = await Promise.all(
      ['AVAILABLE', 'RESERVED', 'SOLD'].map((status) => this.list({ sellerId, status, size: 100 })),
    )
    return pages.flatMap((p) => p.items).sort(byNewest)
  },

  /** Body must only contain CreateItemDto fields: the API rejects unknown properties. */
  async create({ title, description, price, itemType, pickupLocation, images }) {
    const body = { title, description, price, itemType, pickupLocation, images }
    const raw = await withFallback(
      () => http.post('/items', body),
      () => {
        const created = { ...body, itemId: nextId(), sellerId: ME.userId, seller: ME, status: 'AVAILABLE', createdAt: new Date().toISOString() }
        db.items.unshift(created)
        return created
      },
    )
    return normalizeItem(raw)
  },

  updateStatus(id, status) {
    return withFallback(
      () => http.patch(`/items/${id}/status`, { status }),
      () => Object.assign(db.items.find((i) => i.itemId === Number(id)), { status }),
    ).then(normalizeItem)
  },
}

// ---------------------------------------------------------------- storage
export const storageApi = {
  /** POST /storage/upload?folder=items|payment-slips|qr-codes -> public URL */
  async upload(file, { folder = 'items', onProgress } = {}) {
    const form = new FormData()
    form.append('file', file)
    const res = await withFallback(
      () =>
        http.post('/storage/upload', form, {
          params: { folder },
          onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
        }),
      async () => ({ imageUrl: await readAsDataURL(file) }),
    )
    return res.imageUrl
  },
}

// ---------------------------------------------------------------- orders
function mockOrderView(o) {
  const item = db.items.find((i) => i.itemId === o.itemId)
  return {
    ...o,
    item: { itemId: item.itemId, title: item.title, itemType: item.itemType, images: item.images, status: item.status },
    buyer: summary(USERS.find((u) => u.userId === o.buyerId)),
    seller: { ...summary(item.seller), phoneNumber: item.seller.phoneNumber, qrPaymentUrl: item.seller.qrPaymentUrl },
  }
}

export const ordersApi = {
  /** POST /orders { itemId, quantity } -> Order (item becomes RESERVED) */
  async create({ itemId, quantity = 1 }) {
    const raw = await withFallback(
      () => http.post('/orders', { itemId, quantity }),
      () => {
        const item = db.items.find((i) => i.itemId === itemId)
        if (item.status !== 'AVAILABLE') throw httpError(409, `Item ${itemId} is no longer available`)
        const order = {
          orderId: nextId(), itemId, buyerId: ME.userId, sellerId: item.sellerId, quantity,
          totalAmount: item.price * quantity, status: 'PENDING', paymentSlipUrl: null, createdAt: new Date().toISOString(),
        }
        db.orders.unshift(order)
        item.status = 'RESERVED'
        return mockOrderView(order)
      },
    )
    return normalizeOrder(raw)
  },

  /** GET /orders?role=buyer|seller -> { items, meta } */
  async list(role) {
    const res = await withFallback(
      () => http.get('/orders', { params: { role, size: 100 } }),
      () => paginate(db.orders.filter((o) => (role === 'seller' ? o.sellerId : o.buyerId) === ME.userId).map(mockOrderView), { size: 100 }),
    )
    return res.items.map(normalizeOrder)
  },

  /** Includes seller.qrPaymentUrl / phoneNumber (the list endpoint omits them). */
  async get(orderId) {
    const raw = await withFallback(
      () => http.get(`/orders/${orderId}`),
      () => mockOrderView(db.orders.find((o) => o.orderId === orderId)),
    )
    return normalizeOrder(raw)
  },

  async attachSlip(orderId, paymentSlipUrl) {
    const raw = await withFallback(
      () => http.patch(`/orders/${orderId}/payment-slip`, { paymentSlipUrl }),
      () => mockOrderView(Object.assign(db.orders.find((o) => o.orderId === orderId), { paymentSlipUrl })),
    )
    return normalizeOrder(raw)
  },

  /** COMPLETED (seller only) or CANCELLED (buyer or seller) */
  async updateStatus(orderId, status) {
    const raw = await withFallback(
      () => http.patch(`/orders/${orderId}/status`, { status }),
      () => {
        const order = Object.assign(db.orders.find((o) => o.orderId === orderId), { status })
        const item = db.items.find((i) => i.itemId === order.itemId)
        item.status = status === 'COMPLETED' ? 'SOLD' : 'AVAILABLE'
        return mockOrderView(order)
      },
    )
    return normalizeOrder(raw)
  },
}

// ---------------------------------------------------------------- chats
const peerOf = (m, me) => (m.senderId === me ? m.receiverId : m.senderId)

export const chatApi = {
  /** GET /chats/conversations -> ConversationSummary[] */
  async conversations() {
    const res = await withFallback(
      () => http.get('/chats/conversations', { params: { size: 100 } }),
      () => {
        const latest = new Map()
        for (const m of db.messages) {
          const key = `${m.itemId}:${peerOf(m, ME.userId)}`
          const row = latest.get(key) ?? { unreadCount: 0 }
          if (m.receiverId === ME.userId && !m.isRead) row.unreadCount++
          if (!row.lastMessageAt || m.createdAt > row.lastMessageAt) {
            const item = db.items.find((i) => i.itemId === m.itemId)
            const peerId = peerOf(m, ME.userId)
            Object.assign(row, {
              itemId: m.itemId, itemTitle: item.title, itemImage: item.images[0], sellerId: item.sellerId,
              peerId, peerName: USERS.find((u) => u.userId === peerId)?.fullName,
              lastMessageId: m.messageId, lastMessageText: m.messageText, lastSenderId: m.senderId, lastMessageAt: m.createdAt,
            })
          }
          latest.set(key, row)
        }
        return paginate([...latest.values()], { size: 100 })
      },
    )
    return res.items
  },

  /** GET /chats/history?itemId&peerId -> { messages (oldest first), hasMore, nextBeforeId } */
  history({ itemId, peerId, beforeId }) {
    return withFallback(
      () => http.get('/chats/history', { params: { itemId, peerId, beforeId, limit: 50 } }),
      () => ({
        itemId,
        peerId,
        messages: db.messages.filter((m) => m.itemId === itemId && peerOf(m, ME.userId) === peerId),
        hasMore: false,
        nextBeforeId: null,
      }),
    )
  },

  markRead({ itemId, peerId }) {
    return withFallback(
      () => http.patch('/chats/read', { itemId, peerId }),
      () => {
        db.messages.forEach((m) => m.itemId === itemId && m.senderId === peerId && (m.isRead = true))
        return { itemId, peerId }
      },
    )
  },

  /** Offline mode only: persist a message into the mock DB. */
  mockSend(message) {
    const saved = { ...message, messageId: nextId(), isRead: false, createdAt: new Date().toISOString() }
    db.messages.push(saved)
    return saved
  },
}

export { USERS as MOCK_USERS }
