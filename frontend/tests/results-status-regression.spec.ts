import { expect, test, type Page, type Route } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const LOCAL_BASE = 'http://127.0.0.1:5173'
const AUTH_STORAGE_KEY = 'sb-bfjxkzydonhwmafnyktt-auth-token'
const SCREENSHOT_DIR = process.env.RESULTS_VISUAL_ARTIFACT_DIR || 'test-results/results-status'
const VIEWPORTS = [
  { name: '390px', width: 390, height: 844 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1024px', width: 1024, height: 900 },
  { name: 'desktop', width: 1440, height: 1000 },
]

type ReportFixture = {
  upload: { id: string; filename: string; created_at: string; measurement_date: string }
  biomarkers: Array<Record<string, unknown>>
  knowledge_report: Record<string, unknown>
  protocol: unknown[]
  report_version: { id: string }
  final_analysis: Record<string, unknown>
}

function reportFixture(id: string, biomarkers: ReportFixture['biomarkers'], headline: string): ReportFixture {
  return {
    upload: {
      id,
      filename: `Synthetic ${id}.pdf`,
      created_at: '2026-10-01T09:00:00Z',
      measurement_date: '2026-10-01',
    },
    biomarkers,
    knowledge_report: {
      summary: { headline: '99 biomarkers found. 99 need review, 0 are currently in range.' },
      what_was_found: {
        headline: '99 biomarkers found. 99 need review, 0 are currently in range.',
        summary: headline,
        counts: { total: 99, deficient: 40, elevated: 40, borderline: 19, optimal: 0, unknown: 0 },
      },
    },
    protocol: [],
    report_version: {
      id: `version-${id}`,
      input_snapshot: { metadata: { measurement_date: '2026-10-01' } },
    },
    final_analysis: {
      metadata: { measurement_date: '2026-10-01' },
    },
  }
}

const REPORTS: Array<{
  id: string
  fixture: ReportFixture
  expectedOverview: string
  expectedTableSummary: string
  expectedStatuses: Array<[string, string]>
  expectedHistoryBadges: string[]
}> = [
  {
    id: 'latest-unknown',
    fixture: reportFixture('latest-unknown', [
      { name: 'Known in-range marker', value: 5, unit: 'U/L', status: 'OPTIMAL', ref_low: 1, ref_high: 10 },
      { name: 'Missing classification', value: 5, unit: 'µmol/L', status: 'UNKNOWN', ref_low: 1, ref_high: 10 },
      { name: 'Unevaluated marker', value: 5, unit: 'U/L', status: 'UNEVALUATED', ref_low: 1, ref_high: 10 },
    ], 'All reported markers were optimal.'),
    expectedOverview: '3 biomarkers found. 0 need review, 1 are currently in range, 2 could not be classified.',
    expectedTableSummary: '1 in range · 0 worth watching · 0 out of range · 2 not classified',
    expectedStatuses: [
      ['Known in-range marker', 'In range'],
      ['Missing classification', 'Not evaluated'],
      ['Unevaluated marker', 'Not evaluated'],
    ],
    expectedHistoryBadges: ['In range 1', 'Not evaluated 2'],
  },
  {
    id: 'historical-borderline',
    fixture: reportFixture('historical-borderline', [
      { name: 'Historical borderline marker', value: 5, unit: 'U/L', status: 'BORDERLINE', ref_low: 1, ref_high: 10 },
      { name: 'Historical in-range marker', value: 5, unit: 'U/L', status: 'OPTIMAL', ref_low: 1, ref_high: 10 },
    ], '2 biomarkers found. 1 need review, 1 are currently in range, 0 could not be classified.'),
    expectedOverview: '2 biomarkers found. 1 need review, 1 are currently in range, 0 could not be classified.',
    expectedTableSummary: '1 in range · 1 worth watching · 0 out of range · 0 not classified',
    expectedStatuses: [
      ['Historical borderline marker', 'Worth watching'],
      ['Historical in-range marker', 'In range'],
    ],
    expectedHistoryBadges: ['In range 1', 'Worth watching 1'],
  },
  {
    id: 'historical-missing-reference',
    fixture: reportFixture('historical-missing-reference', [
      { name: 'No reference interval', value: 5, unit: 'U/L', status: 'OPTIMAL' },
      { name: 'One-sided lower breach', value: 4, unit: 'U/L', status: 'OPTIMAL', ref_low: 5 },
      { name: 'One-sided upper breach', value: 12, unit: 'U/L', status: 'OPTIMAL', ref_high: 10 },
      { name: 'One-sided non-breach', value: 6, unit: 'U/L', status: 'OPTIMAL', ref_low: 5 },
    ], '4 biomarkers found. 2 need review, 0 are currently in range, 2 could not be classified.'),
    expectedOverview: '4 biomarkers found. 2 need review, 0 are currently in range, 2 could not be classified.',
    expectedTableSummary: '0 in range · 0 worth watching · 2 out of range · 2 not classified',
    expectedStatuses: [
      ['One-sided lower breach', 'Below range'],
      ['One-sided upper breach', 'Above range'],
      ['No reference interval', 'Not evaluated'],
      ['One-sided non-breach', 'Not evaluated'],
    ],
    expectedHistoryBadges: ['Below range 1', 'Above range 1', 'Not evaluated 2'],
  },
]

async function mockAuthenticatedUser(page: Page) {
  await page.route('**/src/lib/supabase.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `const user = { id: 'visual-fixture-user', email: 'visual-fixture@example.test' }
      const session = { user, access_token: 'local-fixture-token' }
      export const hasSupabaseConfig = true
      export const supabase = {
        auth: {
          getSession: async () => ({ data: { session }, error: null }),
          getUser: async () => ({ data: { user }, error: null }),
          onAuthStateChange: (callback) => {
            queueMicrotask(() => callback('INITIAL_SESSION', session))
            return { data: { subscription: { unsubscribe() {} } } }
          },
          signOut: async () => ({ error: null })
        },
        from: () => { throw new Error('Supabase table access is blocked in this visual test') }
      }`,
  }))
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem('vitaloop-cookie-consent', JSON.stringify({
      version: '1', decided: true, essential: true,
      analytics: false, marketing: false, functional: false,
    }))
    window.localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'local-fixture-token',
      refresh_token: 'local-fixture-refresh',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      user: { id: 'visual-fixture-user', email: 'visual-fixture@example.test' },
    }))
  }, AUTH_STORAGE_KEY)
}

function json(route: Route, value: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })
}

async function mockLocalApis(page: Page, report: ReportFixture, externalRequests: string[]) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      externalRequests.push(url.href)
      return route.abort()
    }
    return route.continue()
  })
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/')) return route.continue()
    if (pathname.endsWith('/auth/me')) {
      return json(route, {
        user: { id: 'visual-fixture-user', global_role: 'end_user' },
        memberships: [],
        entitlements: { is_premium: true, billing_status: 'active', plan_key: 'premium', features: { advanced_protocol: true, trend_analysis: true, lab_history: true } },
      })
    }
    if (pathname.endsWith('/auth/onboarding/state')) {
      return json(route, { role: 'end_user', requires_onboarding: false, completed: true })
    }
    if (pathname === '/api/progress') {
      return json(route, REPORTS.map(({ id, fixture }) => ({
        upload_id: id,
        id,
        lab_name: `Historical ${id}`,
        status: 'done',
        test_date: '2026-10-05',
        measurement_date: fixture.upload.measurement_date,
        biomarkers: fixture.biomarkers,
      })))
    }
    if (pathname === '/api/progress/overview') return json(route, {})
    if (pathname.endsWith(`/results/${report.upload.id}`)) return json(route, report)
    if (pathname.endsWith('/lab-plan/items') || pathname.endsWith('/interventions')) return json(route, [])
    return json(route, {})
  })
}

for (const report of REPORTS) {
  test(`Results status agreement: ${report.id}`, async ({ page }) => {
    const externalRequests: string[] = []
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await mockLocalApis(page, report.fixture, externalRequests)
    await mockAuthenticatedUser(page)

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`${LOCAL_BASE}/results/${report.id}`, { waitUntil: 'domcontentloaded' })
      const overview = page.getByTestId('p4-result-overview')
      await expect(overview).toBeVisible()
      await expect(overview).toContainText(report.expectedOverview)

      const table = page.locator('.results-biomarker-table table')
      await expect(table).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Full biomarker table' }).locator('..')).toContainText(report.expectedTableSummary)
      for (const [name, status] of report.expectedStatuses) {
        const row = table.locator('tbody tr').filter({ hasText: name })
        await expect(row).toHaveCount(1)
        await expect(row).toContainText(status)
      }

      const metrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      }))
      expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth)

      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${report.id}-${viewport.name}.png`),
        fullPage: true,
      })
      expect(externalRequests).toEqual([])
      expect(pageErrors).toEqual([])
    }

    if (report.id === 'latest-unknown') {
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Export summary' }).click()
      const download = await downloadPromise
      const filePath = await download.path()
      expect(filePath).toBeTruthy()
      const pdfBytes = await fs.promises.readFile(filePath)
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true }).promise
      const pdfText = (await Promise.all(
        Array.from({ length: pdf.numPages }, async (_, index) => {
          const pageContent = await (await pdf.getPage(index + 1)).getTextContent()
          return pageContent.items.map((item) => ('str' in item ? item.str : '')).join(' ')
        }),
      )).join(' ')
      expect(pdfText).toContain('Not evaluated')
      expect(pdfText).toMatch(/[µμ]mol\/L/)
      // English PDF output localizes the preserved frozen date for patients;
      // accept either the older ISO rendering or the current localized form.
      expect(pdfText).toMatch(/Report date: (2026-10-01|Oct 1, 2026)/)
      expect(pdfText).toContain('not a status classification')
      expect(pdfText).toContain('All reported markers were optimal.')
    }
  })
}

