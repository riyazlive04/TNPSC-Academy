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
        manualChunks: {
          // jsPDF + html2canvas are only needed on the result page —
          // split them out of the main bundle.
          pdf: ['jspdf', 'html2canvas'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          // Shared across many lazy route chunks (quiz/mock/result/admin
          // pages, page-transition engine) — isolate so they get their own
          // long-lived cache entry instead of being duplicated/re-bundled
          // into whichever chunk happens to import them first.
          motion: ['motion'],
          katex: ['katex'],
        },
      },
    },
  },
})
