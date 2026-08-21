const FIRST_TOUCH_KEY = 'vitaloop:first_touch_attribution'
const LAST_TOUCH_KEY = 'vitaloop:last_touch_attribution'
const X_LANDING_SESSION_KEY = 'vitaloop:x_founder_landing_tracked'

const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
]

function safeRead(key) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function safeWrite(key, value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Attribution must never block the product flow.
  }
}

function trimValue(value, max = 140) {
  return String(value || '').trim().slice(0, max)
}

function resolveReferrerHost() {
  if (typeof document === 'undefined' || !document.referrer) return null
  try {
    return new URL(document.referrer).hostname.slice(0, 160)
  } catch {
    return null
  }
}

function buildAttributionRecord(searchParams, locationLike) {
  const utm = {}
  ATTRIBUTION_KEYS.forEach((key) => {
    const value = trimValue(searchParams.get(key))
    if (value) utm[key] = value
  })

  if (!Object.keys(utm).length) return null

  const pathname = trimValue(locationLike?.pathname || '/', 180) || '/'
  return {
    ...utm,
    landing_path: pathname,
    referrer_host: resolveReferrerHost(),
    captured_at: new Date().toISOString(),
  }
}

export function captureAttributionFromLocation(locationLike) {
  if (typeof window === 'undefined') {
    return { captured: false, firstTouch: null, lastTouch: null, isFounderX: false }
  }

  const search = locationLike?.search ?? window.location.search
  const searchParams = new URLSearchParams(search)
  const record = buildAttributionRecord(searchParams, locationLike || window.location)

  if (!record) {
    return {
      captured: false,
      firstTouch: safeRead(FIRST_TOUCH_KEY),
      lastTouch: safeRead(LAST_TOUCH_KEY),
      isFounderX: false,
    }
  }

  const firstTouch = safeRead(FIRST_TOUCH_KEY) || record
  safeWrite(FIRST_TOUCH_KEY, firstTouch)
  safeWrite(LAST_TOUCH_KEY, record)

  return {
    captured: true,
    firstTouch,
    lastTouch: record,
    isFounderX: isFounderXAttribution(record),
  }
}

export function getStoredAttribution() {
  return {
    firstTouch: safeRead(FIRST_TOUCH_KEY),
    lastTouch: safeRead(LAST_TOUCH_KEY),
  }
}

export function isFounderXAttribution(record) {
  return (
    trimValue(record?.utm_source).toLowerCase() === 'x'
    && trimValue(record?.utm_medium).toLowerCase() === 'founder'
    && trimValue(record?.utm_campaign).toLowerCase() === 'alex_founder'
  )
}

export function shouldTrackFounderXLandingOnce() {
  if (typeof window === 'undefined') return false
  try {
    if (window.sessionStorage.getItem(X_LANDING_SESSION_KEY) === '1') return false
    window.sessionStorage.setItem(X_LANDING_SESSION_KEY, '1')
    return true
  } catch {
    return true
  }
}

export function getAttributionEventParams() {
  const { firstTouch, lastTouch } = getStoredAttribution()
  const active = lastTouch || firstTouch || {}
  return {
    ...(active.utm_source ? { utm_source: active.utm_source } : {}),
    ...(active.utm_medium ? { utm_medium: active.utm_medium } : {}),
    ...(active.utm_campaign ? { utm_campaign: active.utm_campaign } : {}),
    ...(active.utm_content ? { utm_content: active.utm_content } : {}),
    ...(active.utm_term ? { utm_term: active.utm_term } : {}),
    ...(firstTouch?.utm_source ? { first_touch_source: firstTouch.utm_source } : {}),
    ...(firstTouch?.utm_medium ? { first_touch_medium: firstTouch.utm_medium } : {}),
    ...(firstTouch?.utm_campaign ? { first_touch_campaign: firstTouch.utm_campaign } : {}),
  }
}

export function getAttributionMetadata() {
  const { firstTouch, lastTouch } = getStoredAttribution()
  return {
    ...(firstTouch ? { first_touch_attribution: firstTouch } : {}),
    ...(lastTouch ? { last_touch_attribution: lastTouch } : {}),
  }
}

export function getSignupUserMetadata() {
  const { firstTouch, lastTouch } = getStoredAttribution()
  return {
    ...(firstTouch ? { vitaloop_first_touch_attribution: firstTouch } : {}),
    ...(lastTouch ? { vitaloop_last_touch_attribution: lastTouch } : {}),
  }
}

export function withStoredAttribution(path) {
  const { lastTouch, firstTouch } = getStoredAttribution()
  const source = lastTouch || firstTouch
  if (!source) return path

  try {
    const url = new URL(path, 'https://vitaloop.today')
    ATTRIBUTION_KEYS.forEach((key) => {
      if (source[key] && !url.searchParams.has(key)) {
        url.searchParams.set(key, source[key])
      }
    })
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return path
  }
}
