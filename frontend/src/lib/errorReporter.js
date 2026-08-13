const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  '/api'

const MAX_REPORTS_PER_SESSION = 20
const DEDUPE_WINDOW_MS = 60_000
let sentCount = 0
const recent = new Map()

function nowIso() {
  return new Date().toISOString()
}

function currentRoute() {
  if (typeof window === 'undefined') return ''
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function buildId(payload) {
  return [
    payload.type,
    payload.code,
    payload.status,
    payload.method,
    payload.endpoint,
    payload.route,
    payload.message,
  ].filter(Boolean).join('|').slice(0, 500)
}

function shouldSend(payload) {
  if (typeof window === 'undefined') return false
  if (sentCount >= MAX_REPORTS_PER_SESSION) return false
  const key = buildId(payload)
  const last = recent.get(key) || 0
  const ts = Date.now()
  if (ts - last < DEDUPE_WINDOW_MS) return false
  recent.set(key, ts)
  sentCount += 1
  return true
}

function normalizeMessage(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 1000)
  if (value instanceof Error) return String(value.message || value.name || 'Error').slice(0, 1000)
  try {
    return JSON.stringify(value).slice(0, 1000)
  } catch {
    return String(value).slice(0, 1000)
  }
}

export function reportClientError(event) {
  const payload = {
    type: event?.type || 'browser_error',
    severity: event?.severity || 'error',
    code: event?.code || 'FRONTEND_ERROR',
    message: normalizeMessage(event?.message),
    route: event?.route || currentRoute(),
    endpoint: event?.endpoint || null,
    method: event?.method || null,
    status: event?.status || null,
    build: import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_COMMIT_SHA || null,
    locale: document?.documentElement?.lang || null,
    user_agent: navigator?.userAgent || null,
    metadata: {
      occurred_at: nowIso(),
      ...((event && event.metadata) || {}),
    },
  }

  if (!shouldSend(payload)) return

  const url = `${String(apiBaseUrl).replace(/\/$/, '')}/monitoring/frontend-error`
  try {
    const body = JSON.stringify(payload)
    if (navigator?.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(url, blob)) return
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Reporting must never break product UX.
  }
}

export function reportClientActivity(event) {
  if (typeof window === 'undefined') return
  const payload = {
    type: event?.type || 'route_view',
    route: event?.route || currentRoute(),
    referrer: event?.referrer || document.referrer || null,
    build: import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_COMMIT_SHA || null,
    locale: document?.documentElement?.lang || null,
    metadata: {
      occurred_at: nowIso(),
      ...((event && event.metadata) || {}),
    },
  }

  const url = `${String(apiBaseUrl).replace(/\/$/, '')}/monitoring/frontend-event`
  try {
    const body = JSON.stringify(payload)
    if (navigator?.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(url, blob)) return
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Activity logging must never affect navigation.
  }
}

export function installGlobalErrorReporting() {
  if (typeof window === 'undefined' || window.__vitaloopErrorReportingInstalled) return
  window.__vitaloopErrorReportingInstalled = true

  window.addEventListener('error', (event) => {
    reportClientError({
      type: 'browser_error',
      severity: 'error',
      code: 'BROWSER_RUNTIME_ERROR',
      message: event.message || event.error,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack ? String(event.error.stack).slice(0, 2000) : null,
      },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError({
      type: 'unhandled_rejection',
      severity: 'error',
      code: 'UNHANDLED_PROMISE_REJECTION',
      message: event.reason,
      metadata: {
        stack: event.reason?.stack ? String(event.reason.stack).slice(0, 2000) : null,
      },
    })
  })
}
