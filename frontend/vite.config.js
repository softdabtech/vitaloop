import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function safeGit(command, fallback = 'unknown') {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback
  } catch {
    return fallback
  }
}

function buildInfoPlugin() {
  return {
    name: 'vitaloop-build-info',
    generateBundle() {
      const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'))
      const buildInfo = {
        app: packageJson.name,
        version: packageJson.version,
        commit: safeGit('git rev-parse HEAD'),
        shortCommit: safeGit('git rev-parse --short=12 HEAD'),
        branch: safeGit('git rev-parse --abbrev-ref HEAD'),
        builtAt: new Date().toISOString(),
        mode: process.env.MODE || process.env.NODE_ENV || 'production',
      }

      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: JSON.stringify(buildInfo, null, 2),
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    buildInfoPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false, // we use our own /public/manifest.json
      injectManifest: {
        // App shell precache strategy
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // build-info.json must never be precached — it is fetched fresh on every deploy
        // verification check. nginx serves it with no-cache headers.
        globIgnores: ['mockups/**', 'build-info.json'],
        // Allow larger favicon assets without build-time failures.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2019',
    // Code splitting strategy for better performance
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor: React core — always needed
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
          // Vendor: UI animations/icons — lazy-loaded with components
          if (id.includes('node_modules/framer-motion')) return 'vendor-ui'
          if (id.includes('node_modules/lucide-react')) return 'vendor-ui'
          // Vendor: state
          if (id.includes('node_modules/zustand')) return 'vendor-state'
          // Vendor: HTTP
          if (id.includes('node_modules/axios')) return 'vendor-http'
          // API client — loaded on demand (not eager preload)
          if (id.includes('/src/lib/api.js')) return 'lib-api'
          // NOTE: feature-dashboard removed from manualChunks intentionally.
          // UserDashboard and cabinet components are lazy-imported in App.jsx
          // and should be loaded on demand only, not preloaded on the landing page.
          // Vite will auto-chunk them correctly via dynamic imports.
        },
      },
    },
    // Report chunk sizes
    reportCompressedSize: true,
    // Chunks over 500KB will be warned
    chunkSizeWarningLimit: 500,
  },
  server: {
    port: 5173,
  },
})
