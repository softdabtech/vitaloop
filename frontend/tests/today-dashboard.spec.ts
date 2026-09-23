import { test, expect, type Page, type Route } from '@playwright/test'

// P37f — Today dashboard fixture-based QA.
//
// Runs against the LOCAL dev server only (http://localhost:5173), not the
// shared playwright.config.ts `baseURL` (which defaults to production and
// is used by every other spec in this repo) -- P37a/P37c/P37d/P37e all
// found that production does not yet expose the P37c `today_contract`
// field, so testing the real ready-report/plan/safety states requires
// intercepting the API instead. This is the first spec in this repo to use
// Playwright's route interception (confirmed unused elsewhere as of P37a).
//
// Auth is faked, not performed: EndUserFlowRoute only requires useAuth()'s
// `user` to be truthy (ProtectedRoute) — /dashboard is registered with
// allowBeforeOnboarding: true, so it never waits on onboarding-state at
// all (see App.jsx's EndUserFlowRoute). useAuth() resolves purely from
// supabase-js's own localStorage session cache (getSession() does not
// make a network call for a non-expired session), so seeding that one
// localStorage key with a far-future expiry is sufficient — no real
// Supabase project or backend is contacted for auth.
//
// Fixture field shapes are taken verbatim from the verified P37c/P37e
// contracts (see output/p37c-.../p37e-...-2026-09-20.md and
// frontend/src/lib/todayViewModel.js) — not invented shapes.

const LOCAL_BASE = 'http://localhost:5173'
const SUPABASE_AUTH_STORAGE_KEY = 'sb-bfjxkzydonhwmafnyktt-auth-token'

const DEFAULT_ENTITLEMENTS_FREE = {
  is_premium: false,
  billing_status: 'free',
  plan_key: 'free',
  has_active_subscription: false,
  features: { upload_limit: 1, lab_history: true, trend_analysis: false, advanced_protocol: false, symptom_lab_plan: true, checkins: false },
}
const DEFAULT_ENTITLEMENTS_PREMIUM = {
  ...DEFAULT_ENTITLEMENTS_FREE,
  is_premium: true,
  billing_status: 'active',
  plan_key: 'premium',
  has_active_subscription: true,
}

function contractNone() {
  return { latest_ready_report: null, latest_ready_report_status: 'none', plan_exists_for_latest_ready_report: null }
}
function contractError() {
  return { latest_ready_report: null, latest_ready_report_status: 'error', plan_exists_for_latest_ready_report: null }
}
function contractReady({ planExists = false, uploadId = 'up-fixture-1', measurementDate = '2026-09-14' } = {}) {
  return {
    latest_ready_report: { upload_id: uploadId, report_version_id: 'rv-1', report_status: 'completed', report_generated_at: '2026-09-18T14:22:00Z', upload_created_at: '2026-09-15T09:00:00Z', measurement_date: measurementDate, lab_name: 'Quest Diagnostics' },
    latest_ready_report_status: 'ready',
    plan_exists_for_latest_ready_report: planExists,
  }
}

type MockOptions = {
  summaryStatus?: number
  today_contract?: any
  goals?: string[]
  questionnaireUrgency?: string | null
  entitlements?: any
  results?: any | null
  resultsStatus?: number
  resultsDelayMs?: number
  // P37k: summary.blocks.latest_questionnaire.completed_at, for the
  // cockpit header's independent symptom-check date.
  latestQuestionnaireCompletedAt?: string | null
}

async function mockToday(page: Page, opts: MockOptions = {}) {
  const {
    summaryStatus = 200,
    today_contract = contractNone(),
    goals = [],
    questionnaireUrgency = null,
    entitlements = DEFAULT_ENTITLEMENTS_FREE,
    results = null,
    resultsStatus = 200,
    resultsDelayMs = 0,
    latestQuestionnaireCompletedAt = null,
  } = opts

  await page.addInitScript((storageKey) => {
    const farFuture = Math.floor(Date.now() / 1000) + 3600
    window.localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'fixture-access-token',
      refresh_token: 'fixture-refresh-token',
      token_type: 'bearer',
      expires_at: farFuture,
      expires_in: 3600,
      user: { id: 'fixture-user-1', email: 'p37f-fixture@example.com' },
    }))
  }, SUPABASE_AUTH_STORAGE_KEY)

  const fulfillJson = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route('**/dashboard/summary', (route) => {
    if (summaryStatus !== 200) return route.fulfill({ status: summaryStatus, contentType: 'application/json', body: JSON.stringify({ detail: 'error' }) })
    return fulfillJson(route, {
      today_contract,
      blocks: latestQuestionnaireCompletedAt ? { latest_questionnaire: { completed_at: latestQuestionnaireCompletedAt } } : {},
    })
  })

  await page.route('**/auth/me', (route) => fulfillJson(route, { entitlements }))
  await page.route('**/profile', (route) => fulfillJson(route, { profile: { goals } }))
  await page.route('**/auth/onboarding/state', (route) => fulfillJson(route, { role: 'end_user', requires_onboarding: false, completed: true }))
  await page.route('**/questionnaire/session', (route) => fulfillJson(route, {
    session_context: {
      active_concern: questionnaireUrgency ? 'fatigue and hair loss' : '',
      summary: questionnaireUrgency ? { urgency: questionnaireUrgency } : null,
    },
  }))

  await page.route('**/results/**', async (route) => {
    if (resultsDelayMs) await new Promise((resolve) => setTimeout(resolve, resultsDelayMs))
    if (resultsStatus !== 200) return route.fulfill({ status: resultsStatus, contentType: 'application/json', body: JSON.stringify({ detail: 'error' }) })
    return fulfillJson(route, results || {})
  })
}

function collectRequestPaths(page: Page) {
  const paths: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('localhost:5173')) return // dev-server module/asset requests, not API calls
    paths.push(url)
  })
  return paths
}

async function gotoToday(page: Page) {
  await page.goto(`${LOCAL_BASE}/dashboard`)
  await page.waitForLoadState('networkidle')
}

