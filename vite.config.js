import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Modes: development (npm run dev) · uat (npm run build:uat) · production (npm run build).
// Each reads .env, then .env.<mode> on top.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // A deployed build with no API URL would silently call /api/v1 on its own host
  if (command === 'build' && !/^https?:\/\//.test(env.VITE_API_BASE_URL ?? '')) {
    throw new Error(`VITE_API_BASE_URL is not set for mode "${mode}". Fill it in .env.${mode}.`)
  }

  const proxyTarget = process.env.API_PROXY_TARGET || 'http://localhost:3001'
  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      host: true,
      // Only used when VITE_API_BASE_URL is relative (/api/v1), e.g. to test from a phone
      // on the LAN or through a tunnel to :5173 without exposing the backend port.
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/socket.io': { target: proxyTarget, changeOrigin: true, ws: true },
      },
    },
  }
})
