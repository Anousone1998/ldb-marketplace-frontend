import { readonly, ref } from 'vue'
import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type MessagePayload, type Messaging } from 'firebase/messaging'
import { registerServiceWorker } from './sw'
import { usersApi } from '@/api'

// FCM only: no other Firebase product (Storage, Firestore, Analytics, Auth…) is imported or
// configured, so nothing here can incur Firebase charges. Cloud Messaging itself is free.

const env = import.meta.env

/** Only the fields Cloud Messaging needs. */
export const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY ?? ''
// A Web Push public key is ~88 base64url chars starting with "B"; catches e.g. an Analytics ID ("G-…") pasted by mistake
const vapidValid = /^B[A-Za-z0-9_-]{80,}$/.test(VAPID_KEY)
if (VAPID_KEY && !vapidValid) console.warn('[firebase] VITE_FIREBASE_VAPID_KEY is not a Web Push public key; push is disabled')

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId && vapidValid,
)

let app: FirebaseApp | null = null
let messaging: Messaging | null = null

/** Lazily created singleton; nothing touches Firebase until push is actually used. */
export function getFirebaseApp(): FirebaseApp {
  app ??= initializeApp(firebaseConfig)
  return app
}

/** Cloud Messaging for this browser, or null when it isn't configured or supported (e.g. iOS Safari outside a Home Screen app). */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!firebaseConfigured || !('serviceWorker' in navigator) || !('Notification' in window)) return null
  if (!(await isSupported())) return null
  messaging ??= getMessaging(getFirebaseApp())
  return messaging
}


/**
 * Ask for notification permission and return this device's FCM token (send it to the backend).
 * Returns null when push is unavailable or the user declines.
 * Call it from a user gesture (a button tap): browsers block permission prompts otherwise.
 */
export async function requestFcmToken(): Promise<string | null> {
  const msg = await getFirebaseMessaging()
  if (!msg) return null
  if ((await Notification.requestPermission()) !== 'granted') return null
  const serviceWorkerRegistration = await registerServiceWorker()
  if (!serviceWorkerRegistration) return null
  return getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration })
}

/** Stop push for this device (e.g. on logout). */
export async function revokeFcmToken(): Promise<void> {
  const msg = await getFirebaseMessaging()
  if (msg && Notification.permission === 'granted') await deleteToken(msg).catch(() => {})
}

/**
 * While the app is open and focused, FCM delivers messages here instead of showing a system
 * notification. Returns an unsubscribe function.
 */
export async function onForegroundMessage(handler: (payload: MessagePayload) => void): Promise<() => void> {
  const msg = await getFirebaseMessaging()
  return msg ? onMessage(msg, handler) : () => {}
}

// ---------------------------------------------------------------- Vue composable
type PushStatus = 'idle' | 'enabling' | 'enabled' | 'denied' | 'unsupported' | 'error'

const token = ref<string | null>(null)
const status = ref<PushStatus>('idle')
const permission = ref<NotificationPermission | 'unsupported'>('Notification' in window ? Notification.permission : 'unsupported')

/**
 * Shared, reactive push state for components:
 *   const push = usePush()
 *   <button v-if="push.permission.value !== 'granted'" @click="push.enable()">ເປີດການແຈ້ງເຕືອນ</button>
 * The app calls enable() right after login (LoginView) and resume() on start-up (App.vue).
 */
let enabling: Promise<string | null> | null = null

export function usePush() {
  /** Prompts for permission if needed. Concurrent calls share one request. */
  function enable(): Promise<string | null> {
    enabling ??= doEnable().finally(() => (enabling = null))
    return enabling
  }

  async function doEnable(): Promise<string | null> {
    status.value = 'enabling'
    try {
      if (!(await getFirebaseMessaging())) {
        status.value = 'unsupported'
        return null
      }
      token.value = await requestFcmToken()
      // Dev only: copy it into Firebase console → Messaging → "Send test message"
      if (import.meta.env.DEV && token.value) console.info('[firebase] FCM token:', token.value)
      // Hand it to the backend: it can only push to a token it has stored. Every path that
      // obtains a token comes through here, so this is the one place that has to do it.
      if (token.value) await usersApi.updateFcmToken(token.value)
      permission.value = Notification.permission
      status.value = token.value ? 'enabled' : permission.value === 'denied' ? 'denied' : 'idle'
      return token.value
    } catch (e) {
      console.warn('[firebase] could not enable push', e)
      status.value = 'error'
      return null
    }
  }

  /** Re-fetch the token without ever prompting: only when permission was granted earlier. */
  async function resume(): Promise<string | null> {
    if (!firebaseConfigured || permission.value !== 'granted') return null
    return enable()
  }

  async function disable(): Promise<void> {
    await revokeFcmToken()
    token.value = null
    status.value = 'idle'
  }

  return {
    configured: firebaseConfigured,
    token: readonly(token),
    status: readonly(status),
    permission: readonly(permission),
    enable,
    resume,
    disable,
    onForegroundMessage,
  }
}
