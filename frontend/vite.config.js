import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'favicon.svg'],
      manifest: false, // we use our own /public/manifest.json
      workbox: {
        // App shell caching strategy
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache API calls or Supabase auth
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/auth\//,
          /^\/admin/,
          /^\/__/,
        ],
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache static assets from CDN
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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

