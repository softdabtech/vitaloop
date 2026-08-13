import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import './styles/coach-design-system.css'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import * as Sentry from '@sentry/react'
import { installGlobalErrorReporting } from './lib/errorReporter.js'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 0,
    integrations: [],
  })
}

installGlobalErrorReporting()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3800,
              style: {
                borderRadius: '12px',
                border: '1px solid #d1e7df',
                background: '#ffffff',
                color: '#1d1d1f',
                boxShadow: '0 10px 32px rgba(8, 80, 65, 0.12)',
                fontSize: '14px',
                maxWidth: '420px',
              },
            }}
            containerStyle={{ top: 18, right: 18 }}
          />
        </HelmetProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)

window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    const bootCover = document.getElementById('vitaloop-boot-cover')
    if (!bootCover) return
    bootCover.dataset.ready = 'true'
    window.setTimeout(() => bootCover.remove(), 180)
  })
})
