/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// tsconfig.node.json is `composite`, so it wants every file it reaches listed
// in its own include (TS6307) — but listing this one makes the app's `tsc`,
// which owns src/ and type-checks this file, fail with TS6305. The import's
// types still flow through; only that project-layout error is silenced.
// (@ts-expect-error cannot be used: TS never counts it as used for TS6307.)
// @ts-ignore TS6307
import { applyShareMeta, sharePages } from './src/lib/shareMeta'

/**
 * Writes dist/<path>/index.html for every shareable route in src/lib/shareMeta,
 * each a copy of the built index.html carrying that route's link-preview title,
 * so a Group 1 link no longer previews with the default tags. `post` so Vite's
 * own HTML plugin has already put index.html (with the hashed asset tags) in
 * the bundle.
 */
function sharePreviewPages(): Plugin {
  return {
    name: 'share-preview-pages',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') {
        this.error('share-preview-pages: index.html is not in the bundle')
      }
      const html = String(index.source)
      for (const page of sharePages()) {
        this.emitFile({
          type: 'asset',
          fileName: `${page.path.slice(1)}/index.html`,
          source: page.meta ? applyShareMeta(html, page.path, page.meta) : html,
        })
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), sharePreviewPages()],
  test: {
    environment: 'node',
    // The API server is a separate package with its own vitest, tsconfig and
    // NodeNext module resolution ('./x.js' specifiers that this config cannot
    // resolve). Run it with `npm test` inside /server; collecting it here just
    // fails to load.
    exclude: ['node_modules/**', 'dist/**', 'server/**', 'android/**', 'ios/**'],
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
