import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, hasSupabaseConfig } from '../lib/supabase.js'
import { navigateToResolvedPath, resolvePostLoginDestination } from '../auth/postLogin.js'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    async function finalizeAuth() {
      if (!hasSupabaseConfig) {
        navigate('/login', { replace: true })
        return
      }

      try {
        const url = window.location.href
        if (url.includes('code=')) {
          await supabase.auth.exchangeCodeForSession(url)
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          navigate('/login', { replace: true })
          return
        }

        const destination = await resolvePostLoginDestination(user)
        navigateToResolvedPath(navigate, destination)
      } catch {
        navigate('/login', { replace: true })
      }
    }

    finalizeAuth()
  }, [navigate])

  return (
    <div className="flex items-center justify-center h-screen text-sm text-gray-400">
      Completing sign in...
    </div>
  )
}
