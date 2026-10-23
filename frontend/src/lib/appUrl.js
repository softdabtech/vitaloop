const DEFAULT_APP_BASE_URL = 'https://app.vitaloop.today'
const DEFAULT_PUBLIC_SITE_BASE_URL = 'https://vitaloop.today'

function configuredAppBaseUrl() {
  const configured = String(import.meta.env.VITE_APP_BASE_URL || '').trim()
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(configured)) return DEFAULT_APP_BASE_URL
  return configured.replace(/\/$/, '')
}

/**
 * Canonical English end-user application origin.
 *
 * Public VITALOOP pages use this helper when entering an authenticated or
 * assessment flow. Keeping the URL construction here prevents individual
 * marketing components from drifting back to the landing hostname.
 */
export function getAppBaseUrl() {
  return configuredAppBaseUrl()
}

export function appUrl(path = '/') {
  if (/^https?:\/\//i.test(String(path))) return String(path)
  const normalizedPath = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`
  return `${configuredAppBaseUrl()}${normalizedPath}`
}

export function navigateToApp(path) {
  if (typeof window === 'undefined') return
  window.location.assign(appUrl(path))
}

/**
 * Canonical English marketing-site origin.
 *
 * The symptom intake starts on the cabinet origin so its anonymous handoff is
 * origin-scoped. Its marketing navigation must nevertheless return to the
 * public site, rather than treating the cabinet dashboard as the homepage.
 */
export function publicSiteUrl(path = '/') {
  if (/^https?:\/\//i.test(String(path))) return String(path)
  const normalizedPath = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`
  return `${DEFAULT_PUBLIC_SITE_BASE_URL}${normalizedPath}`
}

export function navigateToPublicSite(path) {
  if (typeof window === 'undefined') return
  window.location.assign(publicSiteUrl(path))
}