test('Results History uses the same snapshot classifications as each report', async ({ page }) => {
  const externalRequests: string[] = []
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await mockLocalApis(page, REPORTS[0].fixture, externalRequests)
  await mockAuthenticatedUser(page)

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto(`${LOCAL_BASE}/lab-results`, { waitUntil: 'domcontentloaded' })
    for (const report of REPORTS) {
      const card = page.locator('.lab-result-card').filter({ hasText: `Historical ${report.id}` })
      await expect(card).toBeVisible()
      await expect(card).toContainText(report.fixture.upload.measurement_date)
      for (const badge of report.expectedHistoryBadges) await expect(card).toContainText(badge)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `history-${viewport.name}.png`),
      fullPage: true,
    })
    expect(externalRequests).toEqual([])
    expect(pageErrors).toEqual([])
  }
})

test('Results History cards keep source, status summary and action in separate rows', async ({ page }) => {
  const externalRequests: string[] = []
  await mockLocalApis(page, REPORTS[0].fixture, externalRequests)
  await mockAuthenticatedUser(page)

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto(`${LOCAL_BASE}/lab-results`, { waitUntil: 'domcontentloaded' })
    const card = page.locator('.lab-result-card').filter({ hasText: 'Historical latest-unknown' })
    const source = card.locator('.lab-result-card__identity')
    const badges = card.locator('.lab-result-card__badges')
    const action = card.locator('.lab-result-card__action')
    await expect(card).toBeVisible()
    await expect(source).toBeVisible()
    await expect(badges).toBeVisible()
    await expect(action).toBeVisible()
    const boxes = await Promise.all([source.boundingBox(), badges.boundingBox(), action.boundingBox()])
    expect(boxes.every(Boolean)).toBe(true)
    expect(boxes[0]!.y + boxes[0]!.height).toBeLessThanOrEqual(boxes[1]!.y + 1)
    expect(boxes[1]!.y + boxes[1]!.height).toBeLessThanOrEqual(boxes[2]!.y + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
  }
  expect(externalRequests).toEqual([])
})