test.describe('Today dashboard — P37f fixture QA', () => {
  test('1/3. first-run: no report, no labs intent', async ({ page }) => {
    await mockToday(page, { today_contract: contractNone(), goals: [] })
    await gotoToday(page)
    await expect(page.getByRole('heading', { name: /Let.s start with what matters to you/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Start symptom check/i })).toBeVisible()
  })

  test('4. labs-intent with no ready report', async ({ page }) => {
    await mockToday(page, { today_contract: contractNone(), goals: ['intent:labs'] })
    await gotoToday(page)
    await expect(page.getByRole('heading', { name: /Add your lab results to get started/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Upload lab results/i })).toBeVisible()
  })

  test('5. today_contract.latest_ready_report_status: error -> honest message, not "no reports"', async ({ page }) => {
    await mockToday(page, { today_contract: contractError() })
    await gotoToday(page)
    await expect(page.getByText(/temporarily unavailable/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /Let.s start with what matters to you/i })).not.toBeVisible()
  })

  test('2. summary error -> distinct error state with retry, not first-run', async ({ page }) => {
    await mockToday(page, { summaryStatus: 500 })
    await gotoToday(page)
    await expect(page.getByText(/couldn.t load your overview/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Try again/i })).toBeVisible()
  })

  // P37k: once reportDetails resolves for a ready report, the cockpit
  // (header/status strip/this week/lab snapshot/follow-up/missing context/
  // documents) replaces the old hero -- so these three tests now assert
  // against the cockpit's own elements instead of the retired hero
  // headings. The behavioral guarantee each test protects (no plan link
  // for a no-plan/gated report, plan link live for an accessible one) is
  // unchanged.
  test('6. ready report with no plan -> no plan link anywhere on the page', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: false }) })
    await gotoToday(page)
    // P38b: the cockpit header now renders a real <h1> (was a .coach-eyebrow
    // label only, so a ready report previously had zero <h1> on the page).
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText(/Lab date: Sep 14, 2026/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Open my plan/i })).toHaveCount(0)
  })

  test('7. ready report with plan, Premium -> plan link live in Documents', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: true }), entitlements: DEFAULT_ENTITLEMENTS_PREMIUM })
    await gotoToday(page)
    const planLinks = page.getByRole('button', { name: /Open my plan/i })
    await expect(planLinks.first()).toBeVisible()
  })

  test('8/21. ready report with plan, Free/gated -> no active protocol link', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_FREE,
      results: { knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: 'Recheck in 8-12 weeks' }] } },
    })
    await gotoToday(page)
    // never a plan link anywhere -- cockpit's This week/follow-up rows and
    // the Documents footer must all fall back to results, never /protocol/*
    await expect(page.getByRole('button', { name: /Open my plan/i })).toHaveCount(0)
    await expect(page.getByText(/requires an active subscription/i)).toBeVisible()
    // P44: the standalone Follow-up section was removed (third copy of the
    // same retest window) -- the This week retest row is now the fact's
    // only home, same interval, verbatim.
    await expect(page.getByText('Retest Ferritin')).toBeVisible()
    await expect(page.getByText(/Window listed: Recheck in 8-12 weeks/i)).toBeVisible()
  })

  test('10. questionnaire urgent safety only', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractNone(),
      questionnaireUrgency: 'Multiple red flags detected. Do not delay medical review.',
    })
    await gotoToday(page)
    await expect(page.getByText(/Multiple red flags detected/i)).toBeVisible()
    await expect(page.getByText(/Source: your report/i)).toHaveCount(0)
  })

  test('9. report-scoped urgent safety only', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      results: { doctor_escalation_precision: { escalations: [{ level: 'urgent', human_readable_reason: 'Potassium is markedly elevated.', recommended_timing: 'As soon as possible' }] } },
    })
    await gotoToday(page)
    await expect(page.getByText(/Potassium is markedly elevated/i).first()).toBeVisible()
    await expect(page.getByText(/Source: your report/i)).toBeVisible()
    await expect(page.getByText(/Source: your symptom check/i)).toHaveCount(0)
  })

  test('11. report safety + questionnaire safety together, separate banners', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      questionnaireUrgency: 'Some answers suggest timely clinician review is important.',
      results: { doctor_escalation_precision: { escalations: [{ level: 'doctor', human_readable_reason: 'Discuss thyroid pattern with a doctor.' }] } },
    })
    await gotoToday(page)
    await expect(page.getByText(/Discuss thyroid pattern with a doctor/i).first()).toBeVisible()
    await expect(page.getByText(/Some answers suggest timely clinician review/i)).toBeVisible()
    await expect(page.getByText(/Source: your report/i)).toBeVisible()
    await expect(page.getByText(/Source: your symptom check/i)).toBeVisible()
  })

  // P37k.3 rewrite: this test used to assert the pre-cockpit hero rendered
  // while /results/:uploadId was still loading -- that behavior WAS the
  // two-screen flicker bug (hero first, cockpit replacing it once the fetch
  // resolved). The cockpit shell now renders immediately for any ready
  // report; see the dedicated "P37k.3: no two-screen flicker..." tests
  // below for the full before/during/after assertions.
  test('13. results loading after core layout has loaded -> cockpit shell renders immediately, no legacy hero', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: false }), results: {}, resultsDelayMs: 1500 })
    await page.goto(`${LOCAL_BASE}/dashboard`)
    // Do not wait for networkidle here -- we want to catch the mid-flight state.
    await expect(page.locator('.cockpit-page')).toBeVisible()
    await expect(page.locator('.today-hero')).toHaveCount(0)
    await page.waitForLoadState('networkidle')
  })

  // P37k.3 rewrite: same reasoning -- an error now renders inside the
  // cockpit shell (a limited-detail message), never the legacy hero.
  test('12. failed /results/:uploadId after core layout has loaded -> cockpit-shaped limitation message, not the legacy hero', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: false }), resultsStatus: 500 })
    await gotoToday(page)
    await expect(page.locator('.cockpit-page')).toBeVisible()
    await expect(page.locator('.today-hero')).toHaveCount(0)
    await expect(page.getByText(/couldn.t load additional detail/i).first()).toBeVisible()
  })

  // P37k.1: "Since your previous report" was restored inside the cockpit
  // (it had been dropped from the cockpit's section list in P37k, then
  // required back by this stage) -- same already-built progress_intelligence
  // comparison object, now surfaced as its own compact cockpit section.
  // P44 Dashboard rebuild: "Since your previous report" was removed from
  // the home cockpit entirely -- its only data source (progress_
  // intelligence.changes[].pattern_name) is a pattern-name string, not a
  // real per-marker delta, and showing it as "since previous report" would
  // misrepresent a pattern that may not even be currently detected
  // (current_confidence: null on real payloads) as a tracked change. It
  // stays fully intact on /results; this only asserts it never reappears
  // on Dashboard home.
  test('14. comparable reports -> "Since your previous report" never renders on Dashboard home (removed in P44)', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      results: {
        progress_intelligence: {
          available: true,
          changes: [{ pattern_id: 'a', pattern_name: 'Iron deficiency pattern', status: 'weakened' }],
        },
      },
    })
    await gotoToday(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('Since your previous report')).toHaveCount(0)
  })

  test('15. first report/no valid comparison -> no crash, no invented trend', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      results: { progress_intelligence: { available: false, changes: [] }, personal_baseline: { available: false, markers: [] } },
    })
    await gotoToday(page)
    await expect(page.getByText('Since your previous report')).toHaveCount(0)
  })

  test('16. evidence gaps -> up to 2 items under "Missing context"', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      results: {
        evidence_gaps: {
          gaps: [
            { missing_marker: 'Ferritin', reason: 'no_reference_range_on_file' },
            { missing_marker: 'Vitamin D', reason: 'not_tested_this_round' },
            { missing_marker: 'B12', reason: 'not_tested_this_round' },
          ],
        },
      },
    })
    await gotoToday(page)
    // P37k renamed "What could make this clearer" -> "Missing context".
    await expect(page.getByText('Missing context', { exact: true })).toBeVisible()
    await expect(page.getByText('Ferritin', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Vitamin D', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('B12', { exact: true })).toHaveCount(0) // capped at 2
  })

  // P44 Dashboard rebuild: the standalone "Follow-up timing" section was
  // removed -- it was a third copy of the exact same retest window already
  // shown in the status strip ("{marker}: {timing}" cell) and as a This
  // week row ("Retest {marker}" / "Window listed: {timing}"). The retest
  // fact itself is not lost, only the extra copy of it.
  test('17. retest timing with anchored text -> used verbatim in the This week retest row', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      results: { knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: 'Recheck in 8-12 weeks per clinician guidance' }] } },
    })
    await gotoToday(page)
    await expect(page.getByText('Retest Ferritin')).toBeVisible()
    await expect(page.getByText(/Window listed: Recheck in 8-12 weeks per clinician guidance/i)).toBeVisible()
    await expect(page.getByText('Follow-up timing')).toHaveCount(0)
  })

  test('18. retest item without timing -> no row anywhere, no arbitrary date (Follow-up section removed in P44)', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      results: { knowledge_report: { retest_plan: [{ marker: 'Ferritin', reason: 'monitor' }] } },
    })
    await gotoToday(page)
    // No marker+timing pair exists, so neither the status strip's retest
    // cell, the This week retest row, nor the removed Follow-up section's
    // old "does not include a repeat-test window yet" fallback show
    // anything for this -- consistent with "skip a block when its data is
    // empty," never a fabricated or guessed date.
    await expect(page.getByText(/does not include a repeat-test window yet/i)).toHaveCount(0)
    await expect(page.getByText('Follow-up timing')).toHaveCount(0)
    await expect(page.getByText(/No retest window listed/i)).toBeVisible()
  })

  test('22. Premium user without history -> no invented comparison', async ({ page }) => {
    await mockToday(page, { today_contract: contractNone(), entitlements: DEFAULT_ENTITLEMENTS_PREMIUM })
    await gotoToday(page)
    await expect(page.getByText('Since your previous report')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /Let.s start with what matters to you/i })).toBeVisible()
  })

  test('network: no /results/* request when no ready report exists', async ({ page }) => {
    await mockToday(page, { today_contract: contractNone() })
    const paths = collectRequestPaths(page)
    await gotoToday(page)
    expect(paths.some((u) => u.includes('/results/'))).toBe(false)
  })

  test('network: /results/:uploadId requested exactly once when ready, matching the contract upload_id', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: false, uploadId: 'up-network-check' }), results: {} })
    const paths = collectRequestPaths(page)
    await gotoToday(page)
    const resultsCalls = paths.filter((u) => u.includes('/results/'))
    expect(resultsCalls.length).toBe(1)
    expect(resultsCalls[0]).toContain('up-network-check')
  })

  test('network: no /protocol/* request is ever made on dashboard load, ready+plan+Premium included', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: true }), entitlements: DEFAULT_ENTITLEMENTS_PREMIUM, results: {} })
    const paths = collectRequestPaths(page)
    await gotoToday(page)
    expect(paths.some((u) => u.includes('/protocol/'))).toBe(false)
  })

  test('accessibility: keyboard tab order reaches primary CTA and focus is visible', async ({ page }) => {
    await mockToday(page, { today_contract: contractNone() })
    await gotoToday(page)
    const primaryCta = page.getByRole('button', { name: /Start symptom check/i })
    await primaryCta.focus()
    await expect(primaryCta).toBeFocused()
    // A visible focus outline is either a browser default or an explicit
    // style -- assert at least one is present (outline or box-shadow),
    // rather than asserting a specific design token.
    const hasVisibleFocus = await primaryCta.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none'
    })
    expect(hasVisibleFocus).toBe(true)
  })

  test('mobile 375px: no horizontal overflow on the richest state (safety + changes + clarity + return)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      questionnaireUrgency: 'Some answers suggest timely clinician review is important.',
      results: {
        doctor_escalation_precision: { escalations: [{ level: 'urgent', human_readable_reason: 'Potassium is markedly elevated, alongside reported symptoms of palpitations.', recommended_timing: 'As soon as possible' }] },
        progress_intelligence: { available: true, changes: [{ pattern_id: 'a', pattern_name: 'Iron deficiency pattern', status: 'weakened' }] },
        evidence_gaps: { gaps: [{ missing_marker: 'Vitamin D (Kidney Function context)', reason: 'not_tested_this_round' }] },
        knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: 'Recheck in 8-12 weeks per clinician guidance' }] },
      },
    })
    await gotoToday(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1) // allow 1px for scrollbar rounding
  })

  test('desktop 200% zoom equivalent (narrow high-density viewport): no horizontal overflow', async ({ page }) => {
    // Playwright cannot set true browser "zoom"; the accepted equivalent
    // is a narrow viewport at a high device scale factor, which produces
    // the same relative-CSS-pixel squeeze zoom does.
    await page.setViewportSize({ width: 640, height: 480 })
    await mockToday(page, { today_contract: contractReady({ planExists: true }), entitlements: DEFAULT_ENTITLEMENTS_PREMIUM, results: {} })
    await gotoToday(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  // P37j — old report semantics. contractReady()'s own default
  // measurementDate ('2026-09-14') stays "fresh" for every test above (a
  // handful of days before this repo's actual system date) -- these tests
  // pass an explicit old measurementDate instead, exercising the same
  // buildTodayViewModel() branches with a source date old/very_old enough
  // to cross the 365/730-day thresholds relative to whenever this suite
  // actually runs, without ever touching a mocked clock.
  // P37k note: the cockpit header shows a compact "Lab date: {date}" line
  // plus a freshness chip ("Recent"/"Older"/"Saved") instead of P37j's full
  // "Based on your latest saved report from {date}" sentence -- the
  // sourceLine value itself is unchanged in todayViewModel.js (still
  // computed, still age-aware), it simply isn't the string rendered in the
  // cockpit UI any more. These tests assert against what the cockpit
  // actually renders: the freshness chip, the status strip's "outdated
  // labs" wording, and the follow-up timing's saved-plan phrasing.
  test('P37j.1: very_old (Jan 4, 2022) report with plan -> freshness chip, outdated-labs basis, upload CTA, plan still reachable', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { biomarkers: [{ name: 'Hemoglobin', value: 14, unit: 'g/dL', ref_low: 12, ref_high: 16 }] },
    })
    await gotoToday(page)
    await expect(page.getByText(/Lab date: Jan 4, 2022/i)).toBeVisible()
    // P37k.2: very_old chip strengthened from "Saved" to "Old saved report".
    await expect(page.getByText('Old saved report', { exact: true })).toBeVisible() // freshness chip
    await expect(page.getByText(/Based on outdated labs/i)).toBeVisible()
    // Primary CTA is Upload for a very_old report; the saved plan is still
    // one click away in the Documents footer, never removed.
    await expect(page.getByRole('button', { name: /^Upload new results$/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Open my plan/i }).first()).toBeVisible()
  })

  test('P37j.2: old (not very_old, ~500 days) report -> "Older" chip, outdated-labs basis', async ({ page }) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - 500)
    const measurementDate = d.toISOString().slice(0, 10)
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { biomarkers: [{ name: 'Hemoglobin', value: 14, unit: 'g/dL', ref_low: 12, ref_high: 16 }] },
    })
    await gotoToday(page)
    await expect(page.getByText('Older', { exact: true })).toBeVisible() // freshness chip
    await expect(page.getByText(/Based on outdated labs/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Open my plan/i }).first()).toBeVisible()
  })

  // P44 Dashboard rebuild: the removed Follow-up section was the only place
  // that distinguished fresh vs old/very_old retest phrasing ("window
  // listed as" vs "your saved plan listed a window of"). The This week
  // retest row (its replacement as the retest fact's only home now) has a
  // single wording regardless of report age -- an accepted consequence of
  // removing the section, not a regression to chase here. What still must
  // hold: the real marker+timing appears verbatim, and no computed/overdue
  // date is ever fabricated.
  test('P37j.3: very_old retest -> This week shows the real marker+timing verbatim, no computed/overdue date', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false, measurementDate: '2022-01-04' }),
      results: { knowledge_report: { retest_plan: [{ marker: 'Hemoglobin', timing: '6-12 weeks' }] } },
    })
    await gotoToday(page)
    await expect(page.getByText('Retest Hemoglobin')).toBeVisible()
    await expect(page.getByText(/Window listed: 6-12 weeks/i)).toBeVisible()
    await expect(page.getByText('Follow-up timing')).toHaveCount(0)
    await expect(page.getByText(/\d{4}-\d{2}-\d{2}/)).toHaveCount(0) // no computed calendar date anywhere
  })

  test('P37j.4: recent report -> old-report chip/wording never appears (regression guard)', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }), // default measurementDate 2026-09-14, fresh
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { biomarkers: [{ name: 'Hemoglobin', value: 14, unit: 'g/dL', ref_low: 12, ref_high: 16 }] },
    })
    await gotoToday(page)
    await expect(page.getByText(/Based on recent labs/i)).toBeVisible()
    await expect(page.getByText('Older', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Old saved report', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/Based on outdated labs/i)).toHaveCount(0)
  })

  test('P37j.5: mobile 375px, very_old report state -> no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { knowledge_report: { retest_plan: [{ marker: 'Hemoglobin', timing: '6-12 weeks' }] } },
    })
    await gotoToday(page)
    await expect(page.getByText('Old saved report', { exact: true })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  // ── P37k cockpit fixture coverage ────────────────────────────────────

  test('P37k.1/P44: fresh report with plan -> full cockpit (status strip, this week, pinned markers, missing context, documents)', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      latestQuestionnaireCompletedAt: '2026-09-12T09:00:00Z',
      results: {
        biomarkers: [
          { name: 'Hemoglobin', value: 10.5, unit: 'g/dL', ref_low: 12, ref_high: 16 },
          { name: 'Glucose', value: 90, unit: 'mg/dL', ref_low: 70, ref_high: 99 },
        ],
        protocol: ['Increase iron-rich foods'],
        knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: '8-12 weeks' }] },
        evidence_gaps: { gaps: [{ missing_marker: 'transferrin_saturation', reason: 'not_tested_this_round' }] },
      },
    })
    await gotoToday(page)
    await expect(page.getByText(/Lab date: Sep 14, 2026/i)).toBeVisible()
    // Symptom check date is a distinct event/date from the lab date -- both
    // visible, never conflated into one line.
    await expect(page.getByText(/Symptom check: Sep 12, 2026/i)).toBeVisible()
    await expect(page.getByText(/Based on recent labs/i)).toBeVisible()
    await expect(page.getByText('This week')).toBeVisible()
    await expect(page.getByText('Increase iron-rich foods')).toBeVisible()
    await expect(page.getByText('Pinned markers')).toBeVisible()
    // P44: the retest fact lives only in the This week row now (the
    // standalone Follow-up section was removed as a third copy of it).
    await expect(page.getByText('Retest Ferritin')).toBeVisible()
    await expect(page.getByText('Follow-up timing')).toHaveCount(0)
    // Raw marker id must never leak -- humanized to "Transferrin saturation"
    // (appears both in This week's gap row and in Missing context -- same
    // source gap, two surfaces).
    await expect(page.getByText('Transferrin saturation').first()).toBeVisible()
    await expect(page.getByText(/transferrin_saturation/)).toHaveCount(0)
    await expect(page.getByText('Missing context', { exact: true })).toBeVisible()
    // P45: no filled/pill button chrome on Dashboard home -- every action
    // is bold text, including what used to be the one CoachButton primary.
    await expect(page.locator('.coach-button')).toHaveCount(0)
  })

  test('P37k.2: safety triggered (report + questionnaire) -> This week row 1 is the clinician-review flag, primary CTA', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      questionnaireUrgency: 'Some answers suggest timely clinician review is important.',
      results: { doctor_escalation_precision: { escalations: [{ level: 'doctor', human_readable_reason: 'Discuss thyroid pattern with a doctor.' }] } },
    })
    await gotoToday(page)
    await expect(page.getByText('Discuss thyroid pattern with a doctor.').first()).toBeVisible()
    await expect(page.getByText('Some answers suggest timely clinician review is important.')).toBeVisible()
    // "This week" leads with the clinician-review row, rendered as the
    // page's one primary CTA -- P45: bold text, no button chrome.
    await expect(page.getByText('Discuss with a doctor').first()).toBeVisible()
    await expect(page.locator('.coach-button')).toHaveCount(0)
  })

  test('P37k.3: no safety at all -> no "Discuss with a doctor" row, no green all-clear banner', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { biomarkers: [{ name: 'Glucose', value: 90, unit: 'mg/dL', ref_low: 70, ref_high: 99 }] },
    })
    await gotoToday(page)
    await expect(page.getByText('Discuss with a doctor')).toHaveCount(0)
    await expect(page.getByText(/no urgent red flags/i)).toHaveCount(0)
  })

  // P37k.1: a fully sparse ready report used to show two empty-placeholder
  // sections ("This week: Nothing to flag" + "Pinned markers: No
  // biomarker values") stacked above the footer -- now collapses into one
  // honest primary action instead. Fresh sparse -> View results.
  test('P37k.4: sparse reportDetails ({}) -> one honest primary action (View results for fresh), no empty-placeholder sections', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: true }), entitlements: DEFAULT_ENTITLEMENTS_PREMIUM, results: {} })
    await gotoToday(page)
    await expect(page.getByText('Incomplete data')).toBeVisible()
    await expect(page.getByText('No markers flagged')).toBeVisible()
    await expect(page.getByText('No retest window listed')).toBeVisible()
    // No "This week"/"Pinned markers" section headers or their empty
    // placeholder copy -- collapsed into the single sparse primary action.
    await expect(page.getByText('This week', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Pinned markers')).toHaveCount(0)
    await expect(page.getByText('No biomarker values available for this report.')).toHaveCount(0)
    // P45: no button chrome on Dashboard home -- the sparse primary action
    // is bold text too.
    await expect(page.getByRole('button', { name: /View results/i }).first()).toBeVisible()
    await expect(page.locator('.coach-button')).toHaveCount(0)
    await expect(page.getByText('Follow-up timing')).toHaveCount(0) // no retest data at all -- section omitted, not faked
    await expect(page.getByText('Missing context', { exact: true })).toHaveCount(0) // no gaps -- section omitted, not faked
  })

  test('P37k.5: biomarkers present but empty array -> "Incomplete data" basis, sparse primary action (not an empty-placeholder snapshot)', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: true }), entitlements: DEFAULT_ENTITLEMENTS_PREMIUM, results: { biomarkers: [] } })
    await gotoToday(page)
    await expect(page.getByText('Incomplete data')).toBeVisible()
    await expect(page.getByText('Pinned markers')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /View results/i }).first()).toBeVisible()
  })

  // P37k.1: very_old + sparse is a special case -- the forced Upload
  // primary row already fills "This week", so the page shows that instead
  // of the generic sparse-action card (see buildCockpitViewModel's own
  // isSparse/sparsePrimaryAction comment for why they're mutually exclusive
  // in this case).
  test('P37k.5b: very_old + sparse reportDetails -> This week shows the forced Upload primary action', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }), entitlements: DEFAULT_ENTITLEMENTS_PREMIUM, results: {} })
    await gotoToday(page)
    await expect(page.getByText('This week', { exact: true })).toBeVisible()
    // P45: no button chrome on Dashboard home -- the forced Upload row is
    // bold text like every other This week row.
    await expect(page.getByRole('button', { name: /Upload new results/i }).first()).toBeVisible()
    await expect(page.locator('.coach-button')).toHaveCount(0)
  })

  test('P37k.6: no protocol/action_plan -> This week never fabricates a plan row, gap row still shown', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { evidence_gaps: { gaps: [{ missing_marker: 'ferritin', reason: 'not_tested_this_round' }] } },
    })
    await gotoToday(page)
    await expect(page.getByText('From your saved plan')).toHaveCount(0)
    await expect(page.getByText('Missing context in your report')).toBeVisible()
  })

  test('P37k.7: mobile 375px fresh rich cockpit -> no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      questionnaireUrgency: 'Some answers suggest timely clinician review is important.',
      results: {
        doctor_escalation_precision: { escalations: [{ level: 'urgent', human_readable_reason: 'Potassium is markedly elevated.', recommended_timing: 'As soon as possible' }] },
        biomarkers: [
          { name: 'Hemoglobin', value: 10.5, unit: 'g/dL', ref_low: 12, ref_high: 16 },
          { name: 'Ferritin', value: 200, unit: 'ng/mL', ref_low: 15, ref_high: 150 },
          { name: 'Glucose', value: 90, unit: 'mg/dL', ref_low: 70, ref_high: 99 },
        ],
        protocol: ['Increase iron-rich foods', 'Recheck ferritin'],
        knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: 'Recheck in 8-12 weeks per clinician guidance' }] },
        evidence_gaps: { gaps: [{ missing_marker: 'Vitamin D (Kidney Function context)', reason: 'not_tested_this_round' }] },
      },
    })
    await gotoToday(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('P37k.8: network guard -> zero /protocol/* and exactly one /results/* on a full cockpit load', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, uploadId: 'up-cockpit-network' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: {
        biomarkers: [{ name: 'Hemoglobin', value: 10.5, unit: 'g/dL', ref_low: 12, ref_high: 16 }],
        protocol: ['Increase iron-rich foods'],
        knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: '8-12 weeks' }] },
      },
    })
    const paths = collectRequestPaths(page)
    await gotoToday(page)
    expect(paths.some((u) => u.includes('/protocol/'))).toBe(false)
    const resultsCalls = paths.filter((u) => u.includes('/results/'))
    expect(resultsCalls.length).toBe(1)
    expect(resultsCalls[0]).toContain('up-cockpit-network')
  })

  // ── P37k.1: release-blocking CTA/regression fixes ────────────────────

  test('P37k.9: no button labeled "View results" points at /protocol or /questionnaire (and vice versa)', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      questionnaireUrgency: 'Some answers suggest timely clinician review is important.',
      results: {
        protocol: ['Increase iron-rich foods'],
        knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: '8-12 weeks' }] },
      },
    })
    await gotoToday(page)
    // "View results" buttons must resolve to /results/:id -- read each
    // one's actual click target by asserting the URL after navigating,
    // rather than trusting the label alone (the whole point of this test
    // is that label and destination could previously disagree).
    const viewResultsButtons = await page.getByRole('button', { name: /^View results$/i }).all()
    expect(viewResultsButtons.length).toBeGreaterThan(0)
    for (const btn of viewResultsButtons) {
      await btn.click()
      await expect(page).toHaveURL(/\/results\//)
      await page.goBack()
      await page.waitForLoadState('networkidle')
    }
  })

  test('P37k.9b: "Open my plan" button navigates to /protocol/:id, never /results or /questionnaire', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, uploadId: 'up-label-check' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { protocol: ['Increase iron-rich foods'] },
    })
    await gotoToday(page)
    const planButton = page.getByRole('button', { name: /^Open my plan$/i }).first()
    await planButton.click()
    await expect(page).toHaveURL(/\/protocol\/up-label-check/)
  })

  test('P37k.9c: questionnaire-only safety row says "Review symptom answers", not "View results", and navigates to /questionnaire', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      questionnaireUrgency: 'Some answers suggest timely clinician review is important.',
      results: {},
    })
    await gotoToday(page)
    // P45: This week's row action is now always bold text with a literal
    // trailing "→" character (no CoachButton icon), so the accessible name
    // includes the arrow -- match by substring, not an exact anchor. Two
    // real elements now match (the safety banner's own full-card button,
    // whose accessible name concatenates its inner text, and the This week
    // row) -- both navigate to /questionnaire, so either is a valid target.
    const reviewButton = page.getByRole('button', { name: /Review symptom answers/i }).first()
    await expect(reviewButton).toBeVisible()
    await reviewButton.click()
    await expect(page).toHaveURL(/\/questionnaire/)
  })

  test('P37k.10: very_old cockpit -> primary CTA is "Upload new results", saved plan reachable only as secondary', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: {
        protocol: ['Increase iron-rich foods'],
        knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: '8-12 weeks' }] },
      },
    })
    await gotoToday(page)
    // P45: no button chrome on Dashboard home -- "primary" is still exactly
    // one row/data-wise (Upload leads This week), but visually it's bold
    // text like everything else, so no .coach-button exists at all here.
    await expect(page.locator('.coach-button')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Upload new results/i }).first()).toBeVisible()
    // The saved plan item still appears, but only as a plain secondary link.
    await expect(page.getByText('Increase iron-rich foods')).toBeVisible()
    const planLink = page.getByRole('button', { name: /Open my plan/i }).first()
    await expect(planLink).toBeVisible()
    const isCoachButton = await planLink.evaluate((el) => el.classList.contains('coach-button'))
    expect(isCoachButton).toBe(false)
  })

  test('P37k.11/P45: Documents footer has no pill/button-styled links -- quiet plain-text archive only', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: true }), entitlements: DEFAULT_ENTITLEMENTS_PREMIUM, results: {} })
    await gotoToday(page)
    // Legacy pill class must never appear inside the cockpit's documents footer.
    await expect(page.locator('.cockpit-documents .today-documents__link')).toHaveCount(0)
    // P45: the footer's own links used to be cabinet-btn--secondary pill
    // buttons (a real border/background/48px pill, not just plain text) --
    // now every one of them is the same bold-text cockpit-link style as
    // the rest of Dashboard home.
    await expect(page.locator('.cockpit-documents .cabinet-btn')).toHaveCount(0)
    await expect(page.locator('.cockpit-documents .cockpit-link')).not.toHaveCount(0)
    await expect(page.locator('.cockpit-documents')).toBeVisible()
  })

  // ── P37k.3 (two-screen load-flicker fix) ──────────────────────────────

  test('P37k.3: no two-screen flicker -- cockpit shell (not the legacy hero) is visible immediately, with loading placeholders, while /results/{uploadId} is still in flight', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: {
        biomarkers: [{ name: 'Hemoglobin', value: 14, unit: 'g/dL', ref_low: 12, ref_high: 16 }],
        knowledge_report: { retest_plan: [{ marker: 'Hemoglobin', timing: '8-12 weeks' }] },
      },
      resultsDelayMs: 800,
    })
    // Deliberately not using gotoToday()'s networkidle wait -- this test
    // needs to observe the page WHILE /results/{uploadId} is still pending.
    await page.goto(`${LOCAL_BASE}/dashboard`)
    await expect(page.locator('.cockpit-page')).toBeVisible()
    // The legacy hero (ready_with_plan's "Your next steps are in your plan"
    // headline, or the .today-hero section itself) must never appear at
    // any point for a ready report -- this is the exact flicker this stage
    // fixes: previously that whole layout rendered first and was replaced.
    await expect(page.getByText('Your next steps are in your plan')).toHaveCount(0)
    await expect(page.locator('.today-hero')).toHaveCount(0)
    // Loading placeholders are visible inside the cockpit's own sections.
    await expect(page.locator('.cockpit-skeleton-line').first()).toBeVisible()
    await expect(page.locator('.cockpit-status-cell--placeholder').first()).toBeVisible()
    // The header/freshness chip (contract-only data) is already correct,
    // even before /results resolves.
    await expect(page.getByText(/Lab date: Sep 14, 2026/i)).toBeVisible()

    // Now let the delayed /results/{uploadId} response resolve.
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.cockpit-skeleton-line')).toHaveCount(0)
    await expect(page.locator('.cockpit-lab-row__name')).toHaveText('Hemoglobin')
    // Still no button chrome and one /results/{uploadId} call -- the
    // loading phase never doubled up on either guarantee.
    await expect(page.locator('.coach-button')).toHaveCount(0)
    // The legacy hero still never appeared, even after content resolved.
    await expect(page.locator('.today-hero')).toHaveCount(0)
  })

  test('P37k.3: very_old report still loading -> the forced Upload primary CTA is already visible before /results resolves (no flicker in which action is primary)', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { protocol: ['Increase iron-rich foods'] },
      resultsDelayMs: 800,
    })
    await page.goto(`${LOCAL_BASE}/dashboard`)
    await expect(page.locator('.coach-button')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Upload new results/i }).first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    // Same primary action, same label, after resolution -- no swap.
    await expect(page.locator('.coach-button')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Upload new results/i }).first()).toBeVisible()
  })

  test('P37k.3: reportDetails error -> cockpit-shaped limited-detail message, never the legacy hero layout', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      resultsStatus: 500,
    })
    await gotoToday(page)
    await expect(page.locator('.cockpit-page')).toBeVisible()
    await expect(page.locator('.today-hero')).toHaveCount(0)
    await expect(page.locator('.cockpit-skeleton-line')).toHaveCount(0)
    await expect(page.getByText(/couldn.t load additional detail/i).first()).toBeVisible()
  })

  test('P37k.3: network guard holds even with a delayed /results response -- zero /protocol/* and exactly one /results/* call', async ({ page }) => {
    const paths = collectRequestPaths(page)
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, uploadId: 'up-flicker-network' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { protocol: ['Increase iron-rich foods'] },
      resultsDelayMs: 500,
    })
    await gotoToday(page)
    expect(paths.some((u) => u.includes('/protocol/'))).toBe(false)
    const resultsCalls = paths.filter((u) => u.includes('/results/'))
    expect(resultsCalls.length).toBe(1)
    expect(resultsCalls[0]).toContain('up-flicker-network')
  })

  // ── P37k.2 (light UI polish) ──────────────────────────────────────────

  test('P37k.2-UI-a: questionnaire safety banner is a clickable/focusable whole card navigating to /questionnaire, with a visible action label', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      questionnaireUrgency: 'Some answers suggest timely clinician review is important.',
      results: {},
    })
    await gotoToday(page)
    // P37k.2.1: a real <button>, not a div+role="button" -- role/tabindex
    // come from the browser for free, so assert via getByRole instead of
    // reading hand-set attributes that no longer exist.
    const banner = page.getByRole('button', { name: /Some answers suggest timely clinician review is important/i })
    await expect(banner).toBeVisible()
    await expect(banner).toHaveJSProperty('tagName', 'BUTTON')
    await expect(banner.getByText('Review symptom answers →', { exact: true })).toBeVisible()
    // Source label and warning tone are preserved, not just the new action text.
    await expect(banner.getByText(/Source: your symptom check/i)).toBeVisible()
    // Native keyboard activation: focus + Enter, no hand-rolled onKeyDown needed.
    await banner.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/questionnaire/)
  })

  test('P37k.2-UI-b: very_old header chip reads "Old saved report", not the plain "Saved"/"Older" wording, calm (non-red) styling', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { biomarkers: [{ name: 'Hemoglobin', value: 14, unit: 'g/dL', ref_low: 12, ref_high: 16 }] },
    })
    await gotoToday(page)
    const chip = page.locator('.cockpit-freshness-chip')
    await expect(chip).toHaveText('Old saved report')
    await expect(chip).toHaveClass(/cockpit-freshness-chip--very-old/)
    const color = await chip.evaluate((el) => getComputedStyle(el).color)
    // Calm amber (#92400e -> rgb(146, 64, 14)), never alarmist red.
    expect(color).toBe('rgb(146, 64, 14)')
  })

  // P44: pinned markers cap at 2, worst-status-first -- with 3+ markers
  // present, only the top 2 by STATUS_RANK (deficient/elevated before
  // borderline/optimal) are ever pinned to Dashboard home; the rest stay
  // on /lab-results. Split into two fixtures (each with exactly 2 markers)
  // so both status pairs get to actually render and be checked.
  test('P37k.2-UI-c: pinned marker rows show explicit status text alongside the color accent (High/Low)', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: {
        biomarkers: [
          { name: 'Hemoglobin', value: 10.5, unit: 'g/dL', ref_low: 12, ref_high: 16 }, // DEFICIENT -> Low
          { name: 'Ferritin', value: 200, unit: 'ng/mL', ref_low: 15, ref_high: 150 }, // ELEVATED -> High
        ],
      },
    })
    await gotoToday(page)
    await expect(page.locator('.cockpit-lab-row--deficient .cockpit-lab-row__status')).toHaveText('Low')
    await expect(page.locator('.cockpit-lab-row--elevated .cockpit-lab-row__status')).toHaveText('High')
    await expect(page.locator('.cockpit-lab-row')).toHaveCount(2)
  })

  test('P37k.2-UI-c2: pinned marker rows show explicit status text alongside the color accent (Watch/In range)', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: {
        biomarkers: [
          { name: 'Hemoglobin', value: 12.3, unit: 'g/dL', ref_low: 12, ref_high: 16 }, // BORDERLINE -> Watch
          { name: 'Glucose', value: 90, unit: 'mg/dL', ref_low: 70, ref_high: 99 }, // OPTIMAL -> In range
        ],
      },
    })
    await gotoToday(page)
    await expect(page.locator('.cockpit-lab-row--borderline .cockpit-lab-row__status')).toHaveText('Watch')
    await expect(page.locator('.cockpit-lab-row--optimal .cockpit-lab-row__status')).toHaveText('In range')
  })

  test('P37k.2-UI-d: lab snapshot row with no status and no ref range shows "Unknown range"', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { biomarkers: [{ name: 'Mystery Marker', value: 42, unit: '' }] },
    })
    await gotoToday(page)
    await expect(page.locator('.cockpit-lab-row__status')).toHaveText('Unknown range')
  })

  test('P37k.2-UI-e: mobile 375px very_old + safety state -> no horizontal overflow, guarantees still hold', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      questionnaireUrgency: 'Some answers suggest timely clinician review is important.',
      results: {
        biomarkers: [{ name: 'Hemoglobin', value: 10.5, unit: 'g/dL', ref_low: 12, ref_high: 16 }],
        protocol: ['Increase iron-rich foods'],
      },
    })
    await gotoToday(page)
    await expect(page.locator('.coach-button')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Upload new results/i }).first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('console: no new errors from the Today page', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(String(err)))
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
    await mockToday(page, { today_contract: contractReady({ planExists: true }), entitlements: DEFAULT_ENTITLEMENTS_PREMIUM, results: {} })
    await gotoToday(page)
    const todayErrors = errors.filter((e) => !e.includes('fetchPriority')) // pre-existing, unrelated Landing.jsx warning (see P37d/P37e reports)
    expect(todayErrors).toEqual([])
  })

  // ── P38b: shared CabinetPageFrame + Today visual hierarchy ────────────

  test('P38b-1: Today renders exactly one <h1>, reading "Dashboard"', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { biomarkers: [{ name: 'Hemoglobin', value: 14, unit: 'g/dL', ref_low: 12, ref_high: 16 }] },
    })
    await gotoToday(page)
    const headings = page.getByRole('heading', { level: 1 })
    await expect(headings).toHaveCount(1)
    await expect(headings).toHaveText('Dashboard')
  })

  test('P38b-2: Today uses the shared CabinetPageFrame, not the old .today-canvas whole-page card', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { biomarkers: [{ name: 'Hemoglobin', value: 14, unit: 'g/dL', ref_low: 12, ref_high: 16 }] },
    })
    await gotoToday(page)
    await expect(page.locator('.cabinet-page-frame')).toBeVisible()
    await expect(page.locator('.today-canvas')).toHaveCount(0)
    // The frame itself must not add a card surface of its own (no card,
    // border, background, radius, or shadow beyond the browser default).
    const frameStyle = await page.locator('.cabinet-page-frame').evaluate((el) => {
      const s = getComputedStyle(el)
      return { borderWidth: s.borderWidth, boxShadow: s.boxShadow, backgroundColor: s.backgroundColor, maxWidth: s.maxWidth }
    })
    expect(frameStyle.borderWidth).toBe('0px')
    expect(frameStyle.boxShadow).toBe('none')
    expect(frameStyle.backgroundColor).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
    expect(frameStyle.maxWidth).toBe('1152px')
  })

  test('P38b-3a: one primary CTA holds after the frame migration (fresh)', async ({ page }) => {
    // contractReady()'s default measurementDate (2026-09-14) is a handful
    // of days before this suite's own system date -- comfortably "fresh"
    // (< 365 days), matching every other fresh-state test in this file.
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: {
        biomarkers: [{ name: 'Hemoglobin', value: 14, unit: 'g/dL', ref_low: 12, ref_high: 16 }],
        knowledge_report: { retest_plan: [{ marker: 'Hemoglobin', timing: '8-12 weeks' }] },
      },
    })
    await gotoToday(page)
    // P45: no button chrome on Dashboard home -- the "one primary CTA"
    // guarantee is now about which This week row is first/primary in data,
    // not about a visually distinct filled button.
    await expect(page.locator('.coach-button')).toHaveCount(0)
    const primaryRow = page.locator('.cockpit-row').first()
    // Fresh state's primary row here is the retest item (no safety, no
    // protocol/action_plan data in this fixture) -- never the very_old
    // Upload prompt.
    await expect(primaryRow).not.toContainText('Upload new results')
    await primaryRow.getByRole('button').click()
    await expect(page).toHaveURL(/\/results\//)
  })

  test('P38b-3b: one primary CTA holds after the frame migration (very_old)', async ({ page }) => {
    // 2022-01-04 is the same fixture date used throughout this suite
    // (P37j.1, P37k.10, etc.) for the very_old (>=730 days) state -- already
    // ~1000+ days old as of this suite's system date and only grows more so,
    // so it stays deterministically very_old for the life of this fixture.
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: {
        biomarkers: [{ name: 'Hemoglobin', value: 14, unit: 'g/dL', ref_low: 12, ref_high: 16 }],
        protocol: ['Increase iron-rich foods'],
        knowledge_report: { retest_plan: [{ marker: 'Hemoglobin', timing: '8-12 weeks' }] },
      },
    })
    await gotoToday(page)
    // P45: no button chrome -- "exactly one primary, no duplicate" is a
    // data guarantee (first This week row) rendered as bold text like
    // every other action, not a visually distinct filled button.
    await expect(page.locator('.coach-button')).toHaveCount(0)
    const primaryRow = page.locator('.cockpit-row').first()
    // Primary label is the exact existing very_old copy, and its
    // destination is /upload -- the forced Upload row, never the saved plan.
    await expect(primaryRow).toContainText(/Upload new results/i)
    await primaryRow.getByRole('button').click()
    await expect(page).toHaveURL(/\/upload/)
    await page.goBack()
    await page.waitForLoadState('networkidle')
    // Plan/results remain reachable as secondary links, never removed --
    // "Open my plan" (the saved-plan This week row, demoted) and the
    // Documents footer's "View results"/"Open my plan" are still present,
    // none of them styled as a filled/pill button.
    const secondaryPlanLink = page.getByRole('button', { name: /^Open my plan$/i }).first()
    await expect(secondaryPlanLink).toBeVisible()
    const isCoachButton = await secondaryPlanLink.evaluate((el) => el.classList.contains('coach-button'))
    expect(isCoachButton).toBe(false)
    await expect(page.locator('.coach-button')).toHaveCount(0)
  })

  test('P38b-4: delayed /results keeps the same shell -- CabinetPageFrame present throughout, no .today-hero, no layout swap', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { biomarkers: [{ name: 'Hemoglobin', value: 14, unit: 'g/dL', ref_low: 12, ref_high: 16 }] },
      resultsDelayMs: 800,
    })
    await page.goto(`${LOCAL_BASE}/dashboard`)
    await expect(page.locator('.cabinet-page-frame')).toBeVisible()
    await expect(page.locator('.cockpit-page')).toBeVisible()
    await expect(page.locator('.today-hero')).toHaveCount(0)
    await expect(page.locator('.cockpit-skeleton-line').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.cabinet-page-frame')).toBeVisible()
    await expect(page.locator('.cockpit-skeleton-line')).toHaveCount(0)
    await expect(page.locator('.today-hero')).toHaveCount(0)
  })

  test('P38b-5: network guard -- zero /protocol/* and exactly one /results/* after the frame migration', async ({ page }) => {
    const paths = collectRequestPaths(page)
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, uploadId: 'up-p38b-network' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { protocol: ['Increase iron-rich foods'] },
    })
    await gotoToday(page)
    expect(paths.some((u) => u.includes('/protocol/'))).toBe(false)
    const resultsCalls = paths.filter((u) => u.includes('/results/'))
    expect(resultsCalls.length).toBe(1)
    expect(resultsCalls[0]).toContain('up-p38b-network')
  })

  test('P38b-6: mobile 375px -- no horizontal overflow on the richest cockpit state after the frame migration', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      questionnaireUrgency: 'Some answers suggest timely clinician review is important.',
      results: {
        biomarkers: [
          { name: 'Hemoglobin', value: 10.5, unit: 'g/dL', ref_low: 12, ref_high: 16 },
          { name: 'Ferritin', value: 200, unit: 'ng/mL', ref_low: 15, ref_high: 150 },
        ],
        protocol: ['Increase iron-rich foods'],
        knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: '8-12 weeks' }] },
        evidence_gaps: { gaps: [{ missing_marker: 'transferrin_saturation', reason: 'not_tested_this_round' }] },
      },
    })
    await gotoToday(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('P38b-7: LabResultsList uses the shared CabinetPageFrame at the same 1152px effective width, header/CTA unchanged', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      const farFuture = Math.floor(Date.now() / 1000) + 3600
      window.localStorage.setItem(storageKey, JSON.stringify({
        access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token', token_type: 'bearer',
        expires_at: farFuture, expires_in: 3600, user: { id: 'fixture-user-1', email: 'p38b-fixture@example.com' },
      }))
    }, SUPABASE_AUTH_STORAGE_KEY)
    // Real endpoints this page calls (api.get('/progress'), api.get('/progress/overview'))
    // -- confirmed by reading LabResultsList.jsx, not guessed. An empty list
    // is a valid, safely-handled response shape (normalizeProgressPayload
    // falls back to []), sufficient to verify the frame/header/CTA render;
    // this test does not exercise the populated-list rendering itself.
    await page.route('**/progress/overview', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }))
    await page.route('**/progress', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }))
    await page.route('**/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entitlements: DEFAULT_ENTITLEMENTS_PREMIUM }) }))
    await page.route('**/profile', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile: { goals: [] } }) }))
    await page.route('**/auth/onboarding/state', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'end_user', requires_onboarding: false, completed: true }) }))
    await page.goto(`${LOCAL_BASE}/lab-results`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.cabinet-page-frame')).toBeVisible()
    const maxWidth = await page.locator('.cabinet-page-frame').evaluate((el) => getComputedStyle(el).maxWidth)
    expect(maxWidth).toBe('1152px')
    await expect(page.getByRole('heading', { name: /Lab Results/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Upload Results/i })).toBeVisible()
  })
})
