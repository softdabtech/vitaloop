import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  endpointFailureMessage,
  isMissingPlaywrightError,
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
