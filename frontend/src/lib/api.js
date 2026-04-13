import axios from 'axios'
import { supabase } from './supabase.js'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

// ── Request: attach JWT ───────────────────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// ── Response: handle auth errors and paywall ─────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const code = error.response?.data?.code
    const detail = error.response?.data?.detail
    const validationErrors = error.response?.data?.errors || []

    const resolveMessage = () => {
      if (status === 422) {
        const scoreError = validationErrors.find((item) => (
          Array.isArray(item.loc) && item.loc.includes('protocol_adherence')
        ))
        if (scoreError) {
          return 'Check-in value must be between 1 and 10.'
        }
        if (typeof detail === 'string' && detail.trim()) {
          return detail
        }
        return 'Validation failed. Check your input and try again.'
      }

      const messages = {
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
      await supabase.auth.signOut()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (status === 402) {
      // Paywall — trigger global paywall UI
      window.dispatchEvent(new CustomEvent('vitaloop:paywall'))
      return Promise.reject(error)
    }

    if (status === 403) {
      // 403 = access denied, NOT paywall
      if (code === 'ACCESS_DENIED') {
        toast.error('Access denied', { id: 'access-denied' })
      } else {
        const messages = {
          UPLOAD_NOT_FOUND: 'Upload not found or access denied.',
        }
        toast.error(messages[code] || 'Access denied.', { id: code || 'forbidden' })
      }
      return Promise.reject(error)
    }

    const msg = resolveMessage()
    toast.error(msg, { id: code || 'api-error' })

    return Promise.reject(error)
  }
)

export default api
