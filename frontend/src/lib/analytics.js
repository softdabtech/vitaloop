/**
 * Google Analytics 4 (G-LG0BCMBJJE) event helpers.
 *
 * All functions are safe to call even before gtag loads — they no-op silently.
 * Import only what you need; tree-shaking keeps the bundle minimal.
 */

import { PREMIUM_MONTHLY_PRICE } from './pricing.js'

const GA_ID = 'G-LG0BCMBJJE'

function fbqTrack(eventName, params = {}) {
  if (typeof window === 'undefined') return
  if (typeof window.fbq !== 'function') return
  try {
    window.fbq('track', eventName, params)
  } catch {
    // Never throw from analytics
  }
}

function gtag(...args) {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') return
  window.gtag(...args)
}

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/** Fire any GA4 event with arbitrary parameters. */
export function gaEvent(eventName, params = {}) {
  try {
    gtag('event', eventName, {
      ...params,
      send_to: GA_ID,
      engagement_time_msec: 100,
    })
  } catch {
    // Never throw from analytics
  }
}

// ---------------------------------------------------------------------------
// Navigation — SPA page views
// ---------------------------------------------------------------------------

/**
 * Send a manual page_view for SPA navigation.
 * Call this on every route change (handled centrally in App.jsx via GAPageTracker).
 */
export function gaPageView(path, title) {
  try {
    gtag('event', 'page_view', {
      page_path: path,
      page_title: title || (typeof document !== 'undefined' ? document.title : ''),
      send_to: GA_ID,
    })
  } catch {
    // Never throw from analytics
  }
}

// ---------------------------------------------------------------------------
// Auth — Recommended GA4 events
// ---------------------------------------------------------------------------

/**
 * Fire when a new user successfully creates an account.
 * @param {'email'|'google'} method
 */
export function gaSignUp(method = 'email') {
  gaEvent('sign_up', { method })
  fbqTrack('CompleteRegistration', {
    content_name: 'signup',
    status: true,
    method,
  })
}

// Stage 2I: gaSignupStarted/gaSignupCompleted were imported by Login.jsx but
// had no definition anywhere in this file or in git history — a missing
// live dependency (build-blocking), not a stale import (both call sites use
// them for a live signup-funnel telemetry step). Follows this file's own
// existing gaEvent()-wrapper convention (see gaSignUp/gaLogin immediately
// above) rather than inventing a new telemetry mechanism.

/**
 * Fire when a user begins the signup form (before submission).
 * @param {'email'|'google'} method
 * @param {Record<string, unknown>} [attributionParams] - see lib/attribution.js
 */
export function gaSignupStarted(method = 'email', attributionParams = {}) {
  gaEvent('signup_started', { method, ...attributionParams })
}

/**
 * Fire when a signup form submission succeeds (account created).
 * @param {'email'|'google'} method
 * @param {Record<string, unknown>} [attributionParams] - see lib/attribution.js
 */
export function gaSignupCompleted(method = 'email', attributionParams = {}) {
  gaEvent('signup_completed', { method, ...attributionParams })
}

/**
 * Fire when an existing user signs in successfully.
 * @param {'email'|'google'} method
 */
export function gaLogin(method = 'email') {
  gaEvent('login', { method })
}

// ---------------------------------------------------------------------------
// Billing — Recommended GA4 e-commerce events
// ---------------------------------------------------------------------------

/**
 * Fire when a user initiates the Stripe checkout flow.
 * Treat as the top-of-funnel purchase intent signal.
 */
export function gaBeginCheckout(priceLabel = null) {
  gaEvent('begin_checkout', {
    currency: 'USD',
    value: PREMIUM_MONTHLY_PRICE,
    items: [
      {
        item_id: 'vitaloop_premium',
        item_name: 'VITALOOP Premium',
        item_category: 'subscription',
        price: PREMIUM_MONTHLY_PRICE,
        quantity: 1,
      },
    ],
    ...(priceLabel ? { coupon: priceLabel } : {}),
  })
  fbqTrack('InitiateCheckout', {
    currency: 'USD',
    value: PREMIUM_MONTHLY_PRICE,
  })
  fbqTrack('AddPaymentInfo', {
    currency: 'USD',
    value: PREMIUM_MONTHLY_PRICE,
  })
}

