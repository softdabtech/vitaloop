import axios from 'axios'
import toast from 'react-hot-toast'
import { supabase, hasSupabaseConfig } from '../lib/supabase.js'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  '/api'

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30_000, // 30 s — prevents requests from hanging indefinitely
})

function readAccessTokenFromSupabaseStorage() {
  if (typeof window === 'undefined') return null

  try {
    const key = Object.keys(window.localStorage).find((item) => item.startsWith('sb-') && item.endsWith('-auth-token'))
    if (!key) return null

    const raw = window.localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    return parsed?.access_token || parsed?.currentSession?.access_token || null
  } catch {
    return null
  }
}

async function resolveAccessToken() {
  if (hasSupabaseConfig) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      return session.access_token
    }
  }

  return readAccessTokenFromSupabaseStorage()
}

api.interceptors.request.use(async (config) => {
  const token = await resolveAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const errorData = error.response?.data || {}
    // Handle nested error structure: detail contains {detail, code, used_by}
    const innerError = typeof errorData?.detail === 'object' ? errorData.detail : errorData
    const code = innerError?.code || errorData?.code
    const detail = innerError?.detail || errorData?.detail
    const validationErrors = error.response?.data?.errors || []
    const requestUrl = String(error?.config?.url || '')
    const method = String(error?.config?.method || '').toUpperCase()
    const isAuthMeRequest = requestUrl.includes('/auth/me')

    const shouldLogServerError =
      status >= 500
      && !isAuthMeRequest

    // Log errors for debugging
    if (shouldLogServerError) {
      console.error(`[API ${status}] ${method} ${requestUrl}`, { code, detail })
    }

    const isPassiveCabinetRequest = [
      '/dashboard/summary',
      '/stripe/subscription',
      '/progress',
      '/timeline',
      '/insights',
      '/assignments',
    ].some((path) => requestUrl.includes(path))

    const resolveMessage = () => {
      if (status === 422) {
        const scoreError = validationErrors.find((item: any) => (
          Array.isArray(item.loc) && item.loc.includes('protocol_adherence')
        ))
        if (scoreError) {
          return 'Check-in score must be between 1 and 5.'
        }
        if (typeof detail === 'string' && detail.trim()) {
          return detail
        }
        return 'Validation failed. Check your input and try again.'
      }

      const messages: Record<string, string> = {
        LAB_TEXT_TOO_SHORT: 'Lab text too short — try a clearer photo.',
        UPLOAD_NOT_FOUND: 'Upload not found or access denied.',
        PROGRESS_NOT_FOUND: 'No progress data yet.',
        NETWORK_ERROR: 'Network error — check your connection.',
      }

      if (typeof detail === 'string' && detail.trim() && detail.length < 200) {
        return detail
      }

      return messages[code] || 'Something went wrong.'
    }

    if (status === 401) {
      const authBoundary = isAuthMeRequest

      // Retry once for non-auth-boundary requests. This covers session-hydration races
      // right after login when the first request may miss the Authorization header.
      if (!authBoundary && !error.config?._retry) {
        error.config._retry = true
        const token = await resolveAccessToken()
        if (token) {
          error.config.headers = error.config.headers || {}
          error.config.headers.Authorization = `Bearer ${token}`
          return api.request(error.config)
        }
      }

      // For auth-boundary calls, retry once with a freshly resolved token.
      // This avoids false sign-outs during session hydration races on hard refresh.
      if (authBoundary && !error.config?._retryAuthBoundary) {
        error.config._retryAuthBoundary = true
        const token = await resolveAccessToken()
        if (token) {
          error.config.headers = error.config.headers || {}
          error.config.headers.Authorization = `Bearer ${token}`
          return api.request(error.config)
        }
      }

      // Only force global sign-out on auth boundary calls.
      // For other endpoints we propagate the error so screens can degrade gracefully.
      if (authBoundary) {
        const token = await resolveAccessToken()

        // Public pages can call /auth/me for optional UI state.
        // Guests have no token, so do not force navigation to /login.
        if (!token) {
          return Promise.reject(error)
        }

        if (hasSupabaseConfig) {
          await supabase.auth.signOut()
        }

        // Avoid hard-navigation loops and visible screen flicker when already on login.
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }

    if (isPassiveCabinetRequest) {
      return Promise.reject(error)
    }

    if (status === 402) {
      window.dispatchEvent(
        new CustomEvent('paywall:trigger', { detail: { reason: code ?? 'SUBSCRIPTION_REQUIRED' } })
      )
      return Promise.reject(error)
    }

    if (status === 403) {
      if (code === 'ACCESS_DENIED') {
        toast.error('Access denied', { id: 'access-denied' })
      } else {
        const messages: Record<string, string> = {
          UPLOAD_NOT_FOUND: 'Upload not found or access denied.',
        }
        toast.error(messages[code] || 'Access denied.', { id: code || 'forbidden' })
      }
      return Promise.reject(error)
    }

    toast.error(resolveMessage(), { id: code || 'api-error' })
    return Promise.reject(error)
  }
)

export default api
