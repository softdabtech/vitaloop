import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldGenerateInsight } from './insightEligibility.js'

const structured = { provenance: { source_type: 'weekly_checkin' }, next_action: { safety_level: 'routine' } }
const legacy = { provenance: null, next_action: null }

const eligible = (overrides = {}) => shouldGenerateInsight({
  querySucceeded: true,
  queryFetching: false,
  activeInsights: [],
  dismissedInsights: [],
  generationInFlight: false,
  generationAttempted: false,
  ...overrides,
})

test('legacy-only load generates once', () => {
  assert.equal(eligible({ activeInsights: [legacy] }), true)
  assert.equal(eligible({ activeInsights: [legacy], generationAttempted: true }), false)
})

test('empty state generates once', () => {
  assert.equal(eligible(), true)
})

test('active structured insight does not generate', () => {
  assert.equal(eligible({ activeInsights: [structured] }), false)
})

test('dismissed structured insight does not regenerate after reload', () => {
  assert.equal(eligible({ dismissedInsights: [structured] }), false)
})

test('dismissal refetch and generation races do not generate', () => {
  assert.equal(eligible({ dismissedInsights: [structured], queryFetching: true }), false)
  assert.equal(eligible({ querySucceeded: false }), false)
  assert.equal(eligible({ generationInFlight: true }), false)
})
