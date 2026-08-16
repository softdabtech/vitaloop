#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

function readDotEnv(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const [key, ...rest] = trimmed.split('=')
      if (!process.env[key]) {
        process.env[key] = rest.join('=').replace(/^["']|["']$/g, '')
      }
    }
  } catch {}
}

readDotEnv(path.resolve(process.cwd(), '.env.production'))
readDotEnv(path.resolve(process.cwd(), '.env'))

const CONFIG = {
  appBaseUrl: process.env.VITALOOP_SMOKE_APP_URL || 'https://vitaloop.today',
  uaBaseUrl: process.env.VITALOOP_SMOKE_UA_URL || 'https://ua.vitaloop.today',
  apiBaseUrl: process.env.VITALOOP_SMOKE_API_URL || 'https://api.vitaloop.today',
  crmBaseUrl: process.env.VITALOOP_SMOKE_CRM_URL || 'https://crm.vitaloop.today',
  email: process.env.VITALOOP_SMOKE_EMAIL || '',
  password: process.env.VITALOOP_SMOKE_PASSWORD || '',
  supabaseUrl: process.env.VITALOOP_SMOKE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.VITALOOP_SMOKE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  browserLoginEnabled: process.env.VITALOOP_SMOKE_BROWSER_LOGIN === '1',
  fixturePdf: process.env.VITALOOP_SMOKE_PDF || '/Users/oleksii/projects/vitaloop/scripts/smoke-fixtures/lab_ocr_test_big.pdf',
  fixtureImage: process.env.VITALOOP_SMOKE_IMAGE || '',
  uploadEnabled: process.env.VITALOOP_SMOKE_UPLOAD === '1',
  browserChecksDisabled: process.env.VITALOOP_SMOKE_DISABLE_BROWSER === '1',
  timeoutMs: Number(process.env.VITALOOP_SMOKE_TIMEOUT_MS || 30000),
}

const failures = []
const skippedChecks = []

function redact(value) {
  return String(value || '').replace(/access_token=[^&]+/g, 'access_token=***')
}

