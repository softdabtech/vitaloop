// Stage 2I: this file was imported by Login.jsx (getAttributionEventParams,
// getAttributionMetadata, getSignupUserMetadata) but did not exist anywhere
// in the current source tree, and has no git history in this repository —
// unlike CoachUI.jsx (recovered verbatim from commit cc2d6d5), there is no
// prior implementation to restore here. This is a "missing live dependency"
// with no recoverable original.
//
// Rather than invent unverified product/business logic to satisfy the
// compiler, this implements only the conventional, unambiguous, industry-
// standard first-touch UTM/referrer capture pattern that the three call
// sites' names and shapes already fully pin down (read attribution signal
// already present in the URL/document, persist it so it survives navigation
// to the signup step, expose it in three shapes for the three consumers).
// No thresholds, scoring, or medical/business rules are involved.

const STORAGE_KEY = 'vo:attribution'
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

function readStored() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStored(data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Never throw from attribution capture.
  }
}

function captureFromUrl() {
  if (typeof window === 'undefined') return null
  try {
    const params = new URLSearchParams(window.location.search)
    const captured = {}
    for (const key of UTM_PARAMS) {
      const value = params.get(key)
      if (value) captured[key] = value
    }
    if (document.referrer) {
      try {
        const referrerHost = new URL(document.referrer).hostname
        if (referrerHost && referrerHost !== window.location.hostname) {
          captured.referrer = referrerHost
        }
      } catch {
        // Malformed/opaque referrer — skip it, not fatal.
      }
    }
    return Object.keys(captured).length ? captured : null
  } catch {
    return null
  }
}

/**
 * Returns the first-touch attribution snapshot for this visitor: UTM
 * params present in the current URL take priority (fresh landing), falling
 * back to whatever was captured on an earlier visit in this browser.
 * Never throws; returns {} if nothing is available.
 */
export function getAttributionMetadata() {
  const fromUrl = captureFromUrl()
  if (fromUrl) {
    // First-touch: only store if nothing was captured before, so a later
    // visit via a different (e.g. paid) channel doesn't overwrite the
    // original acquisition source.
    if (!readStored()) writeStored(fromUrl)
    return fromUrl
  }
  return readStored() || {}
}

/**
 * Same attribution snapshot, shaped for a GA-style event params object
 * (flat key/value pairs — identical shape today, kept as a separate
 * function because the three call sites are conceptually distinct
 * consumers and may need to diverge later).
 */
export function getAttributionEventParams() {
  return getAttributionMetadata()
}

/**
 * Attribution snapshot to attach as Supabase auth `data:` (user_metadata)
 * at signup, so acquisition source survives on the account record itself
 * for later CRM/reporting — not just in a one-off analytics event.
 */
export function getSignupUserMetadata() {
  return getAttributionMetadata()
}
