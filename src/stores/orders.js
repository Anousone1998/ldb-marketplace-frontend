import { defineStore } from 'pinia'
import { ordersApi, storageApi } from '@/api'

export const useOrdersStore = defineStore('orders', {
  state: () => ({ purchases: [], sales: [], loaded: false }),

  getters: {
    /** Orders waiting on me: purchases I still have to pay, sales I have to handle. */
    actionCount: (s) =>
      s.purchases.filter((o) => o.status === 'PENDING' && o.totalAmount > 0 && !o.paymentSlipUrl).length +
      s.sales.filter((o) => o.status === 'PENDING').length,
  },

  actions: {
    async load() {
      const [purchases, sales] = await Promise.all([ordersApi.list('buyer'), ordersApi.list('seller')])
      this.purchases = purchases
      this.sales = sales
      this.loaded = true
    },

    upsert(order) {
      for (const list of [this.purchases, this.sales]) {
        const i = list.findIndex((o) => o.orderId === order.orderId)
        if (i !== -1) list[i] = { ...list[i], ...order }
      }
    },

    async place(item, quantity) {
      const order = await ordersApi.create({ itemId: item.itemId, quantity })
      this.purchases.unshift(order)
      return order
    },

    async uploadSlip(orderId, file) {
      const url = await storageApi.upload(file, { folder: 'payment-slips' })
      const order = await ordersApi.attachSlip(orderId, url)
      this.upsert(order)
      return order
    },

    async setStatus(orderId, status) {
      const order = await ordersApi.updateStatus(orderId, status)
      this.upsert(order)
      return order
    },
  },
})
