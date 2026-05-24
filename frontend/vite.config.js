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
      injectRegister: 'auto',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false, // we use our own /public/manifest.json
      injectManifest: {
        // App shell precache strategy
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // build-info.json must never be precached — it is fetched fresh on every deploy
        // verification check. nginx serves it with no-cache headers.
        globIgnores: ['mockups/**', 'build-info.json', 'images/favicon.png'],
        // Keep default limit high enough to prevent build-time hard failures.
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
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
        manualChunks: {
          // Vendor libraries
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react', 'framer-motion'],
          'vendor-state': ['zustand'],
          'vendor-http': ['axios'],
          
          // Feature-based chunks
          'feature-dashboard': [
            'src/pages/UserDashboard.jsx',
            'src/components/dashboard/AssignmentCard.jsx',
            'src/components/dashboard/HealthChart.jsx',
            'src/components/dashboard/ProgressTimeline.jsx',
            'src/components/dashboard/QuickActionsPanel.jsx',
            'src/components/dashboard/RecommendationsPanel.jsx',
            'src/components/dashboard/StatCard.jsx',
            'src/components/dashboard/UserDashboardSidebar.jsx',
          ],
          
          // Utilities
          'lib-api': ['src/lib/api.js'],
          'lib-features': [
            'src/lib/assignmentRouting.js',
            'src/lib/assignmentScoring.js',
            'src/lib/funnel.js',
            'src/lib/store.js',
            'src/lib/symptoms.js',
          ],
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

