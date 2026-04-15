import api from '../lib/api.js'
import { supabase, hasSupabaseConfig } from '../lib/supabase.js'

const CRM_BASE_URL = (import.meta.env.VITE_CRM_BASE_URL || 'https://crm.vitaloop.today').replace(/\/$/, '')

export const AUTH_POST_LOGIN_PATH = import.meta.env.VITE_AUTH_POST_LOGIN_PATH || `${CRM_BASE_URL}/auth/post-login`
export const INVITATIONS_ACCEPT_PATH = import.meta.env.VITE_INVITATIONS_ACCEPT_PATH || `${CRM_BASE_URL}/invitations/accept`

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

  window.location.assign(destination?.url || destination)
}

export async function resolvePostLoginDestination() {
  const { data } = await api.get('/auth/me')

  if (!hasSupabaseConfig) {
    throw new Error('Supabase config is unavailable for CRM token handoff.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) {
    throw new Error('Missing session token for CRM handoff.')
  }

  // Always hand off auth token via the dedicated auth bridge endpoint.
  const baseTarget = AUTH_POST_LOGIN_PATH
  return {
    url: baseTarget,
    method: 'POST',
    token: accessToken,
    // Temporary fallback for consumers still expecting a string URL.
    fallbackUrl: withToken(baseTarget, accessToken),
  }
}
