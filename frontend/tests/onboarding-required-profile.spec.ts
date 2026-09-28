import { expect, test, type Page, type Route } from '@playwright/test'

const LOCAL_BASE = 'http://localhost:5173'
const SUPABASE_AUTH_STORAGE_KEY = 'sb-bfjxkzydonhwmafnyktt-auth-token'

async function mockAuthenticatedUser(page: Page) {
  await page.route('**/src/lib/supabase.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `const user = { id: 'onboarding-user-1', email: 'onboarding@example.com' }
      const session = { user, access_token: 'onboarding-fixture-token' }
      export const hasSupabaseConfig = true
      export const supabase = {
        auth: {
          getSession: async () => ({ data: { session }, error: null }),
          getUser: async () => ({ data: { user }, error: null }),
          onAuthStateChange: (callback) => {
            queueMicrotask(() => callback('INITIAL_SESSION', session))
            return { data: { subscription: { unsubscribe() {} } } }
          },
          signOut: async () => ({ error: null }),
          signInWithPassword: async () => ({ data: { session, user }, error: null }),
          signUp: async () => ({ data: { session, user }, error: null }),
          signInWithOAuth: async () => ({ data: {}, error: null }),
          resetPasswordForEmail: async () => ({ data: {}, error: null }),
          exchangeCodeForSession: async () => ({ data: { session, user }, error: null })
        },
        from: () => { throw new Error('Direct Supabase table access is not allowed in this E2E') }
      }`,
  }))
  await page.addInitScript((storageKey) => {
    const farFuture = Math.floor(Date.now() / 1000) + 3600
    window.localStorage.setItem('vitaloop-cookie-consent', JSON.stringify({
      version: '1', decided: true, essential: true,
      analytics: false, marketing: false, functional: false,
    }))
    window.localStorage.setItem(storageKey, JSON.stringify({
      access_token: 'onboarding-fixture-token',
      refresh_token: 'onboarding-fixture-refresh',
      token_type: 'bearer',
      expires_at: farFuture,
      expires_in: 3600,
      user: { id: 'onboarding-user-1', email: 'onboarding@example.com' },
    }))
  }, SUPABASE_AUTH_STORAGE_KEY)
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

test.describe('required profile onboarding', () => {
  test('blocks a new end user from opening the dashboard directly', async ({ page }) => {
    await mockAuthenticatedUser(page)
    await page.route('**/auth/onboarding/state', (route) => json(route, {
      role: 'end_user', requires_onboarding: true, completed: false,
      current_stage: 'profile', missing_required_profile_fields: ['age', 'sex', 'height_cm', 'weight_kg'],
    }))
    await page.route('**/auth/me', (route) => json(route, { user: { global_role: 'end_user' }, memberships: [] }))
    await page.route('**/profile', (route) => json(route, { profile: {} }))

    await page.goto(`${LOCAL_BASE}/dashboard`)

    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('heading', { name: 'First, tell us the basics' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save and enter dashboard' })).toBeVisible()
    await expect(page.getByText(/Symptom Check is optional/i)).toBeVisible()
  })

  test('saves all four required values before entering the dashboard', async ({ page }) => {
    await mockAuthenticatedUser(page)
    let completed = false
    let savedProfile: Record<string, unknown> | null = null

    await page.route('**/auth/onboarding/state', (route) => json(route, {
      role: 'end_user', requires_onboarding: !completed, completed,
      current_stage: completed ? 'complete' : 'profile',
    }))
    await page.route('**/auth/me', (route) => json(route, {
      user: { global_role: 'end_user' }, memberships: [],
      entitlements: { is_premium: false, features: {} },
    }))
    await page.route('**/profile', async (route) => {
      if (route.request().method() === 'PATCH') {
        savedProfile = await route.request().postDataJSON()
        return json(route, { profile: savedProfile })
      }
      return json(route, { profile: {} })
    })
    await page.route('**/auth/onboarding/complete', (route) => {
      completed = true
      return json(route, { ok: true })
    })
    await page.route('**/dashboard/summary', (route) => json(route, {
      today_contract: { latest_ready_report: null, latest_ready_report_status: 'none', plan_exists_for_latest_ready_report: null },
      blocks: {},
    }))
    await page.route('**/questionnaire/session', (route) => json(route, { session_context: {} }))
    await page.route('**/progress**', (route) => json(route, []))
    await page.route('**/timeline**', (route) => json(route, []))

    await page.goto(`${LOCAL_BASE}/onboarding`)
    await page.getByLabel('Age').fill('34')
    await page.getByLabel('Sex for lab reference ranges').selectOption('female')
    await page.getByLabel('Height (cm)').fill('168')
    await page.getByLabel('Weight (kg)').fill('64')
    await page.getByRole('button', { name: 'Save and enter dashboard' }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    expect(savedProfile).toEqual({ age: 34, sex: 'female', height_cm: 168, weight_kg: 64 })
  })
})
