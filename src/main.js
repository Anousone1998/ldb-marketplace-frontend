import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { registerServiceWorker } from './services/sw'
import { setupAppUpdate } from './composables/useAppUpdate'
import './style.css'

createApp(App).use(createPinia()).use(router).mount('#app')
setupAppUpdate(router)

// PWA: offline app shell + installability. Push reuses the same registration (services/firebase.ts).
window.addEventListener('load', () => registerServiceWorker().catch((e) => console.warn('[sw]', e)))
