import { expect, test, type Page, type Route } from '@playwright/test'

const AUTH_STORAGE_KEY = 'sb-bfjxkzydonhwmafnyktt-auth-token'

type Json = Record<string, any>
type AnswerCall = { body: Json; idempotencyKey: string }

type Scenario = {
  session: Json | null
  structuredUnavailable?: boolean
  fallbackContextCalls?: Json[]
  summary?: Json
  initialCalls?: Json[]
  answerCalls: AnswerCall[]
  reportUpdate?: Json | null
  regenerationCalls?: number
  regenerationHandler?: (route: Route, scenario: Scenario) => Promise<void> | void
  answerHandler?: (route: Route, scenario: Scenario) => Promise<void> | void
}

const catalog = {
  version: 'symptom_catalog_v1',
  locale: 'en',
  items: [
    { id: 'no_current_concern', label: 'No current concern — record how I feel today', available: true },
    { id: 'fatigue_low_energy', label: 'Energy, fatigue or recovery', available: true },
    { id: 'unsupported_concern', label: 'Something not covered by this check', available: true },
  ],
}

const choices = [
  { id: 'present', label: 'Yes' },
  { id: 'absent', label: 'No' },
  { id: 'unknown', label: 'Not sure' },
]

function adaptiveSession(overrides: Json = {}) {
  return {
    id: 'session-1', status: 'active', stage: 2, locale: 'en',
    overall_wellbeing: 'reduced', primary_concern_id: 'fatigue_low_energy',
    duration_bucket: 'weeks_1_4', should_stop: false,
    safety: { level: 'insufficient_data', interrupt: false },
    initial_options: [],
    question: {
      id: 'q-red-1', sequence: 1, type: 'group_multiple', source: 'red_flags',
      text: 'Do any of these warning signs apply?',
      items: [{ id: 's-warning', label: 'Severe warning sign', choices }],
    },
    ...overrides,
  }
}

function sequentialAdaptiveSession(sequence: number) {
  const prompts = [
    ['q-red-1', 'Do any of these warning signs apply?', 'Severe warning sign', 'red_flags'],
    ['q-energy-2', 'How is your energy affected?', 'Noticeable loss of energy', 'diagnosis'],
    ['q-sleep-3', 'Has your sleep changed?', 'Unrefreshing or disrupted sleep', 'diagnosis'],
    ['q-activity-4', 'Does activity make the problem worse?', 'Symptoms worsen after activity', 'diagnosis'],
    ['q-pattern-5', 'Is there a consistent daily pattern?', 'Symptoms follow a daily pattern', 'diagnosis'],
  ]
  const [id, text, label, source] = prompts[sequence - 1]
  return adaptiveSession({
    question: {
      id, sequence, type: 'group_multiple', source, text,
      items: [{ id: `signal-${sequence}`, label, choices }],
    },
  })
}

function initialSession() {
  return {
    id: 'session-1', status: 'active', stage: 1, locale: 'en',
    overall_wellbeing: 'reduced', primary_concern_id: 'fatigue_low_energy',
    duration_bucket: null, question: null, should_stop: false,
    safety: { level: 'insufficient_data', interrupt: false },
    initial_options: [
      { id: 'fatigue', label: 'Fatigue' },
      { id: 'poor_sleep', label: 'Unrefreshing sleep' },
    ],
  }
}

function completedSession(level = 'routine') {
  return {
    ...adaptiveSession(), status: 'completed', stage: 3, question: null, should_stop: true,
    safety: { level, interrupt: level === 'emergency' },
  }
}

function json(route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) {
  return route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })
}

