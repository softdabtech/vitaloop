import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import * as Sentry from '@sentry/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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

// Create QueryClient with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000, // 5 minutes default
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
