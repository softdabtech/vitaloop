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
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = url
  form.style.display = 'none'

  const tokenInput = document.createElement('input')
  tokenInput.type = 'hidden'
  tokenInput.name = 'token'
  tokenInput.value = token
  form.appendChild(tokenInput)

  document.body.appendChild(form)
  form.submit()
}

export function navigateToResolvedPath(_navigate, destination) {
  if (destination?.method === 'POST' && destination?.token) {
    postTokenHandoff(destination.url, destination.token)
    return
  }

  const target = destination?.url || destination
  if (typeof target === 'string' && target.startsWith('/')) {
    _navigate(target, { replace: true })
    return
  }

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

  if (normalizedReturnUrl && (normalizedReturnUrl.startsWith('/dashboard') || normalizedReturnUrl.startsWith('/onboarding') || normalizedReturnUrl.startsWith('/subscription'))) {
    return normalizedReturnUrl
  }

  if (role === 'end_user' && !onboardingCompleted) {
    return '/onboarding'
  }
  return '/dashboard'
}

export async function resolvePostLoginDestination(returnUrl = null) {
  const normalized = normalizeReturnUrl(returnUrl)
  let authMe = null
  let authMeFailed = false

  // Attempt to fetch user context via /auth/me, but don't fail the entire handoff if it fails
  try {
    const { data } = await api.get('/auth/me')
    authMe = data
  } catch {
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

    const localFallback = normalized && (normalized.startsWith('/dashboard') || normalized.startsWith('/onboarding') || normalized.startsWith('/subscription'))
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
    console.error('Supabase config is unavailable for CRM token handoff.')
    throw new Error('Supabase config is unavailable for CRM token handoff.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  if (!accessToken) {
    console.error('Missing session token for CRM handoff.')
    throw new Error('Missing session token for CRM handoff.')
  }

  // Always hand off auth token via the dedicated auth bridge endpoint.
  const target = new URL(AUTH_POST_LOGIN_PATH)
  if (normalized) {
    target.searchParams.set('returnUrl', normalized)
  }

  const baseTarget = target.toString()

  const result = {
    url: baseTarget,
    method: 'POST',
    token: accessToken,
    // Temporary fallback for consumers still expecting a string URL.
    fallbackUrl: withToken(baseTarget, accessToken),
  }

  return result
}
