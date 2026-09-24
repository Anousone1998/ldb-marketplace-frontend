import { defineStore } from 'pinia'
import { chatApi } from '@/api'
import { apiState } from '@/api/http'
import { connectChatSocket } from '@/services/socket'
import { useAuthStore } from './auth'

/**
 * Socket.io contract of the `/chat` namespace (see backend chats.gateway.ts)
 * client -> server: joinChat / leaveChat / markAsRead { itemId, peerId? }, sendMessage { itemId, receiverId, messageText }
 * server -> client: newMessage (Message), messagesRead { itemId, readerId, peerId, readAt }, exception
 * Acks are `{ status: 'ok', ... }` or `{ status: 'error', statusCode, message }`.
 */
export const EVENTS = {
  JOIN: 'joinChat',
  LEAVE: 'leaveChat',
  SEND: 'sendMessage',
  READ: 'markAsRead',
  NEW: 'newMessage',
  READ_RECEIPT: 'messagesRead',
}

export const convKey = (itemId, peerId) => `${itemId}:${peerId}`

// Non-reactive handle kept outside Pinia state
let socket = null

const MOCK_REPLIES = ['ສະບາຍດີເດີ້! ຍັງມີຢູ່ ສົນໃຈບໍ່? 😊', 'ໄດ້ເລີຍ ມາຮັບຕາມຈຸດນັດໄດ້ເລີຍ 🙏', 'ໂອເຄ ເດີ້ ຂອບໃຈຫຼາຍໆ']

