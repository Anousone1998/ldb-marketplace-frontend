import { defineStore } from 'pinia'
import { authApi, usersApi } from '@/api'
import { TOKEN_KEY } from '@/api/http'
import { disconnectChatSocket } from '@/services/socket'
import router from '@/router'

const USER_KEY = 'icm_user'

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY),
    user: readUser(),
  }),

  getters: {
    isAuthenticated: (s) => !!s.token && !!s.user,
  },

  actions: {
    async login(credentials) {
      const { accessToken, user } = await authApi.login(credentials)
      this.token = accessToken
      this.user = user
      localStorage.setItem(TOKEN_KEY, accessToken)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    },

    /** Merge profile fields (e.g. qrPaymentUrl, which the login response omits) into the session user. */
    setProfile(profile) {
      this.user = { ...this.user, ...profile }
      localStorage.setItem(USER_KEY, JSON.stringify(this.user))
    },

    async refreshProfile() {
      this.setProfile(await usersApi.me())
    },

    logout({ redirect = false } = {}) {
      this.token = null
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      disconnectChatSocket()
      if (redirect) router.push({ name: 'login' })
    },
  },
})
