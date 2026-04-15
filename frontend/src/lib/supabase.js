import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function isPlaceholder(value) {
  if (!value) return true
  return value.includes('<') || value.includes('>') || value.includes('...') || value.toLowerCase().includes('placeholder')
}

function isValidSupabaseUrl(value) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(value || '').trim())
}

function isValidSupabaseAnonKey(value) {
  const raw = String(value || '').trim()
  return raw.startsWith('eyJ') || raw.startsWith('sb_publishable_')
}

const hasUrl = Boolean(supabaseUrl && !isPlaceholder(supabaseUrl) && isValidSupabaseUrl(supabaseUrl))
const hasAnonKey = Boolean(supabaseAnonKey && !isPlaceholder(supabaseAnonKey) && isValidSupabaseAnonKey(supabaseAnonKey))
export const hasSupabaseConfig = hasUrl && hasAnonKey

function createMissingConfigError() {
  return new Error('Supabase frontend config is invalid. Set valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.')
}

function createFallbackClient() {
  const makeResult = async () => ({ data: null, error: createMissingConfigError() })

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: makeResult,
      signUp: makeResult,
      signInWithOAuth: makeResult,
      resetPasswordForEmail: makeResult,
      signOut: async () => ({ error: null }),
      exchangeCodeForSession: makeResult,
    },
    from: () => {
      throw createMissingConfigError()
    },
  }
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createFallbackClient()
