import { useState, useEffect } from 'react'
import { supabase, hasSupabaseConfig } from '../lib/supabase.js'
import { AUTH_POST_LOGIN_PATH } from '../auth/postLogin.js'

const CRM_BASE_URL = (import.meta.env.VITE_CRM_BASE_URL || 'https://crm.vitaloop.today').replace(/\/$/, '')

function resolveEmailConfirmationRedirect() {
  const configured = import.meta.env.VITE_EMAIL_CONFIRMATION_PATH
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured
  }
  return `${window.location.origin}/auth/confirmation`
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setUser(null)
      setLoading(false)
      return () => {}
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch((err) => {
      console.error('Failed to get Supabase session:', err)
      setUser(null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUpWithEmail = (email, password) =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: resolveEmailConfirmationRedirect(),
      },
    })

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: AUTH_POST_LOGIN_PATH,
      },
    })

  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=true`,
    })

  const signOut = async () => {
    // Best-effort CRM cookie cleanup to avoid sticky SSO sessions.
    try {
      await fetch(`${CRM_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        mode: 'no-cors',
      })
    } catch {
      // Ignore network errors and still sign out from Supabase.
    }

    return supabase.auth.signOut()
  }

  return { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, signOut }
}
