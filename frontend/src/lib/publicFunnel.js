import api from './api.js'

const SESSION_KEY = 'vitaloop_public_validation_session'

function randomSessionId() {
  const webCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : null
  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID()
  }
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function getPublicFunnelSessionId() {
  if (typeof window === 'undefined') return randomSessionId()

  const existing = window.localStorage.getItem(SESSION_KEY)
  if (existing) return existing

  const sessionId = randomSessionId()
  window.localStorage.setItem(SESSION_KEY, sessionId)
  return sessionId
}

export async function trackPublicFunnelEvent(eventName, properties = {}) {
  try {
    await api.post('/assessment/events', {
      session_id: getPublicFunnelSessionId(),
      event_name: eventName,
      properties,
    })
  } catch {
    // Validation analytics must never block the public intake flow.
  }
}
