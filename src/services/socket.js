import { io } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'
let socket = null

/** Singleton connection to the `/chat` namespace, authenticated with the JWT. */
export function connectChatSocket(token) {
  if (socket) return socket
  socket = io(`${WS_URL}/chat`, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 3,
    reconnectionDelay: 2000,
  })
  return socket
}

export function disconnectChatSocket() {
  socket?.disconnect()
  socket = null
}
