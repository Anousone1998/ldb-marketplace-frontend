# Office Market — Internal Corporate Marketplace (frontend)

Mobile-first Vue 3 + Vite + Tailwind v4 + Pinia storefront, Lazada-style, for the
`ldb-marketplace-backend` NestJS API.

```bash
npm install
cp .env.example .env   # adjust URLs if needed
npm run dev            # http://localhost:5173
```

| Env var | Default | |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | REST base |
| `VITE_WS_URL` | `http://localhost:3000` | Socket.io origin (`/chat` namespace appended) |
| `VITE_USE_MOCK` | `false` | `true` = never hit the backend |

**Mock fallback:** if the backend is unreachable (network error / 502–504), every call
resolves from the in-memory DB in `src/api/mock/db.js` and a `DEMO` pill appears in the header.
Real 4xx/5xx errors are shown to the user, never masked. Mock data resets on page reload.

## Structure

```
src/api/http.js          Axios instance, JWT interceptor, 401 → logout, withFallback()
src/api/index.js         authApi / itemsApi / storageApi / ordersApi / chatApi + normalizers
src/services/socket.js   socket.io-client singleton for /chat
src/stores/              auth, orders (purchases + sales), chat (inbox, rooms, unread)
src/views/               Home, ItemDetail, PostItem, ChatList, ChatRoom, Profile, Login
```

## Backend contract notes

- **Login:** `POST /auth/login { userId, phoneNumber }` (employee ID + HR phone number).
- **Payment:** there is no gateway. The buyer places an order (item → `RESERVED`), pays using the
  seller's `qrPaymentUrl` image, then uploads a slip (`PATCH /orders/:id/payment-slip`).
  The seller completes (`COMPLETED`, item → `SOLD`) or either side cancels.
- **Chat:** conversations are keyed by `(itemId, peerId)`. A buyer opens `/chats/:itemId`;
  a seller opens `/chats/:itemId?peer=<buyerId>`. Socket events: `joinChat`, `leaveChat`,
  `sendMessage`, `markAsRead` → `newMessage`, `messagesRead`. Messages are text only, so image
  attachments are sent as the uploaded image URL and rendered as images.
- **Cutoff time / condition:** `CreateItemDto` has no fields for these and the API rejects
  unknown properties, so they are stored as `[cutoff] <ISO>` / `[condition] …` lines at the end of
  `description` and parsed back out (`packDescription` / `unpackDescription` in `utils/format.js`).
  Replace this once the backend gets real columns.
- **Location filter & price sort** run client-side on the loaded pages, because `GET /items`
  only supports `q`, `itemType`, `status`, `sellerId`, `page`, `size`.
