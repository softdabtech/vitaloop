import api from './api.js'

const PENDING_ASSESSMENT_KEY = 'vitaloop:pending-public-assessment'

function isRecord(value) {
  return value
    && typeof value.assessmentId === 'string'
    && value.assessmentId.length >= 8
    && typeof value.sessionId === 'string'
    && value.sessionId.length >= 8
}

export function stagePublicAssessmentHandoff({ assessmentId, sessionId }) {
  if (typeof window === 'undefined' || !isRecord({ assessmentId, sessionId })) return false

  try {
    // Keep only the opaque ownership proof in session storage. Health-derived
    // answers and recommended labs stay server-side and never enter a URL.
    window.sessionStorage.setItem(PENDING_ASSESSMENT_KEY, JSON.stringify({ assessmentId, sessionId }))
    return true
  } catch {
    return false
  }
}

export function readPendingPublicAssessment() {
  if (typeof window === 'undefined') return null
  try {
    const value = JSON.parse(window.sessionStorage.getItem(PENDING_ASSESSMENT_KEY) || 'null')
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

export function clearPendingPublicAssessment() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(PENDING_ASSESSMENT_KEY)
  } catch {
    // Session storage can be unavailable in hardened browser contexts.
  }
}

export async function claimPendingPublicAssessment() {
  const pending = readPendingPublicAssessment()
  if (!pending) return false

  try {
    const { data } = await api.post('/assessment/claim', {
      assessment_id: pending.assessmentId,
      session_id: pending.sessionId,
    })
    if (!data?.claimed) return false
    clearPendingPublicAssessment()
    return true
  } catch {
    // Do not discard the handoff context on a transient auth or network race.
    return false
  }
}
