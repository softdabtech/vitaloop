import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import * as Sentry from '@sentry/react'
import { supabase, hasSupabaseConfig } from './lib/supabase.js'

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

// Post-release entitlement consistency fix: without this, React Query's
// entire cache (entitlements included) survives a sign-out/sign-in in the
// same tab untouched — a different authenticated user landing in the same
// browser session would see the PREVIOUS user's cached data (entitlements,
// dashboard, profile, everything) until each query happened to refetch on
// its own. Clears the whole cache whenever the authenticated user id
// actually changes (covers logout, login, and switching accounts without a
// full page reload) — not just entitlements, since the same staleness risk
// applies to every other per-user query in this cache.
if (hasSupabaseConfig) {
  let lastUserId = undefined // undefined = not yet hydrated; null = signed out
  supabase.auth.onAuthStateChange((_event, session) => {
    const nextUserId = session?.user?.id ?? null
    if (lastUserId !== undefined && nextUserId !== lastUserId) {
      queryClient.clear()
    }
    lastUserId = nextUserId
  })
}

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
