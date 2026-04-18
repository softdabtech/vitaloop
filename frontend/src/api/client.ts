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

api.interceptors.request.use(async (config) => {
  if (!hasSupabaseConfig) {
    return config
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const code = error.response?.data?.code
    const detail = error.response?.data?.detail
    const validationErrors = error.response?.data?.errors || []
    const requestUrl = String(error?.config?.url || '')
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
      const authBoundary = requestUrl.includes('/auth/me')

      // Only force global sign-out on auth boundary calls.
      // For other endpoints we propagate the error so screens can degrade gracefully.
      if (authBoundary) {
        if (hasSupabaseConfig) {
          await supabase.auth.signOut()
        }
        window.location.href = '/login'
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