async function authenticate(page: Page) {
  await page.addInitScript((storageKey) => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const encode = (value: object) => btoa(JSON.stringify(value))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      aud: 'authenticated', exp: expiresAt, sub: 'symptom-e2e-user',
      email: 'symptom-e2e@example.com', role: 'authenticated',
    })}.test-signature`
    window.localStorage.setItem('vitaloop-cookie-consent', JSON.stringify({
      version: '1', decided: true, essential: true,
      analytics: false, marketing: false, functional: false,
    }))
    window.localStorage.setItem(storageKey, JSON.stringify({
      access_token: accessToken, refresh_token: 'symptom-e2e-refresh',
      token_type: 'bearer', expires_at: expiresAt, expires_in: 3600,
      user: { id: 'symptom-e2e-user', email: 'symptom-e2e@example.com' },
    }))
  }, AUTH_STORAGE_KEY)
}

async function installApi(page: Page, scenario: Scenario) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    if (path.endsWith('/src/hooks/useAuth.js')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `export function useAuth() {
          return {
            user: { id: 'symptom-e2e-user', email: 'symptom-e2e@example.com' },
            loading: false,
            signInWithEmail: async () => ({}), signUpWithEmail: async () => ({}),
            signInWithGoogle: async () => ({}), resetPassword: async () => ({}),
            signOut: async () => ({})
          }
        }`,
      })
    }
    if (path.endsWith('/src/lib/supabase.js')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `const user = { id: 'symptom-e2e-user', email: 'symptom-e2e@example.com' }
          const session = { user, access_token: 'symptom-e2e-token' }
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
      })
    }

    if (path.endsWith('/auth/onboarding/state')) {
      return json(route, { role: 'end_user', requires_onboarding: false, completed: true, current_stage: 'complete' })
    }
    if (path.endsWith('/auth/me')) {
      return json(route, { user: { global_role: 'end_user' }, memberships: [], entitlements: { is_premium: false, features: {} } })
    }
    if (path.endsWith('/symptom-check/catalog/root-concerns')) {
      return scenario.structuredUnavailable
        ? json(route, { detail: 'disabled' }, 404)
        : json(route, catalog)
    }
    if (path.endsWith('/symptom-check/sessions/current')) return json(route, { session: scenario.session })

    if (path.endsWith('/symptom-check/sessions') && method === 'POST') {
      const body = request.postDataJSON() as Json
      scenario.session = body.primary_concern_id === 'no_current_concern'
        ? completedSession('routine')
        : initialSession()
      return json(route, { created: true, session: scenario.session, report_update: scenario.reportUpdate || null })
    }
    if (path.endsWith('/initial-evidence') && method === 'POST') {
      scenario.initialCalls?.push(request.postDataJSON() as Json)
      scenario.session = adaptiveSession()
      return json(route, { session: scenario.session })
    }
    if (path.endsWith('/answers') && method === 'POST') {
      scenario.answerCalls.push({
        body: request.postDataJSON() as Json,
        idempotencyKey: request.headers()['x-idempotency-key'] || '',
      })
      if (scenario.answerHandler) return scenario.answerHandler(route, scenario)
      scenario.session = completedSession('routine')
      return json(route, { session: scenario.session })
    }
    if (path.endsWith('/skip') && method === 'POST') {
      scenario.session = { ...initialSession(), status: 'skipped', stage: 3, should_stop: true }
      return json(route, { session: scenario.session })
    }
    if (path.endsWith('/abandon') && method === 'POST') {
      scenario.session = { ...initialSession(), status: 'abandoned', stage: 3, should_stop: true }
      return json(route, { session: scenario.session })
    }
    if (/\/symptom-check\/sessions\/[^/]+\/summary$/.test(path)) {
      return json(route, { summary: scenario.summary || {
        session_id: scenario.session?.id, status: scenario.session?.status,
        safety: scenario.session?.safety || { level: 'routine', interrupt: false },
        evidence: { present: [], absent: [], unknown: [] },
      } })
    }
    if (path.includes('/analyze/') && path.endsWith('/regenerate') && method === 'POST') {
      scenario.regenerationCalls = (scenario.regenerationCalls || 0) + 1
      if (scenario.regenerationHandler) return scenario.regenerationHandler(route, scenario)
      return json(route, { report_version: { id: 'new-report-version' } })
    }

    if (path.endsWith('/dashboard/summary')) {
      return json(route, { today_contract: { latest_ready_report: null }, blocks: {} })
    }
    if (path.endsWith('/questionnaire/session/context') && method === 'PATCH') {
      scenario.fallbackContextCalls?.push(request.postDataJSON() as Json)
      return json(route, { ok: true, session_context: request.postDataJSON() })
    }
    if (path.includes('/progress') || path.includes('/timeline') || path.includes('/questionnaire/session')) {
      return json(route, [])
    }
    if (path.startsWith('/api/') || url.hostname.includes('api.vitaloop')) return json(route, {})
    return route.continue()
  })
}

async function openCheck(page: Page, scenario: Scenario) {
  await authenticate(page)
  await installApi(page, scenario)
  await page.goto('/questionnaire')
  await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 })
  await expect(page.getByText('Structured symptom check')).toBeVisible({ timeout: 10_000 })
}

async function captureDemoStage(page: Page, name: string) {
  if (process.env.CAPTURE_SYMPTOM_DEMO !== '1') return
  await page.screenshot({ path: `../output/symptom-demo-${name}.png`, fullPage: true })
}

