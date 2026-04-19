import api from '../lib/api.js'
import { supabase, hasSupabaseConfig } from '../lib/supabase.js'

const CRM_BASE_URL = (import.meta.env.VITE_CRM_BASE_URL || 'https://crm.vitaloop.today').replace(/\/$/, '')
const APP_BASE_URL = (import.meta.env.VITE_APP_BASE_URL || 'https://vitaloop.today').replace(/\/$/, '')
const CRM_ROLES = new Set(['super_admin', 'admin', 'org_admin', 'org_owner', 'client_admin', 'manager', 'practitioner'])

export const AUTH_POST_LOGIN_PATH = import.meta.env.VITE_AUTH_POST_LOGIN_PATH || `${CRM_BASE_URL}/auth/post-login`
export const INVITATIONS_ACCEPT_PATH = import.meta.env.VITE_INVITATIONS_ACCEPT_PATH || `${CRM_BASE_URL}/invitations/accept`

function isCrmHost() {
  const hostname = String(window.location.hostname || '').toLowerCase()
  return hostname === 'crm.vitaloop.today' || hostname.startsWith('crm.')
}

function resolveRoleFromSessionUser(sessionUser) {
  const meta = sessionUser?.user_metadata || {}
  const app = sessionUser?.app_metadata || {}
  const normalized = String(
    meta.global_role
    || app.global_role
    || meta.role
    || app.role
    || '',
  ).trim().toLowerCase()

  if (meta.is_super_admin || app.is_super_admin || normalized === 'super_admin') return 'super_admin'
  if (CRM_ROLES.has(normalized)) return normalized
  if (String(meta.org_role || app.org_role || '').toLowerCase() === 'admin') return 'org_admin'
  return 'end_user'
}

function withToken(url, token) {
  if (!token) return url
  const parsed = new URL(url)
  parsed.searchParams.set('token', token)
  return parsed.toString()
}

function postTokenHandoff(url, token) {
  console.log('[STEP 5A] Creating form for CRM handoff', { url, tokenLength: token?.length })
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = url
  form.style.display = 'none'

  const tokenInput = document.createElement('input')
  tokenInput.type = 'hidden'
  tokenInput.name = 'token'
  tokenInput.value = token
  form.appendChild(tokenInput)

  console.log('[STEP 5B] Form created and token input added', { formAction: form.action })
  document.body.appendChild(form)
  console.log('[STEP 5C] Form appended to body, about to submit')
  console.log('[STEP 5D] Form target:', { action: form.action, method: form.method })
  form.submit()
  console.log('[STEP 5E] Form submitted!')
}

export function navigateToResolvedPath(_navigate, destination) {
  console.log('[STEP 4] navigateToResolvedPath called', { destination, hasMethod: !!destination?.method })
  if (destination?.method === 'POST' && destination?.token) {
    console.log('[STEP 5] POST method detected, initiating handoff')
    postTokenHandoff(destination.url, destination.token)
    return
  }

  const target = destination?.url || destination
  if (typeof target === 'string' && target.startsWith('/')) {
    console.log('[STEP 5] Non-POST local redirect via SPA navigate', target)
    _navigate(target, { replace: true })
    return
  }

  console.log('[STEP 5] Non-POST external redirect, using window.location.assign', target)
  window.location.assign(target)
}

function normalizeReturnUrl(returnUrl) {
  if (!returnUrl || typeof returnUrl !== 'string') return null
  return returnUrl.startsWith('/') ? returnUrl : null
}

function resolveGlobalRole(mePayload) {
  const fromUser = mePayload?.user?.global_role
  const fromRoot = mePayload?.global_role
  const role = String(fromUser || fromRoot || '').trim().toLowerCase()
  if (CRM_ROLES.has(role) || role === 'end_user') {
    return role
  }
  return 'end_user'
}

