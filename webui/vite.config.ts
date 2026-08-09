import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

const CSP =
  "default-src 'self'; img-src 'self' data:; connect-src 'self'; script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

/**
 * Inject the CSP meta tag on `build` only.
 *
 * It has to be build-only: Vite's dev server injects an inline module preamble for React
 * Fast Refresh and talks to an HMR websocket, both of which `script-src 'self'` and
 * `connect-src 'self'` block. Shipping it in the built HTML means the bundle carries its own
 * policy wherever it is served from, and the server sets the same thing as a real header.
 */
function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

export default defineConfig({
  // Mirrors LightRAG's arrangement: the built bundle is served by FastAPI under /webui.
  base: '/webui/',
  plugins: [react(), tailwindcss(), cspMeta()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: '../server/app/static',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Same-origin in dev too, so the client never needs to know about a base URL and CORS
      // stays a dev-only concern.
      '/api': {
        target: 'http://127.0.0.1:9700',
        changeOrigin: true,
      },
    },
  },
})
