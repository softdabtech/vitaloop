import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
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
    supabase.auth.signUp({ email, password })

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: 'google' })

  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=true`,
    })

  const signOut = () => supabase.auth.signOut()

  return { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, signOut }
}
