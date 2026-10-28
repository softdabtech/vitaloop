/**
 * Google Analytics 4 (G-LG0BCMBJJE) event helpers.
 *
 * All functions are safe to call even before gtag loads — they no-op silently.
 * Import only what you need; tree-shaking keeps the bundle minimal.
 */

import { PREMIUM_MONTHLY_PRICE } from './pricing.js'

const GA_ID = 'G-LG0BCMBJJE'
const FORBIDDEN_PARAM = /(?:^|_)(?:email|name|phone|user_id|upload_id|assessment_id|report_id|biomarker|reference|health|symptom|diagnos|medical|lab_count|score)(?:_|$)/i
const RESERVED_UI_PARAM = /^(source|medium|campaign|term|content)$/i

export function getProductSurface(hostname = typeof window === 'undefined' ? '' : window.location.hostname) {
  return String(hostname).toLowerCase() === 'ua.vitaloop.today' ? 'ua' : 'main'
}

function safeParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([key, value]) => (
    value !== undefined && value !== null && !FORBIDDEN_PARAM.test(key) && !RESERVED_UI_PARAM.test(key)
  )))
}

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
      ...safeParams(params),
      product_surface: getProductSurface(),
      send_to: GA_ID,
      engagement_time_msec: 100,
    })
  } catch {
    // Never throw from analytics
  }
}

// ---------------------------------------------------------------------------
// Identity — stitch logged-in sessions across visits/devices
// ---------------------------------------------------------------------------

/**
 * Set (or clear) the GA4 user_id for the current session.
 * Pass the Supabase auth user id (a UUID, never email/PII) on login/hydration;
 * pass null on logout so later anonymous activity in the same tab doesn't
 * keep attributing to the previous account.
 * @param {string|null} userId
 */
export function gaSetUserId(userId) {
  // Deliberately no-op: Supabase IDs must never be sent to GA4.
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
      product_surface: getProductSurface(),
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
  // `close_convert_lead` was pre-defined as a GA4 key event with no code ever
  // firing it (found empty during a 2026-09-02 tracking audit). Per business
  // decision that day: it marks a lead converting into a registered account —
  // paired with sign_up rather than replacing it, so existing sign_up history
  // stays intact.
  gaEvent('close_convert_lead', { method })
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
  gaEvent('signup_intent', { method, ui_location: 'signup_page', entry_point: 'signup_form' })
}

/**
 * Fire when a signup form submission succeeds (account created).
 * @param {'email'|'google'} method
 * @param {Record<string, unknown>} [attributionParams] - see lib/attribution.js
 */
export function gaSignupCompleted(method = 'email', attributionParams = {}) {
  gaEvent('sign_up', { method, ui_location: 'signup_page', entry_point: 'signup_form' })
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
 * Fire when a user initiates the checkout flow (provider-agnostic).
 * Treat as the top-of-funnel purchase intent signal.
 */
export function gaBeginCheckout(priceLabel = null) {
  if (getProductSurface() === 'main') return
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
 * Fire on a confirmed purchase / successful checkout return.
 * Pass the payment provider's session/transaction ID if available.
 */
export function gaPurchase(transactionId, value = PREMIUM_MONTHLY_PRICE, currency = 'USD') {
  if (getProductSurface() === 'main') return
  gaEvent('purchase', {
    transaction_id: transactionId || `vtl_${Date.now()}`,
    currency,
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
    currency,
    value,
  })
  fbqTrack('Subscribe', {
    currency,
    value,
  })
}

/** Fire when a user views pricing/subscription content. */
export function gaViewPricing() {
  gaEvent('view_item', {
    item_category: 'subscription',
    item_name: 'VITALOOP Premium',
    ui_location: 'subscription_page',
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
  gaEvent('lab_upload_completed', { ui_location: 'upload_page' })
  fbqTrack('Lead', {
    content_name: 'lab_upload_completed',
    value: 1,
    currency: 'USD',
  })
}

/** Fire when the user starts a file or manual lab upload. */
export function gaLabUploadStarted(uploadMethod) {
  gaEvent('lab_upload_started', {
    ui_location: 'upload_page',
    ...(uploadMethod === 'file' || uploadMethod === 'manual' ? { upload_method: uploadMethod } : {}),
  })
}

/** Fire when the user completes the onboarding flow. */
export function gaOnboardingComplete() {
  gaEvent('onboarding_completed', { ui_location: 'onboarding' })
  gaEvent('tutorial_complete', {
    event_category: 'activation',
    event_label: 'onboarding_flow',
  })
}

/** Fire when the user completes the adaptive health questionnaire. */
export function gaQuestionnaireComplete(score) {
  gaEvent('questionnaire_completed', { event_category: 'engagement' })
}

/** Fire when the public symptom flow returns a completed lab discussion list. */
export function gaSymptomAssessmentComplete() {
  gaEvent('symptom_assessment_completed', { event_category: 'activation', ui_location: 'symptom_intake' })
  // `qualify_lead` was pre-defined as a GA4 key event with no code ever
  // firing it (found empty during a 2026-09-02 tracking audit). Per business
  // decision that day: an anonymous visitor finishing the public symptom
  // intake IS the lead-qualification moment — paired here, not replacing
  // symptom_assessment_completed, so existing history stays intact.
  gaEvent('qualify_lead', {
    event_category: 'activation',
  })
}

/** Fire for high-intent public CTAs that lead into account creation. */
export function gaSignupIntent(entryPoint = 'public_site') {
  gaEvent('signup_intent', {
    event_category: 'acquisition',
    ui_location: 'symptom_intake',
    entry_point: entryPoint,
  })
}

// ---------------------------------------------------------------------------
// Engagement events
// ---------------------------------------------------------------------------

/** Fire when a weekly check-in is submitted successfully. */
export function gaCheckInSubmit() {
  gaEvent('check_in_submitted', { event_category: 'engagement', ui_location: 'check_in' })
}

/** Fire when a user views their generated protocol. */
export function gaProtocolView() {
  gaEvent('protocol_viewed', {
    event_category: 'activation',
    ui_location: 'protocol_page',
  })
}

/** Fire when a user views the results page after upload. */
export function gaResultsView() {
  gaEvent('results_viewed', {
    event_category: 'activation',
    ui_location: 'results_page',
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
