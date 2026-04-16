import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2019',
    // Code splitting strategy for better performance
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libraries
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react', 'framer-motion'],
          'vendor-charts': ['recharts'],
          'vendor-state': ['zustand'],
          'vendor-http': ['axios'],
          
          // Feature-based chunks
          'feature-dashboard': [
            'src/pages/Dashboard.jsx',
            'src/components/dashboard/AchievementsPanel.jsx',
            'src/components/dashboard/WeeklyDigestPanel.jsx',
            'src/components/dashboard/AssignmentCard.jsx',
            'src/components/dashboard/DailyMissionsPanel.jsx',
            'src/components/dashboard/AnalyticsDashboard.jsx',
          ],
          
          // Utilities
          'lib-api': ['src/lib/api.js', 'src/lib/notifications.js'],
          'lib-features': ['src/lib/achievements.js', 'src/lib/recommendations.js'],
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

