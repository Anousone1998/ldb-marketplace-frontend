import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// One ID per build: Cloudflare Pages' commit SHA when available, otherwise the build time.
// Baked into the bundle and written to /version.json so open tabs can spot a newer deploy.
const APP_VERSION = process.env.CF_PAGES_COMMIT_SHA?.slice(0, 12) || Date.now().toString(36)

function versionFile() {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION }) })
    },
  }
}

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
    plugins: [vue(), tailwindcss(), versionFile()],
    define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
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
