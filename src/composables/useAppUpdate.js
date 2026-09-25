import { ref } from 'vue'

// Detects a newer deploy while the app stays open (tabs and installed PWAs can run for days).
// A new version is picked up with a full page load on the user's next navigation, so nothing
// they are typing is lost; the banner in App.vue offers to reload right away.

const CHECK_EVERY_MS = 10 * 60 * 1000
const RELOADED_KEY = 'om_reloaded_for'

export const updateAvailable = ref(false)

async function check() {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return
    const { version } = await res.json()
    if (version && version !== __APP_VERSION__) updateAvailable.value = true
  } catch {
    // offline: try again later
  }
}

export function reloadApp(path) {
  if (path) window.location.assign(path)
  else window.location.reload()
}

/** Call once at start-up with the router. No-op in dev (no version.json there). */
export function setupAppUpdate(router) {
  if (!import.meta.env.PROD) return

  check()
  setInterval(check, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())

  // Switch to the new build on the next page change, as a normal page load
  router.beforeEach((to, from) => {
    if (updateAvailable.value && from.matched.length) {
      reloadApp(to.fullPath)
      return false
    }
  })

  // An old tab asked for a chunk that the new deploy removed: reload once instead of breaking
  window.addEventListener('vite:preloadError', (event) => {
    if (sessionStorage.getItem(RELOADED_KEY) === __APP_VERSION__) return // already tried, avoid a loop
    event.preventDefault()
    sessionStorage.setItem(RELOADED_KEY, __APP_VERSION__)
    reloadApp()
  })
}
