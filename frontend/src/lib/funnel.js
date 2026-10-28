import api from './api.js'

function makeKey(eventType, scopeKey) {
  return `vitaloop:funnel:${eventType}:${scopeKey || 'global'}`
}

export async function trackFunnelEvent(eventType, summary, metadata = {}, options = {}) {
  const oncePerSession = Boolean(options.oncePerSession)
  const scopeKey = options.scopeKey || ''
  const storageKey = makeKey(eventType, scopeKey)

  if (oncePerSession && sessionStorage.getItem(storageKey) === '1') {
    return
  }

  try {
    await api.post('/timeline/event', {
      event_type: eventType,
      summary,
      source: 'frontend:funnel',
      metadata,
    })

    if (oncePerSession) {
      sessionStorage.setItem(storageKey, '1')
    }
  } catch {
    // Funnel tracking must never block UX.
  }
}
