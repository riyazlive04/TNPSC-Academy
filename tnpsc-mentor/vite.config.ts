/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Point the API client at a dummy base URL (unit tests never hit the network).
    env: {
      VITE_API_URL: 'http://localhost:4000',
    },
  },
  server: {
    port: 5173,
    host: true,
    // Fail loudly instead of drifting to a new port (which spawns duplicate
    // servers and leaves the browser on a stale one).
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // There is deliberately NO `pdf: ['jspdf', 'html2canvas']` entry here,
        // and the hook is a function rather than the `{ name: [pkg] }` object
        // form. Naming a pdf chunk cost every visitor ~200 kB gzip on every
        // route: Vite's own preload helper (the `__vitePreload` that each
        // `await import()` compiles to) got parked inside that chunk, which made
        // the 590 kB jsPDF + html2canvas bundle a STATIC import of 26 other
        // chunks — so index.html modulepreloaded it and the registration page
        // downloaded a PDF engine before it could paint. Left unnamed, jsPDF and
        // html2canvas land in an async chunk that loads only when someone
        // actually saves a PDF (every call site already uses `await import()`).
        //
        // After touching this file, CHECK: `dist/index.html` must reference only
        // the entry, vendor, motion and the stylesheet — nothing else.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (/node_modules[\/](react|react-dom|react-router-dom|zustand)[\/]/.test(id)) {
            return 'vendor'
          }
          // Shared across many lazy route chunks (quiz/mock/result/admin
          // pages, page-transition engine) — isolate so they get their own
          // long-lived cache entry instead of being duplicated/re-bundled
          // into whichever chunk happens to import them first.
          if (/node_modules[\/]motion[\/]/.test(id)) return 'motion'
          if (/node_modules[\/]katex[\/]/.test(id)) return 'katex'
        },
      },
    },
  },
})