test('positive baseline completes without assuming illness and links to lab upload', async ({ page }) => {
  const scenario: Scenario = { session: null, answerCalls: [] }
  await openCheck(page, scenario)
  await page.getByLabel('How do you feel overall today?').selectOption('good')
  await page.getByLabel('What would you like to highlight?').selectOption('no_current_concern')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Monitor how you feel' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your structured symptom context is ready' })).toBeVisible()
  await page.getByRole('button', { name: /Upload lab results/ }).click()
  await expect(page).toHaveURL(/\/upload$/)
})

test('disabled provider uses the controlled three-stage internal flow', async ({ page }) => {
  const scenario: Scenario = { session: null, answerCalls: [], structuredUnavailable: true, fallbackContextCalls: [] }
  await authenticate(page)
  await installApi(page, scenario)
  await page.goto('/questionnaire')

  await expect(page.getByRole('heading', { name: 'Start with how you feel today' })).toBeVisible()
  await page.getByLabel('How do you feel overall today?').selectOption('reduced')
  await page.getByLabel('What area would you like to highlight?').selectOption('energy')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText('Step 2 of 3')).toBeVisible()
  await page.getByLabel('Main signal').selectOption('fatigue')
  await page.getByLabel('How long has it been present?').selectOption('weeks_1_4')
  await page.getByRole('button', { name: /Start focused questions/ }).click()

  for (const choice of ['moderate', 'stable', 'mild', 'absent', 'absent']) {
    await page.getByLabel('Select the closest answer').selectOption(choice)
    await page.getByRole('button', { name: /Save and continue|Save symptom context/ }).click()
  }

  await expect(page.getByRole('heading', { name: 'Your symptom context is saved' })).toBeVisible()
  expect(scenario.fallbackContextCalls).toHaveLength(1)
  expect(scenario.fallbackContextCalls?.[0].complete).toBe(true)
  expect(scenario.fallbackContextCalls?.[0].summary).toMatchObject({
    schema_version: 'controlled_symptom_fallback_v1',
    input_mode: 'controlled_only',
    primary_concern_id: 'energy',
    primary_concept_id: 'fatigue',
    duration_bucket: 'weeks_1_4',
    controlled_answers: { severity: 'moderate', trajectory: 'stable', functional_impact: 'mild', domain_detail: 'absent', urgent_warning: 'absent' },
  })
  await expect(page.getByText('Symptom Check is not available yet')).toHaveCount(0)
  await expect(page.getByText('Step 1 of 8')).toHaveCount(0)
})