function emitAck(event, payload) {
  return new Promise((resolve, reject) =>
    socket.timeout(8000).emit(event, payload, (err, res) => {
      if (err) reject(err)
      else if (res?.status === 'error') reject(Object.assign(new Error([res.message].flat()[0]), res))
      else resolve(res)
    }),
  )
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    /** key -> { key, itemId, peerId, peerName, itemTitle, itemImage, sellerId, messages, unread, loaded, typing, hasMore, nextBeforeId } */
    conversations: {},
    activeKey: null,
    connected: false,
    initialized: false,
  }),

  getters: {
    list: (s) =>
      Object.values(s.conversations)
        .filter((c) => c.messages.length || c.lastMessageAt)
        .sort((a, b) => new Date(b.lastMessageAt ?? 0) - new Date(a.lastMessageAt ?? 0)),
    totalUnread: (s) => Object.values(s.conversations).reduce((n, c) => n + c.unread, 0),
  },

  actions: {
    me() {
      return useAuthStore().user?.userId
    },

    async init() {
      if (this.initialized) return
      this.initialized = true

      socket = connectChatSocket(useAuthStore().token)
      socket.on('connect', () => {
        this.connected = true
        const active = this.conversations[this.activeKey]
        if (active) socket.emit(EVENTS.JOIN, { itemId: active.itemId, peerId: active.peerId })
      })
      socket.on('disconnect', () => (this.connected = false))
      socket.on('connect_error', (err) => console.warn('[chat] socket:', err.message))
      socket.on(EVENTS.NEW, (msg) => this.receive(msg))
      socket.on(EVENTS.READ_RECEIPT, ({ itemId, readerId }) => {
        // The peer read my messages
        const conv = this.conversations[convKey(itemId, readerId)]
        conv?.messages.forEach((m) => m.senderId === this.me() && (m.isRead = true))
      })

      await this.refreshInbox()
    },

    async refreshInbox() {
      try {
        for (const row of await chatApi.conversations()) {
          const conv = this.ensure(row)
          if (this.activeKey !== conv.key) conv.unread = row.unreadCount
          Object.assign(conv, { lastMessageText: row.lastMessageText, lastSenderId: row.lastSenderId, lastMessageAt: row.lastMessageAt })
        }
      } catch (e) {
        console.warn('[chat] could not load conversations', e)
      }
    },

    /** Create (or update the metadata of) a conversation entry. */
    ensure({ itemId, peerId, peerName, itemTitle, itemImage, sellerId }) {
      const key = convKey(itemId, peerId)
      const conv = (this.conversations[key] ??= {
        key, itemId, peerId, messages: [], unread: 0, loaded: false, typing: false, hasMore: false, nextBeforeId: null,
      })
      for (const [k, v] of Object.entries({ peerName, itemTitle, itemImage, sellerId })) if (v != null) conv[k] = v
      return conv
    },

    async openRoom({ item, peerId, peerName }) {
      const conv = this.ensure({
        itemId: item.itemId, peerId, peerName, itemTitle: item.title, itemImage: item.thumbnail, sellerId: item.sellerId ?? item.seller?.userId,
      })
      this.activeKey = conv.key
      conv.unread = 0

      if (!conv.loaded) {
        const { messages, hasMore, nextBeforeId } = await chatApi.history({ itemId: conv.itemId, peerId })
        const known = new Set(conv.messages.map((m) => m.messageId))
        conv.messages = [...messages.filter((m) => !known.has(m.messageId)), ...conv.messages]
        Object.assign(conv, { loaded: true, hasMore, nextBeforeId })
      }

      // joinChat also marks the peer's messages as read on the server
      if (this.connected) socket.emit(EVENTS.JOIN, { itemId: conv.itemId, peerId })
      else chatApi.markRead({ itemId: conv.itemId, peerId }).catch(() => {})
      return conv
    },

    async loadOlder(key) {
      const conv = this.conversations[key]
      if (!conv?.hasMore) return
      const { messages, hasMore, nextBeforeId } = await chatApi.history({ itemId: conv.itemId, peerId: conv.peerId, beforeId: conv.nextBeforeId })
      conv.messages.unshift(...messages)
      Object.assign(conv, { hasMore, nextBeforeId })
    },

    leaveRoom() {
      const conv = this.conversations[this.activeKey]
      if (conv && this.connected) socket.emit(EVENTS.LEAVE, { itemId: conv.itemId, peerId: conv.peerId })
      this.activeKey = null
    },

    async send(key, messageText) {
      const conv = this.conversations[key]
      conv.messages.push({
        messageId: `tmp-${Date.now()}`,
        itemId: conv.itemId,
        senderId: this.me(),
        receiverId: conv.peerId,
        messageText,
        isRead: false,
        createdAt: new Date().toISOString(),
        status: 'sending',
      })
      const pending = conv.messages.at(-1) // reactive proxy
      this.touch(conv, pending)

      if (this.connected) {
        try {
          const { message } = await emitAck(EVENTS.SEND, { itemId: conv.itemId, receiverId: conv.peerId, messageText })
          // `newMessage` may already have reconciled this bubble; otherwise do it now
          const dup = conv.messages.find((m) => m !== pending && m.messageId === message.messageId)
          if (dup) conv.messages.splice(conv.messages.indexOf(pending), 1)
          else Object.assign(pending, message, { status: 'sent' })
        } catch (e) {
          pending.status = 'failed'
          throw e
        }
      } else if (apiState.mock) {
        Object.assign(pending, chatApi.mockSend(pending), { status: 'sent' })
        this.simulateReply(conv)
      } else {
        pending.status = 'failed'
        throw new Error('Chat is not connected')
      }
    },

    receive(msg) {
      const me = this.me()
      const peerId = msg.senderId === me ? msg.receiverId : msg.senderId
      const conv = this.ensure({
        itemId: msg.itemId, peerId,
        peerName: msg.senderId === me ? msg.receiver?.fullName : msg.sender?.fullName,
        itemTitle: msg.item?.title, itemImage: msg.item?.images?.[0], sellerId: msg.item?.sellerId,
      })
      if (conv.messages.some((m) => m.messageId === msg.messageId)) return

      if (msg.senderId === me) {
        // Echo of my own message (maybe from another device): reconcile the optimistic bubble
        const pending = conv.messages.find((m) => m.status === 'sending' && m.messageText === msg.messageText)
        if (pending) Object.assign(pending, msg, { status: 'sent' })
        else conv.messages.push({ ...msg, status: 'sent' })
      } else {
        conv.typing = false
        conv.messages.push({ ...msg, status: 'sent' })
        if (this.activeKey === conv.key && !document.hidden) {
          if (this.connected) socket.emit(EVENTS.READ, { itemId: conv.itemId, peerId })
        } else {
          conv.unread++
        }
      }
      this.touch(conv, msg)
    },

    touch(conv, msg) {
      Object.assign(conv, { lastMessageText: msg.messageText, lastSenderId: msg.senderId, lastMessageAt: msg.createdAt })
    },

    /** Offline demo only: the peer "types" and replies. */
    simulateReply(conv) {
      setTimeout(() => (conv.typing = true), 600)
      setTimeout(() => {
        const n = conv.messages.filter((m) => m.senderId === conv.peerId).length
        this.receive(chatApi.mockSend({ itemId: conv.itemId, senderId: conv.peerId, receiverId: this.me(), messageText: MOCK_REPLIES[n % MOCK_REPLIES.length] }))
      }, 1800)
    },
  },
})
