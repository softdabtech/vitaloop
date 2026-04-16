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

