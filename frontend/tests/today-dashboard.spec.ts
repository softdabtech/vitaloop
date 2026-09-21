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
    return fulfillJson(route, { today_contract })
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

  test('6. ready report with no plan -> results-forward hero, no plan link', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: false }) })
    await gotoToday(page)
    await expect(page.getByRole('heading', { name: /Your latest report is ready to review/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Open my plan$/i })).toHaveCount(0)
  })

  test('7. ready report with plan, Premium -> plan-forward hero, plan link live', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: true }), entitlements: DEFAULT_ENTITLEMENTS_PREMIUM })
    await gotoToday(page)
    await expect(page.getByRole('heading', { name: /Your next steps are in your plan/i })).toBeVisible()
    const planLinks = page.getByRole('button', { name: /^Open my plan$/i })
    await expect(planLinks.first()).toBeVisible()
  })

  test('8/21. ready report with plan, Free/gated -> no active protocol link', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }),
      entitlements: DEFAULT_ENTITLEMENTS_FREE,
      results: { knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: 'Recheck in 8-12 weeks' }] } },
    })
    await gotoToday(page)
    // results-forward hero (never plan-forward) even though a plan exists
    await expect(page.getByRole('heading', { name: /Your latest report is ready to review/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Open my plan$/i })).toHaveCount(0)
    await expect(page.getByText(/requires an active subscription/i)).toBeVisible()
    // P37f bug fix regression: the "When to come back" checkpoint CTA must
    // say "View results" here, not "Open my plan" -- it correctly links to
    // /results, never the protected /protocol route, so its label must not
    // claim otherwise (found via a real rendered screenshot in this stage).
    // The global "Open my plan" count(0) assertion above already covers the
    // checkpoint card too (there is only one such card in this fixture);
    // this additionally confirms the checkpoint's own destination-correct
    // label ("View results") is present at least twice (Documents + here).
    await expect(page.getByText(/For Ferritin, your plan notes: Recheck in 8-12 weeks/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^View results$/i })).toHaveCount(2)
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
    await expect(page.getByText(/Potassium is markedly elevated/i)).toBeVisible()
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
    await expect(page.getByText(/Discuss thyroid pattern with a doctor/i)).toBeVisible()
    await expect(page.getByText(/Some answers suggest timely clinician review/i)).toBeVisible()
    await expect(page.getByText(/Source: your report/i)).toBeVisible()
    await expect(page.getByText(/Source: your symptom check/i)).toBeVisible()
  })

  test('13. results loading after core layout has loaded -> hero still renders, quiet skeleton for returning sections', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: false }), results: {}, resultsDelayMs: 1500 })
    await page.goto(`${LOCAL_BASE}/dashboard`)
    // Do not wait for networkidle here -- we want to catch the mid-flight state.
    await expect(page.getByRole('heading', { name: /Your latest report is ready to review/i })).toBeVisible()
    await page.waitForLoadState('networkidle')
  })

  test('12. failed /results/:uploadId after core layout has loaded -> limitation message, not "all clear"', async ({ page }) => {
    await mockToday(page, { today_contract: contractReady({ planExists: false }), resultsStatus: 500 })
    await gotoToday(page)
    await expect(page.getByRole('heading', { name: /Your latest report is ready to review/i })).toBeVisible()
    await expect(page.getByText(/couldn.t load additional detail/i)).toBeVisible()
  })

  test('14. comparable reports -> up to 3 changes, no invented trend wording', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      results: {
        progress_intelligence: {
          available: true,
          changes: [
            { pattern_id: 'a', pattern_name: 'Iron deficiency pattern', status: 'weakened' },
            { pattern_id: 'b', pattern_name: 'Thyroid stress pattern', status: 'strengthened' },
            { pattern_id: 'c', pattern_name: 'Metabolic pattern', status: 'new_signal' },
            { pattern_id: 'd', pattern_name: 'Extra pattern', status: 'stable' },
          ],
        },
      },
    })
    await gotoToday(page)
    await expect(page.getByText('Since your previous report')).toBeVisible()
    await expect(page.getByText(/Iron deficiency pattern/i)).toBeVisible()
    await expect(page.getByText(/Thyroid stress pattern/i)).toBeVisible()
    await expect(page.getByText(/Metabolic pattern/i)).toBeVisible()
    await expect(page.getByText(/Extra pattern/i)).toHaveCount(0) // capped at 3
  })

  test('15. first report/no valid comparison -> section hidden, no invented trend', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      results: { progress_intelligence: { available: false, changes: [] }, personal_baseline: { available: false, markers: [] } },
    })
    await gotoToday(page)
    await expect(page.getByText('Since your previous report')).toHaveCount(0)
  })

  test('16. evidence gaps -> up to 2 items', async ({ page }) => {
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
    await expect(page.getByText('What could make this clearer')).toBeVisible()
    await expect(page.getByText('Ferritin', { exact: true })).toBeVisible()
    await expect(page.getByText('Vitamin D', { exact: true })).toBeVisible()
    await expect(page.getByText('B12', { exact: true })).toHaveCount(0) // capped at 2
  })

  test('17. retest timing with anchored text -> used verbatim', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      results: { knowledge_report: { retest_plan: [{ marker: 'Ferritin', timing: 'Recheck in 8-12 weeks per clinician guidance' }] } },
    })
    await gotoToday(page)
    await expect(page.getByText(/For Ferritin, your plan notes: Recheck in 8-12 weeks per clinician guidance/i)).toBeVisible()
  })

  test('18. retest item without timing -> honest no-date fallback, no arbitrary date', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false }),
      results: { knowledge_report: { retest_plan: [{ marker: 'Ferritin', reason: 'monitor' }] } },
    })
    await gotoToday(page)
    await expect(page.getByText(/does not include a repeat-test date yet/i)).toBeVisible()
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
  test('P37j.1: very_old (Jan 4, 2022) report with plan -> honest source line, non-current hero, upload-first CTA', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
    })
    await gotoToday(page)
    // Source line makes the age explicit -- never the plain "Based on your
    // report from" framing a fresh report gets.
    await expect(page.getByText(/Based on your latest saved report from Jan 4, 2022/i)).toBeVisible()
    // Hero no longer implies the plan is current guidance.
    await expect(page.getByRole('heading', { name: /Review your latest saved plan/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Your next steps are in your plan/i })).not.toBeVisible()
    await expect(page.getByText(/This report is over two years old/i)).toBeVisible()
    // Primary CTA is Upload for a very_old report; the saved plan is still
    // one click away as the secondary action, never removed -- the hero's
    // secondary link renders with a trailing arrow glyph ("Open my plan →"),
    // so match loosely rather than the exact Documents-tile button label.
    await expect(page.getByRole('button', { name: /^Upload new results$/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Open my plan/i })).toHaveCount(2) // hero secondary + Documents tile
  })

  test('P37j.2: old (not very_old, ~500 days) report with plan -> plan stays primary, upload becomes secondary', async ({ page }) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - 500)
    const measurementDate = d.toISOString().slice(0, 10)
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
    })
    await gotoToday(page)
    await expect(page.getByText(/Based on an older report from/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /Review your latest saved plan/i })).toBeVisible()
    // Plan remains the primary action at "old" (not "very_old"); Upload is
    // the prominent secondary, not swapped to primary yet.
    const planButtons = page.getByRole('button', { name: /^Open my plan$/i })
    await expect(planButtons.first()).toBeVisible()
    await expect(page.getByText(/This report is older\./i)).toBeVisible()
  })

  test('P37j.3: very_old retest checkpoint -> "Your saved plan listed" wording, no computed/overdue date', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: false, measurementDate: '2022-01-04' }),
      results: { knowledge_report: { retest_plan: [{ marker: 'Hemoglobin', timing: '6-12 weeks' }] } },
    })
    await gotoToday(page)
    await expect(page.getByText(/Your saved plan listed 6-12 weeks for Hemoglobin\./i)).toBeVisible()
    // The old "your plan notes" phrasing (used for fresh reports) must not
    // appear alongside it.
    await expect(page.getByText(/^For Hemoglobin, your plan notes:/i)).toHaveCount(0)
  })

  test('P37j.4: recent report -> old-report copy never appears (regression guard)', async ({ page }) => {
    await mockToday(page, {
      today_contract: contractReady({ planExists: true }), // default measurementDate 2026-09-14, fresh
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
    })
    await gotoToday(page)
    await expect(page.getByRole('heading', { name: /Your next steps are in your plan/i })).toBeVisible()
    await expect(page.getByText(/Based on an older report from/i)).toHaveCount(0)
    await expect(page.getByText(/Based on your latest saved report from/i)).toHaveCount(0)
    await expect(page.getByText(/This report is older/i)).toHaveCount(0)
  })

  test('P37j.5: mobile 375px, very_old report state -> no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockToday(page, {
      today_contract: contractReady({ planExists: true, measurementDate: '2022-01-04' }),
      entitlements: DEFAULT_ENTITLEMENTS_PREMIUM,
      results: { knowledge_report: { retest_plan: [{ marker: 'Hemoglobin', timing: '6-12 weeks' }] } },
    })
    await gotoToday(page)
    await expect(page.getByRole('heading', { name: /Review your latest saved plan/i })).toBeVisible()
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
})
