import { createClient } from '@supabase/supabase-js'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

async function apiRequest({ baseUrl, accessToken, path, method = 'GET', body }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${JSON.stringify(data)}`)
  }

  return data
}

async function confirmUser({ supabaseUrl, serviceRoleKey, userId }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email_confirm: true }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to confirm user ${userId}: ${response.status} ${body}`)
  }
}

async function deleteUser({ supabaseUrl, serviceRoleKey, userId }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to delete user ${userId}: ${response.status} ${body}`)
  }
}

async function main() {
  const supabaseUrl = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
  const apiBaseUrl = requireEnv('VITE_API_BASE_URL').replace(/\/$/, '')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const timestamp = Date.now()
  const email = `smoke-auth-${timestamp}@example.com`
  const password = `SmokeTest!${timestamp}`

  console.log(`signup_email=${email}`)

  const signup = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://vitaloop.today/auth/confirmation',
    },
  })

  if (signup.error) {
    throw signup.error
  }

  const userId = signup.data.user?.id
  if (!userId) {
    throw new Error('Signup did not return a user id')
  }

  console.log(`signup_user_id=${userId}`)

  await confirmUser({ supabaseUrl, serviceRoleKey, userId })
  console.log('email_confirmed=ok')

  const signin = await client.auth.signInWithPassword({ email, password })
  if (signin.error || !signin.data.session?.access_token) {
    throw signin.error || new Error('Sign in failed after confirmation')
  }

  const accessToken = signin.data.session.access_token
  console.log('sign_in_after_signup=ok')

  const me = await apiRequest({ baseUrl: apiBaseUrl, accessToken, path: '/auth/me' })
  console.log(`auth_me_email=${me?.user?.email || ''}`)

  const alertResp = await apiRequest({
    baseUrl: apiBaseUrl,
    accessToken,
    path: '/auth/registration/notify',
    method: 'POST',
    body: { flow: 'smoke_auth_flow' },
  })
  console.log(`registration_alert_sent=${Boolean(alertResp?.sent)}`)

  const stateBefore = await apiRequest({ baseUrl: apiBaseUrl, accessToken, path: '/auth/onboarding/state' })
  console.log(`requires_onboarding_before=${Boolean(stateBefore?.requires_onboarding)}`)

  await apiRequest({
    baseUrl: apiBaseUrl,
    accessToken,
    path: '/profile',
    method: 'PATCH',
    body: {
      height_cm: 180,
      weight_kg: 78,
      goals: ['energy', 'sleep'],
      current_supplements: ['Magnesium'],
      prior_diagnoses: 'None',
    },
  })

  await apiRequest({
    baseUrl: apiBaseUrl,
    accessToken,
    path: '/profile/location',
    method: 'PATCH',
    body: {
      city: 'Lisbon',
      country: 'Portugal',
    },
  })

  await apiRequest({
    baseUrl: apiBaseUrl,
    accessToken,
    path: '/complaints',
    method: 'POST',
    body: {
      complaint: 'Smoke test fatigue',
      duration_description: '2 weeks',
      tried_interventions: 'Sleep hygiene',
    },
  })

  await apiRequest({
    baseUrl: apiBaseUrl,
    accessToken,
    path: '/auth/onboarding/complete',
    method: 'POST',
    body: {},
  })

  const stateAfter = await apiRequest({ baseUrl: apiBaseUrl, accessToken, path: '/auth/onboarding/state' })
  console.log(`requires_onboarding_after=${Boolean(stateAfter?.requires_onboarding)}`)

  const dashboardHealth = await apiRequest({ baseUrl: apiBaseUrl, accessToken, path: '/profile' })
  console.log(`profile_loaded=${Boolean(dashboardHealth?.profile)}`)

  const signOut = await client.auth.signOut()
  if (signOut.error) {
    throw signOut.error
  }
  console.log('sign_out=ok')

  const signInAgain = await client.auth.signInWithPassword({ email, password })
  if (signInAgain.error || !signInAgain.data.session?.access_token) {
    throw signInAgain.error || new Error('Second sign in failed')
  }
  console.log('sign_in_again=ok')

  await deleteUser({ supabaseUrl, serviceRoleKey, userId })
  console.log('cleanup=ok')
  console.log('SMOKE_AUTH_FLOW_OK')
}

main().catch((error) => {
  console.error('SMOKE_AUTH_FLOW_FAILED')
  console.error(error)
  process.exit(1)
})