test('urgent controlled result explains the trigger and shows the submitted summary without a dashboard button', async ({ page }) => {
  const scenario: Scenario = { session: null, answerCalls: [], structuredUnavailable: true, fallbackContextCalls: [] }
  await authenticate(page)
  await installApi(page, scenario)
  await page.goto('/questionnaire')

  await page.getByLabel('How do you feel overall today?').selectOption('poor')
  await page.getByLabel('What area would you like to highlight?').selectOption('energy')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Main signal').selectOption('fatigue')
  await page.getByLabel('How long has it been present?').selectOption('today')
  await page.getByRole('button', { name: /Start focused questions/ }).click()

  for (const choice of ['severe', 'worsening', 'severe', 'present', 'present']) {
    await page.getByLabel('Select the closest answer').selectOption(choice)
    await page.getByRole('button', { name: /Save and continue|Save symptom context/ }).click()
  }

  await expect(page.getByRole('heading', { name: 'Get urgent medical help now' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'You answered “Yes” to urgent warning signs' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Symptom-check summary' })).toBeVisible()
  await expect(page.getByText('Severe', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveCount(0)
})

test('skip is optional and returns directly to dashboard', async ({ page }) => {
  const scenario: Scenario = { session: initialSession(), answerCalls: [] }
  await openCheck(page, scenario)
  await page.getByRole('button', { name: 'Skip symptom check' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('fatigue journey crosses all three stages and produces upload-ready context', async ({ page }) => {
  const scenario: Scenario = { session: null, initialCalls: [], answerCalls: [] }
  await openCheck(page, scenario)
  await page.getByLabel('How do you feel overall today?').selectOption('reduced')
  await page.getByLabel('What would you like to highlight?').selectOption('fatigue_low_energy')
  await captureDemoStage(page, 'stage-1-baseline')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await expect(page.getByText('Step 2 of 3')).toBeVisible()
  await page.getByLabel('Main signal').selectOption('fatigue')
  await page.getByLabel('How long has it been present?').selectOption('weeks_1_4')
  await captureDemoStage(page, 'stage-2-concern')
  await page.getByRole('button', { name: /Start adaptive questions/ }).click()
  await expect(page.getByText('Step 3 of 3')).toBeVisible()
  await page.getByLabel('Severe warning sign').selectOption('absent')
  await captureDemoStage(page, 'stage-3-adaptive')
  await page.getByRole('button', { name: /Save and continue/ }).click()

  await expect(page.getByRole('heading', { name: 'Your structured symptom context is ready' })).toBeVisible()
  await captureDemoStage(page, 'stage-4-result')
  expect(scenario.initialCalls).toEqual([{
    primary_concept_id: 'fatigue', secondary_concept_ids: [], duration_bucket: 'weeks_1_4',
  }])
  expect(scenario.answerCalls[0].body.answers).toEqual([{ item_id: 's-warning', choice_id: 'absent' }])
  await expect(page.getByRole('button', { name: /Upload lab results/ })).toBeVisible()
})

test('five adaptive questions run consecutively without losing answers or sequence', async ({ page }) => {
  const selectedChoices = ['absent', 'present', 'unknown', 'present', 'absent']
  const scenario: Scenario = {
    session: null,
    initialCalls: [],
    answerCalls: [],
    answerHandler: (route, state) => {
      const answered = state.answerCalls.length
      state.session = answered < 5
        ? sequentialAdaptiveSession(answered + 1)
        : completedSession('routine')
      return json(route, { session: state.session })
    },
  }

  await openCheck(page, scenario)
  await page.getByLabel('How do you feel overall today?').selectOption('reduced')
  await page.getByLabel('What would you like to highlight?').selectOption('fatigue_low_energy')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Main signal').selectOption('fatigue')
  await page.getByLabel('How long has it been present?').selectOption('weeks_1_4')
  await page.getByRole('button', { name: /Start adaptive questions/ }).click()

  for (let index = 0; index < 5; index += 1) {
    const sequence = index + 1
    await expect(page.getByText(`Question ${sequence}`, { exact: true })).toBeVisible()
    const select = page.getByLabel([
      'Severe warning sign',
      'Noticeable loss of energy',
      'Unrefreshing or disrupted sleep',
      'Symptoms worsen after activity',
      'Symptoms follow a daily pattern',
    ][index])
    await select.selectOption(selectedChoices[index])
    await captureDemoStage(page, `adaptive-question-${sequence}`)
    await page.getByRole('button', { name: /Save and continue/ }).click()

    if (sequence === 3) {
      await page.reload()
      await expect(page.getByText('Question 4', { exact: true })).toBeVisible()
    }
  }

  await expect(page.getByRole('heading', { name: 'Your structured symptom context is ready' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Monitor how you feel' })).toBeVisible()
  expect(scenario.answerCalls.map((call) => call.body)).toEqual(selectedChoices.map((choice, index) => ({
    question_id: [
      'q-red-1', 'q-energy-2', 'q-sleep-3', 'q-activity-4', 'q-pattern-5',
    ][index],
    answers: [{ item_id: index === 0 ? 's-warning' : `signal-${index + 1}`, choice_id: choice }],
  })))
  expect(new Set(scenario.answerCalls.map((call) => call.idempotencyKey)).size).toBe(5)
})

test('unknown stays unknown, refresh resumes, and double click submits once', async ({ page }) => {
  const scenario: Scenario = { session: adaptiveSession(), answerCalls: [] }
  await openCheck(page, scenario)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Do any of these warning signs apply?' })).toBeVisible()
  await page.getByLabel('Severe warning sign').selectOption('unknown')
  const submit = page.getByRole('button', { name: /Save and continue/ })
  await submit.dblclick()

  await expect(page.getByRole('heading', { name: 'Monitor how you feel' })).toBeVisible()
  expect(scenario.answerCalls).toHaveLength(1)
  expect(scenario.answerCalls[0].body.answers).toEqual([{ item_id: 's-warning', choice_id: 'unknown' }])
  expect(scenario.answerCalls[0].idempotencyKey).toBeTruthy()
})

test('provider outage is resumable and retry preserves the idempotency key', async ({ page }) => {
  let attempt = 0
  const scenario: Scenario = {
    session: adaptiveSession(), answerCalls: [],
    answerHandler: (route, state) => {
      attempt += 1
      if (attempt === 1) {
        return json(route, { detail: { code: 'SYMPTOM_PROVIDER_UNAVAILABLE', detail: 'Assessment temporarily unavailable. Your progress is saved.' } }, 503)
      }
      state.session = completedSession('clinician_review')
      return json(route, { session: state.session })
    },
  }
  await openCheck(page, scenario)
  await page.getByLabel('Severe warning sign').selectOption('absent')
  await page.getByRole('button', { name: /Save and continue/ }).click()
  await expect(page.getByRole('alert')).toContainText('Assessment temporarily unavailable')
  await page.getByRole('button', { name: /Save and continue/ }).click()

  await expect(page.getByRole('heading', { name: 'Arrange a medical consultation' })).toBeVisible()
  expect(scenario.answerCalls).toHaveLength(2)
  expect(scenario.answerCalls[0].idempotencyKey).toBe(scenario.answerCalls[1].idempotencyKey)
})

test('emergency answer interrupts the interview and removes continuation controls', async ({ page }) => {
  const scenario: Scenario = {
    session: adaptiveSession(), answerCalls: [],
    answerHandler: (route, state) => {
      state.session = completedSession('emergency')
      return json(route, { session: state.session })
    },
  }
  await openCheck(page, scenario)
  await page.getByLabel('Severe warning sign').selectOption('present')
  await page.getByRole('button', { name: /Save and continue/ }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Get emergency help now')
  await expect(alert).toContainText('Call your local emergency number now')
  await expect(page.getByRole('button', { name: /Save and continue/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Return to dashboard' })).toBeVisible()
})

function reportUpdateOffer(): Json {
  return {
    update_available: true,
    report_upload_id: 'upload-1',
    action: { endpoint: '/analyze/upload-1/regenerate', path: '/results/upload-1' },
  }
}

async function completeWithReportUpdate(page: Page, scenario: Scenario) {
  await openCheck(page, scenario)
  await page.getByLabel('How do you feel overall today?').selectOption('good')
  await page.getByLabel('What would you like to highlight?').selectOption('no_current_concern')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your structured symptom context is ready' })).toBeVisible()
}

test('update available shows an explicit report update CTA', async ({ page }) => {
  const scenario: Scenario = { session: null, answerCalls: [], reportUpdate: reportUpdateOffer() }
  await completeWithReportUpdate(page, scenario)
  await expect(page.getByRole('button', { name: 'Update latest report' })).toBeVisible()
})

test('updating disables duplicate regeneration actions', async ({ page }) => {
  const scenario: Scenario = {
    session: null,
    answerCalls: [],
    reportUpdate: reportUpdateOffer(),
    regenerationHandler: async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      await json(route, { report_version: { id: 'new-report-version' } })
    },
  }
  await completeWithReportUpdate(page, scenario)
  const updateButton = page.getByRole('button', { name: 'Update latest report' })
  await updateButton.click()
  await expect(page.getByRole('button', { name: 'Updating report…' })).toBeDisabled()
  expect(scenario.regenerationCalls).toBe(1)
})

test('successful regeneration enters UPDATED and confirms the report update', async ({ page }) => {
  const scenario: Scenario = { session: null, answerCalls: [], reportUpdate: reportUpdateOffer() }
  await completeWithReportUpdate(page, scenario)
  await page.getByRole('button', { name: 'Update latest report' }).click()
  await expect(page.getByText('Report updated with your latest symptoms.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View updated report' })).toBeVisible()
  expect(scenario.regenerationCalls).toBe(1)
})

test('failed regeneration enters ERROR and leaves the CTA available for retry', async ({ page }) => {
  const scenario: Scenario = {
    session: null,
    answerCalls: [],
    reportUpdate: reportUpdateOffer(),
    regenerationHandler: (route, state) => state.regenerationCalls === 1
      ? json(route, { detail: 'Regeneration failed' }, 500)
      : json(route, { report_version: { id: 'new-report-version' } }),
  }
  await completeWithReportUpdate(page, scenario)
  await page.getByRole('button', { name: 'Update latest report' }).click()
  await expect(page.getByRole('alert')).toContainText('Regeneration failed')
  await expect(page.getByRole('button', { name: 'Update latest report' })).toBeEnabled()
  await expect(page.getByText('Report updated with your latest symptoms.', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Update latest report' }).click()
  await expect(page.getByText('Report updated with your latest symptoms.', { exact: true })).toBeVisible()
  expect(scenario.regenerationCalls).toBe(2)
})

test('current report does not offer an unnecessary update', async ({ page }) => {
  const scenario: Scenario = {
    session: null,
    answerCalls: [],
    reportUpdate: { update_available: false, action: { type: 'view_report' } },
  }
  await completeWithReportUpdate(page, scenario)
  await expect(page.getByRole('button', { name: 'Update latest report' })).toHaveCount(0)
  await expect(page.getByText('Report updated with your latest symptoms.', { exact: true })).toHaveCount(0)
})
