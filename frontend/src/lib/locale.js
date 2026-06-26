export function getCurrentLocale() {
  if (typeof window === 'undefined') return 'en'

  const hostname = String(window.location.hostname || '').toLowerCase()
  const pathname = String(window.location.pathname || '')
  const searchParams = new URLSearchParams(window.location.search || '')

  if (
    hostname === 'ua.vitaloop.today' ||
    pathname === '/ua' ||
    pathname.startsWith('/ua/') ||
    searchParams.get('lang') === 'uk' ||
    searchParams.get('locale') === 'uk'
  ) {
    return 'uk'
  }

  try {
    return window.localStorage.getItem('vitaloop:locale') || 'en'
  } catch {
    return 'en'
  }
}

export function isUkrainianLocale(locale = getCurrentLocale()) {
  return String(locale || '').toLowerCase().startsWith('uk')
}

export function getAcceptLanguage(locale = getCurrentLocale()) {
  return isUkrainianLocale(locale) ? 'uk-UA,uk;q=0.9,en;q=0.6' : 'en-US,en;q=0.9'
}

