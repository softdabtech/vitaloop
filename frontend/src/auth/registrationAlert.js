import { supabase } from '../lib/supabase.js'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  '/api'

function storageKey(userId) {
  return `vo:registration-alert:${userId}`
}

function welcomeStorageKey(userId) {
  return `vo:welcome-email:${userId}`
}

export async function notifyRegistrationAlert(flow = 'signup') {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  const accessToken = session?.access_token

  if (!user?.id || !accessToken) {
    return false
  }

  const key = storageKey(user.id)
  if (window.sessionStorage.getItem(key)) {
    return true
  }

  try {
    const response = await fetch(`${apiBaseUrl}/auth/registration/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ flow }),
    })

    if (!response.ok) {
      return false
    }

    window.sessionStorage.setItem(key, new Date().toISOString())
    return true
  } catch {
    return false
  }
}

export async function sendWelcomeEmail() {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  const accessToken = session?.access_token

  if (!user?.id || !accessToken) {
    return false
  }

  const key = welcomeStorageKey(user.id)
  if (window.sessionStorage.getItem(key)) {
    return true
  }

  try {
    const response = await fetch(`${apiBaseUrl}/auth/registration/welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      return false
    }

    window.sessionStorage.setItem(key, new Date().toISOString())

    return true
  } catch {
    return false
  }
}