/**
 * Fire on a confirmed purchase / successful Stripe checkout return.
 * Pass the Stripe session / transaction ID if available.
 */
export function gaPurchase(transactionId, value = PREMIUM_MONTHLY_PRICE) {
  gaEvent('purchase', {
    transaction_id: transactionId || `vtl_${Date.now()}`,
    currency: 'USD',
    value,
    items: [
      {
        item_id: 'vitaloop_premium',
        item_name: 'VITALOOP Premium',
        item_category: 'subscription',
        price: value,
        quantity: 1,
      },
    ],
  })
  fbqTrack('Purchase', {
    currency: 'USD',
    value,
  })
  fbqTrack('Subscribe', {
    currency: 'USD',
    value,
  })
}

/** Fire when a user views pricing/subscription content. */
export function gaViewPricing(source = 'subscription') {
  gaEvent('view_item', {
    item_category: 'subscription',
    item_name: 'VITALOOP Premium',
    source,
  })
  fbqTrack('ViewContent', {
    content_name: 'VITALOOP Premium',
    content_category: 'subscription',
  })
}

// ---------------------------------------------------------------------------
// Core user activation events
// ---------------------------------------------------------------------------

/**
 * Fire when a lab upload is successfully analyzed.
 * Maps to GA4 `generate_lead` (built-in) + custom `lab_upload_completed`.
 */
export function gaLabUpload() {
  gaEvent('generate_lead', {
    event_category: 'activation',
    event_label: 'lab_upload_completed',
    value: 1,
  })
  gaEvent('lab_upload_completed')
  fbqTrack('Lead', {
    content_name: 'lab_upload_completed',
    value: 1,
    currency: 'USD',
  })
}

/** Fire when the user completes the onboarding flow. */
export function gaOnboardingComplete() {
  gaEvent('tutorial_complete', {
    event_category: 'activation',
    event_label: 'onboarding_flow',
  })
}

/** Fire when the user completes the adaptive health questionnaire. */
export function gaQuestionnaireComplete(score) {
  gaEvent('questionnaire_completed', {
    event_category: 'engagement',
    ...(score !== undefined ? { value: Math.round(score) } : {}),
  })
}

/** Fire when the public symptom flow returns a completed lab discussion list. */
export function gaSymptomAssessmentComplete({ assessmentId, labCount } = {}) {
  gaEvent('symptom_assessment_completed', {
    event_category: 'activation',
    ...(assessmentId ? { assessment_id: assessmentId } : {}),
    ...(Number.isFinite(labCount) ? { recommended_lab_count: labCount } : {}),
  })
}

/** Fire for high-intent public CTAs that lead into account creation. */
export function gaSignupIntent(source = 'public_site') {
  gaEvent('signup_intent', {
    event_category: 'acquisition',
    source,
  })
}

// ---------------------------------------------------------------------------
// Engagement events
// ---------------------------------------------------------------------------

/** Fire when a weekly check-in is submitted successfully. */
export function gaCheckInSubmit() {
  gaEvent('checkin_submitted', { event_category: 'engagement' })
}

/** Fire when a user views their generated protocol. */
export function gaProtocolView(uploadId) {
  gaEvent('protocol_viewed', {
    event_category: 'activation',
    upload_id: uploadId,
  })
}

/** Fire when a user views the results page after upload. */
export function gaResultsView(uploadId) {
  gaEvent('results_viewed', {
    event_category: 'activation',
    upload_id: uploadId,
  })
}

/** Fire when a user dismisses an insight. */
export function gaInsightDismiss() {
  gaEvent('insight_dismissed', { event_category: 'engagement' })
}

/** Fire when the paywall modal is shown to a user. */
export function gaPaywallImpression(reason) {
  gaEvent('paywall_impression', {
    event_category: 'monetization',
    event_label: reason || 'generic',
  })
}
