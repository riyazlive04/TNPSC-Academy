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
          // jsPDF + its html2canvas/dompurify deps are only needed on the
          // result page — split them out of the main bundle.
          pdf: ['jspdf'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
        },
      },
    },
  },
})