function resolveLocalProductPath(mePayload, normalizedReturnUrl) {
  const role = resolveGlobalRole(mePayload)
  const onboardingCompleted = Boolean(mePayload?.user?.onboarding_completed ?? mePayload?.onboarding_completed)

  if (normalizedReturnUrl && (normalizedReturnUrl.startsWith('/dashboard') || normalizedReturnUrl.startsWith('/onboarding'))) {
    return normalizedReturnUrl
  }

  if (role === 'end_user' && !onboardingCompleted) {
    return '/onboarding'
  }
  return '/dashboard'
}

export async function resolvePostLoginDestination(returnUrl = null) {
  console.log('[STEP 2] resolvePostLoginDestination called', { returnUrl })

  const normalized = normalizeReturnUrl(returnUrl)
  let authMe = null
  let authMeFailed = false

  // Attempt to fetch user context via /auth/me, but don't fail the entire handoff if it fails
  try {
    console.log('[STEP 3A] Fetching /auth/me')
    const { data } = await api.get('/auth/me')
    authMe = data
    console.log('[STEP 3B] User context fetched successfully:', data)
  } catch (error) {
    console.warn('[STEP 3B] Failed to fetch /auth/me context', error?.message || error)
    console.log('[STEP 3C] Falling back to local dashboard path when /auth/me is unavailable')
    authMeFailed = true
  }

  // End-users should stay in B2C app instead of CRM.
  if (authMe && resolveGlobalRole(authMe) === 'end_user') {
    const localPath = resolveLocalProductPath(authMe, normalized)
    if (isCrmHost()) {
      return {
        url: `${APP_BASE_URL}${localPath}`,
        method: 'GET',
      }
    }
    return {
      url: localPath,
      method: 'GET',
    }
  }

  if (authMeFailed) {
    const { data: sessionData } = await supabase.auth.getSession()
    const sessionUser = sessionData?.session?.user
    const accessToken = sessionData?.session?.access_token
    const sessionRole = resolveRoleFromSessionUser(sessionUser)

    if (sessionRole !== 'end_user') {
      if (isCrmHost()) {
        return {
          url: '/ops',
          method: 'GET',
        }
      }

      if (accessToken) {
        const target = new URL(AUTH_POST_LOGIN_PATH)
        if (normalized) {
          target.searchParams.set('returnUrl', normalized)
        }
        const baseTarget = target.toString()

        return {
          url: baseTarget,
          method: 'POST',
          token: accessToken,
          fallbackUrl: withToken(baseTarget, accessToken),
        }
      }

      return {
        url: `${CRM_BASE_URL}/ops`,
        method: 'GET',
      }
    }

    const localFallback = normalized && (normalized.startsWith('/dashboard') || normalized.startsWith('/onboarding'))
      ? normalized
      : '/dashboard'

    if (isCrmHost()) {
      return {
        url: `${APP_BASE_URL}${localFallback}`,
        method: 'GET',
      }
    }

    return {
      url: localFallback,
      method: 'GET',
    }
  }

  if (!hasSupabaseConfig) {
    console.error('[STEP 3D] Supabase config unavailable!')
    throw new Error('Supabase config is unavailable for CRM token handoff.')
  }

  console.log('[STEP 3E] Getting Supabase session...')
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  
  if (!accessToken) {
    console.error('[STEP 3F] No access token in session!', { sessionData })
    throw new Error('Missing session token for CRM handoff.')
  }

  console.log('[STEP 3G] Access token obtained, length:', accessToken.length)

  // Always hand off auth token via the dedicated auth bridge endpoint.
  const target = new URL(AUTH_POST_LOGIN_PATH)
  if (normalized) {
    target.searchParams.set('returnUrl', normalized)
  }

  const baseTarget = target.toString()
  console.log('[STEP 3H] Resolved target URL:', baseTarget)
  
  const result = {
    url: baseTarget,
    method: 'POST',
    token: accessToken,
    // Temporary fallback for consumers still expecting a string URL.
    fallbackUrl: withToken(baseTarget, accessToken),
  }
  
  console.log('[STEP 3I] Destination resolved, returning result')
  return result
}
