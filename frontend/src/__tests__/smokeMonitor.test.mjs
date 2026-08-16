import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  endpointFailureMessage,
  hasAuthSmokeConfig,
  hasMeaningfulResultsPayload,
  isMissingPlaywrightError,
  isExpectedProtectedStatus,
} from '../../../scripts/vitaloop-smoke-monitor.mjs'

test('endpointFailureMessage includes readiness body state and reason', () => {
  const message = endpointFailureMessage(
    '/health/ready',
    200,
    { ready: false, reason: 'supabase_unavailable: timeout' },
    '{"ready":false}',
  )

  assert.equal(message, '/health/ready returned HTTP 200 ready=false reason=supabase_unavailable: timeout')
})

test('isMissingPlaywrightError detects missing optional browser dependency', () => {
  assert.equal(isMissingPlaywrightError({
    code: 'ERR_MODULE_NOT_FOUND',
    message: "Cannot find package 'playwright' imported from /var/www/VITALOOP/frontend/scripts/vitaloop-smoke-monitor.mjs",
  }), true)

  assert.equal(isMissingPlaywrightError({
    code: 'ERR_MODULE_NOT_FOUND',
    message: "Cannot find package 'other-package'",
  }), false)
})

test('hasAuthSmokeConfig requires credentials and Supabase public config', () => {
  assert.equal(hasAuthSmokeConfig({
    email: 'test@example.com',
    password: 'secret',
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
  }), true)

  assert.equal(hasAuthSmokeConfig({
    email: 'test@example.com',
    password: 'secret',
  }), false)
})

test('isExpectedProtectedStatus rejects server errors', () => {
  assert.equal(isExpectedProtectedStatus(200), true)
  assert.equal(isExpectedProtectedStatus(402), true)
  assert.equal(isExpectedProtectedStatus(422), true)
  assert.equal(isExpectedProtectedStatus(500), false)
  assert.equal(isExpectedProtectedStatus(504), false)
})

test('hasMeaningfulResultsPayload requires upload, biomarkers and report content', () => {
  assert.equal(hasMeaningfulResultsPayload({
    upload_id: 'upload-1',
    biomarkers: [{ name: 'Ferritin' }],
    final_analysis: { knowledge_report: {} },
  }), true)

  assert.equal(hasMeaningfulResultsPayload({
    upload_id: 'upload-1',
    biomarkers: [],
  }), false)
})
