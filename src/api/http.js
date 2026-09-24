import axios from 'axios'
import { reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'

export const TOKEN_KEY = 'icm_token'
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/** `mock` flips to true once any request is served from fallback data. */
export const apiState = reactive({ mock: FORCE_MOCK })

const http = axios.create({ baseURL: API_BASE_URL, timeout: 10000 })

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    // An expired/invalid session anywhere except the login call itself
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      useAuthStore().logout({ redirect: true })
    }
    return Promise.reject(error)
  },
)

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Human-readable message from a NestJS error body `{ message: string | string[] }`. */
export function errorMessage(error, fallback) {
  const msg = error?.response?.data?.message
  return (Array.isArray(msg) ? msg[0] : msg) || fallback
}

const unreachable = (error) => !error.response || [502, 503, 504].includes(error.response.status)

/**
 * Run the real request and unwrap the `{ success, data }` envelope.
 * Only when the backend is unreachable (network error, gateway down) or mock mode
 * is forced does it resolve with the mock handler instead. Real 4xx/5xx errors propagate.
 */
export async function withFallback(request, mock) {
  if (!FORCE_MOCK) {
    try {
      const { data } = await request()
      return data && 'success' in data ? data.data : data
    } catch (error) {
      if (!unreachable(error)) throw error
      if (!apiState.mock) console.warn('[api] backend unreachable, using mock data:', error.message)
    }
  }
  apiState.mock = true
  await sleep(250)
  return structuredClone(await mock())
}

export default http
