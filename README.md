# Office Market — Internal Corporate Marketplace (frontend)

Mobile-first Vue 3 + Vite + Tailwind v4 + Pinia storefront, Lazada-style, for the
`ldb-marketplace-backend` NestJS API.

```bash
npm install
cp .env.example .env   # shared settings (Firebase, mock flag)
npm run dev            # http://localhost:5173 → API http://localhost:3001
```

| Mode | Command | Env file | API |
|---|---|---|---|
| development | `npm run dev` | `.env.development` | `http://localhost:3001/api/v1` |
| uat | `npm run build:uat` (`dev:uat`, `preview:uat`) | `.env.uat` | *to be set* |
| production | `npm run build` | `.env.production` | `https://api-market.spizfrog.com/api/v1` |

Vite loads `.env` first, then `.env.<mode>` on top. A build stops with an error if the mode has no
`VITE_API_BASE_URL`, so a UAT build can't ship pointing nowhere. Machine-specific overrides go in
`.env.local` / `.env.<mode>.local` (git-ignored).

| Env var | | |
|---|---|---|
| `VITE_API_BASE_URL` | per mode | REST base. A relative `/api/v1` goes through the Vite dev proxy (`API_PROXY_TARGET`, default `http://localhost:3001`) |
| `VITE_WS_URL` | per mode | Socket.io origin (`/chat` namespace appended); empty = page origin |
| `VITE_USE_MOCK` | `.env` | `true` = never hit the backend |
| `VITE_FIREBASE_*` | `.env` | Cloud Messaging only (push) |

**Mock fallback:** if the backend is unreachable (network error / 502–504), every call
resolves from the in-memory DB in `src/api/mock/db.js` and a `DEMO` pill appears in the header.
Real 4xx/5xx errors are shown to the user, never masked. Mock data resets on page reload.

## PWA & push

- `public/manifest.webmanifest` + `public/icons/` (192/512, maskable 512, apple-touch 180, badge 96):
  installable on Android/desktop Chrome and "Add to Home Screen" on iOS (required there for push).
- `public/firebase-messaging-sw.js` is the **only** service worker (a scope can have one): offline
  app shell *and* FCM. `src/services/sw.ts` registers it at start-up with its settings in the URL;
  `src/services/firebase.ts` reuses that registration for push.
- Offline caching is on only in builds (`offline=1`): pages are network-first with the cached shell
  as fallback, `/assets/*` cache-first. API, socket and image hosts are never cached.
  Test it with `npm run build && npm run preview`, not `npm run dev`.

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
