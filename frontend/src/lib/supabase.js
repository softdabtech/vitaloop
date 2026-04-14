import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

function createMissingConfigError() {
  return new Error('Supabase frontend config is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
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