async function reportFailure(failure) {
  try {
    await fetch(`${CONFIG.apiBaseUrl.replace(/\/$/, '')}/monitoring/frontend-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'smoke_error',
        severity: 'critical',
        code: failure.code || 'SMOKE_CHECK_FAILED',
        message: failure.message || 'Smoke monitor failed',
        route: failure.route || null,
        endpoint: failure.endpoint || null,
        status: failure.status || null,
        metadata: {
          source: 'scripts/vitaloop-smoke-monitor.mjs',
          failure,
          occurred_at: new Date().toISOString(),
        },
      }),
    })
  } catch {
    // The monitor must still print failures even if alert reporting is down.
  }
}

function assertOk(condition, failure) {
  if (!condition) failures.push(failure)
}

export function hasAuthSmokeConfig(config) {
  return Boolean(config?.email && config?.password && config?.supabaseUrl && config?.supabaseAnonKey)
}

function skipCheck(skip) {
  skippedChecks.push({
    ...skip,
    skipped_at: new Date().toISOString(),
  })
}

export function isMissingPlaywrightError(error) {
  return error?.code === 'ERR_MODULE_NOT_FOUND'
    && /Cannot find package ['"]playwright['"]/.test(String(error?.message || ''))
}

async function loadChromium() {
  if (CONFIG.browserChecksDisabled) return null
  try {
    const { chromium } = await import('playwright')
    return chromium
  } catch (error) {
    if (isMissingPlaywrightError(error)) {
      console.warn(JSON.stringify({
        ok: true,
        warning: 'Playwright is not installed; running HTTP-only smoke checks.',
        code: 'SMOKE_BROWSER_CHECKS_SKIPPED',
        checked_at: new Date().toISOString(),
      }))
      return null
    }
    throw error
  }
}

export function endpointFailureMessage(path, status, data, body) {
  if (data && typeof data === 'object') {
    const state = Object.prototype.hasOwnProperty.call(data, 'ready') ? ` ready=${data.ready}` : ''
    const reason = data.reason ? ` reason=${data.reason}` : ''
    return `${path} returned HTTP ${status}${state}${reason}`.trim()
  }
  const snippet = body ? ` body=${String(body).slice(0, 120)}` : ''
  return `${path} returned HTTP ${status}${snippet}`
}

async function checkJsonEndpoint(path, predicate = (data) => data) {
  const endpoint = `${CONFIG.apiBaseUrl.replace(/\/$/, '')}${path}`
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(CONFIG.timeoutMs) })
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch {}
    assertOk(res.ok && predicate(data), {
      code: `SMOKE_API_${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toUpperCase()}`,
      message: endpointFailureMessage(path, res.status, data, text),
      endpoint,
      status: res.status,
      body: text.slice(0, 500),
    })
  } catch (error) {
    failures.push({
      code: `SMOKE_API_${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toUpperCase()}_EXCEPTION`,
      message: error.message,
      endpoint,
    })
  }
}

async function checkTextPage(label, url, expectedText) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(CONFIG.timeoutMs),
    })
    const body = await res.text()
    assertOk(res.status < 500 && (!expectedText || body.includes(expectedText)), {
      code: `SMOKE_PAGE_${label}`,
      message: `${label} page failed HTTP-only expectation`,
      route: url,
      status: res.status,
      body: body.slice(0, 500),
    })
  } catch (error) {
    failures.push({ code: `SMOKE_PAGE_${label}_EXCEPTION`, message: error.message, route: url })
  }
}

async function checkRedirect(label, url, expectedPrefix) {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(CONFIG.timeoutMs),
    })
    const location = res.headers.get('location') || ''
    const absoluteLocation = location.startsWith('http') ? location : new URL(location || '/', url).toString()
    assertOk(
      [301, 302, 303, 307, 308].includes(res.status) && absoluteLocation.startsWith(expectedPrefix),
      {
        code: `SMOKE_${label}`,
        message: `${label} redirect failed HTTP-only expectation`,
        route: url,
        status: res.status,
        metadata: { location: redact(absoluteLocation) },
      },
    )
  } catch (error) {
    failures.push({ code: `SMOKE_${label}_EXCEPTION`, message: error.message, route: url })
  }
}

async function checkAuthApi() {
  if (!CONFIG.email || !CONFIG.password) return null
  if (!hasAuthSmokeConfig(CONFIG)) {
    skipCheck({
      code: 'SMOKE_AUTH_CONFIG_MISSING',
      message: 'Supabase URL or anon key is missing for auth smoke',
      endpoint: `${CONFIG.apiBaseUrl}/auth/me`,
    })
    return null
  }

  try {
    const authRes = await fetch(
      `${CONFIG.supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: CONFIG.supabaseAnonKey,
          Authorization: `Bearer ${CONFIG.supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: CONFIG.email, password: CONFIG.password }),
        signal: AbortSignal.timeout(CONFIG.timeoutMs),
      },
    )
    const authText = await authRes.text()
    let authData = null
    try { authData = JSON.parse(authText) } catch {}
    assertOk(authRes.ok && authData?.access_token, {
      code: 'SMOKE_AUTH_PASSWORD_GRANT_FAILED',
      message: `Supabase password grant returned ${authRes.status}`,
      endpoint: `${CONFIG.supabaseUrl}/auth/v1/token`,
      status: authRes.status,
      body: authText.slice(0, 500),
    })
    if (!authRes.ok || !authData?.access_token) return null

    const meRes = await fetch(`${CONFIG.apiBaseUrl.replace(/\/$/, '')}/auth/me`, {
      headers: { Authorization: `Bearer ${authData.access_token}` },
      signal: AbortSignal.timeout(CONFIG.timeoutMs),
    })
    const meText = await meRes.text()
    assertOk(meRes.ok, {
      code: 'SMOKE_AUTH_ME_FAILED',
      message: `/auth/me returned ${meRes.status}`,
      endpoint: `${CONFIG.apiBaseUrl}/auth/me`,
      status: meRes.status,
      body: meText.slice(0, 500),
    })
    return authData.access_token
  } catch (error) {
    failures.push({
      code: 'SMOKE_AUTH_API_EXCEPTION',
      message: error.message,
      endpoint: `${CONFIG.apiBaseUrl}/auth/me`,
    })
    return null
  }
}

async function main() {
  await checkJsonEndpoint('/health', (data) => data?.status === 'ok')
  await checkJsonEndpoint('/health/ready', (data) => data?.ready === true)
  await checkAuthApi()

  const chromium = await loadChromium()
  if (!chromium) {
    await checkTextPage('EN_LANDING', CONFIG.appBaseUrl, 'VITALOOP')
    await checkTextPage('UA_LANDING', CONFIG.uaBaseUrl, 'VITALOOP')
    await checkRedirect(
      'CRM_AUTH_REDIRECT',
      `${CONFIG.crmBaseUrl.replace(/\/$/, '')}/auth/login`,
      `${CONFIG.appBaseUrl.replace(/\/$/, '')}/login`,
    )

    for (const failure of failures) {
      await reportFailure(failure)
    }

    console.log(JSON.stringify({
      ok: failures.length === 0,
      mode: 'http-only',
      failures,
      skipped_checks: skippedChecks,
      checked_at: new Date().toISOString(),
    }, null, 2))

    process.exit(failures.length ? 1 : 0)
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const browserErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') browserErrors.push(msg.text())
  })
  page.on('pageerror', (err) => browserErrors.push(err.message))

  async function checkPage(label, url, expectedText) {
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeoutMs })
      await page.waitForTimeout(1500)
      const body = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      assertOk(res && res.status() < 500 && (!expectedText || body.includes(expectedText)), {
        code: `SMOKE_PAGE_${label}`,
        message: `${label} page failed expectation`,
        route: url,
        status: res?.status(),
        body: body.slice(0, 500),
      })
    } catch (error) {
      failures.push({ code: `SMOKE_PAGE_${label}_EXCEPTION`, message: error.message, route: url })
    }
  }

  await checkPage('EN_LANDING', CONFIG.appBaseUrl, 'VITALOOP')
  await checkPage('UA_LANDING', CONFIG.uaBaseUrl, 'VITALOOP')

  try {
    await page.goto(`${CONFIG.crmBaseUrl.replace(/\/$/, '')}/auth/login`, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeoutMs })
    await page.waitForTimeout(1500)
    assertOk(page.url().startsWith(`${CONFIG.appBaseUrl.replace(/\/$/, '')}/login`), {
      code: 'SMOKE_CRM_AUTH_REDIRECT',
      message: 'CRM auth route did not redirect to shared login',
      route: `${CONFIG.crmBaseUrl}/auth/login`,
      metadata: { finalUrl: redact(page.url()) },
    })
  } catch (error) {
    failures.push({ code: 'SMOKE_CRM_AUTH_EXCEPTION', message: error.message, route: `${CONFIG.crmBaseUrl}/auth/login` })
  }

  if (CONFIG.email && CONFIG.password && CONFIG.browserLoginEnabled) {
    try {
      await page.goto(`${CONFIG.appBaseUrl.replace(/\/$/, '')}/login?returnUrl=%2Fdashboard%2F`, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeoutMs })
      await page.locator('input[name="email"]').fill(CONFIG.email)
      await page.locator('input[name="password"]').fill(CONFIG.password)
      await page.locator('button[type="submit"]').click()
      await page.waitForURL(/dashboard|onboarding|upload|health-profile/, { timeout: CONFIG.timeoutMs }).catch(() => {})
      assertOk(!page.url().includes('/login'), {
        code: 'SMOKE_AUTH_LOGIN_FAILED',
        message: 'Login did not leave login page',
        route: `${CONFIG.appBaseUrl}/login`,
        metadata: { finalUrl: redact(page.url()) },
      })

      await page.goto(`${CONFIG.appBaseUrl.replace(/\/$/, '')}/upload`, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeoutMs })
      await page.waitForTimeout(1500)
      const uploadBody = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      assertOk(uploadBody.includes('Upload') || uploadBody.includes('Lab'), {
        code: 'SMOKE_UPLOAD_PAGE_FAILED',
        message: 'Upload page did not render expected UI',
        route: `${CONFIG.appBaseUrl}/upload`,
        body: uploadBody.slice(0, 500),
      })

      if (CONFIG.uploadEnabled && fs.existsSync(CONFIG.fixturePdf)) {
        await page.setInputFiles('input[type="file"]', CONFIG.fixturePdf)
        await page.waitForTimeout(1000)
        const buttons = await page.locator('button').allTextContents()
        const candidate = buttons.find((text) => /analyze|upload|continue/i.test(text))
        if (candidate) {
          await page.locator('button').filter({ hasText: candidate }).last().click().catch(() => {})
          await page.waitForTimeout(15000)
          const bodyAfterUpload = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
          assertOk(!/Something went wrong|Internal Server Error|Traceback|Network Error/i.test(bodyAfterUpload), {
            code: 'SMOKE_UPLOAD_ANALYSIS_UI_ERROR',
            message: 'Upload analysis showed a generic error state',
            route: `${CONFIG.appBaseUrl}/upload`,
            body: bodyAfterUpload.slice(0, 800),
          })
        }
      }
    } catch (error) {
      failures.push({ code: 'SMOKE_AUTH_OR_UPLOAD_EXCEPTION', message: error.message, route: `${CONFIG.appBaseUrl}/dashboard` })
    }
  }

  if (browserErrors.length) {
    failures.push({
      code: 'SMOKE_BROWSER_CONSOLE_ERRORS',
      message: 'Browser console/page errors detected during smoke',
      metadata: { errors: browserErrors.slice(0, 10) },
    })
  }

  await browser.close()

  for (const failure of failures) {
    await reportFailure(failure)
  }

  console.log(JSON.stringify({
    ok: failures.length === 0,
    failures,
    skipped_checks: skippedChecks,
    checked_at: new Date().toISOString(),
  }, null, 2))

  process.exit(failures.length ? 1 : 0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async (error) => {
    const failure = { code: 'SMOKE_MONITOR_EXCEPTION', message: error.message, stack: error.stack?.slice(0, 1000) }
    await reportFailure(failure)
    console.error(JSON.stringify({ ok: false, failures: [failure] }, null, 2))
    process.exit(1)
  })
}