test('Cookie banner stays above mobile navigation and leaves the last history action reachable', async ({ page }) => {
  const externalRequests: string[] = []
  await mockLocalApis(page, REPORTS[0].fixture, externalRequests)
  await mockAuthenticatedUser(page)
  await page.addInitScript(() => window.localStorage.removeItem('vitaloop-cookie-consent'))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${LOCAL_BASE}/lab-results`, { waitUntil: 'domcontentloaded' })
  const banner = page.locator('#vl-cookie-banner > div')
  const nav = page.locator('.vtl-mobile-bottom-nav')
  const lastAction = page.locator('.lab-result-card__action').last()
  await expect(banner).toBeVisible()
  await expect(nav).toBeVisible()
  await lastAction.scrollIntoViewIfNeeded()
  const [bannerBox, navBox, actionBox] = await Promise.all([banner.boundingBox(), nav.boundingBox(), lastAction.boundingBox()])
  expect(bannerBox && navBox && actionBox).toBeTruthy()
  expect(bannerBox!.y + bannerBox!.height).toBeLessThanOrEqual(navBox!.y + 1)
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(bannerBox!.y + 1)
  await page.getByRole('button', { name: 'Reject Non-Essential' }).click()
  await expect(page.locator('#vl-cookie-banner')).toHaveCount(0)
  await expect(nav.getByRole('button', { name: 'Upload' })).toBeVisible()
  await nav.getByRole('button', { name: 'Upload' }).click()
  await expect(page).toHaveURL(/\/upload$/)
  await nav.getByRole('button', { name: 'Home' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await nav.getByRole('button', { name: 'Results' }).click()
  await expect(page).toHaveURL(/\/lab-results$/)
  expect(externalRequests).toEqual([])
})
