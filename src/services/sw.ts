// The app's single service worker (public/firebase-messaging-sw.js, scope "/"): offline app shell
// (PWA) and FCM push. A scope can only have one worker, so both jobs live in the same file.
//
// Files in public/ can't read import.meta.env, so settings travel in the worker's URL. The URL
// must be identical wherever it is registered, or the browser keeps swapping workers.
// Nothing here imports the Firebase SDK; the config fields are public client identifiers.

const env = import.meta.env

function workerUrl(): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({
    apiKey: env.VITE_FIREBASE_API_KEY,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  })) {
    if (value) params.set(key, value)
  }
  // Offline caching only in builds: in dev it would serve stale modules and fight Vite's HMR
  if (env.PROD) params.set('offline', '1')
  return `/firebase-messaging-sw.js?${params}`
}

let ready: Promise<ServiceWorkerRegistration | null> | null = null

/**
 * Register the worker once and resolve with its registration when it is active
 * (PushManager.subscribe fails with "no active Service Worker" before that).
 * Resolves null where service workers are unavailable (http:// other than localhost, old browsers).
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)
  ready ??= navigator.serviceWorker.register(workerUrl()).then(() => navigator.serviceWorker.ready)
  return ready
}
