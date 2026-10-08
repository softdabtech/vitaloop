import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldGenerateInsight } from './insightEligibility.js'

const eligible = (overrides = {}) => shouldGenerateInsight({
  querySucceeded: true,
  queryFetching: false,
  generationAllowed: true,
  generationInFlight: false,
  generationAttempted: false,
  ...overrides,
})

test('legacy-only load generates once', () => {
  assert.equal(eligible(), true)
  assert.equal(eligible({ generationAttempted: true }), false)
})

test('empty state generates once', () => {
  assert.equal(eligible(), true)
})

test('active structured insight does not generate', () => {
  assert.equal(eligible({ generationAllowed: false }), false)
})

test('dismissed structured insight does not regenerate after reload', () => {
  assert.equal(eligible({ generationAllowed: false }), false)
})

test('old dismissal does not block a new backend-approved state', () => {
  assert.equal(eligible({ generationAllowed: true }), true)
})

test('post-dismiss and reload state emit zero automatic generation requests', () => {
  let automaticRequests = 0
  const considerAutomaticGeneration = (generationAllowed) => {
    if (eligible({ generationAllowed })) automaticRequests += 1
  }

  considerAutomaticGeneration(false)
  considerAutomaticGeneration(false)

  assert.equal(automaticRequests, 0)
})

test('a changed source state can generate again', () => {
  assert.equal(eligible({ generationAllowed: true }), true)
})

test('dismissal refetch and generation races do not generate', () => {
  assert.equal(eligible({ generationAllowed: true, queryFetching: true }), false)
  assert.equal(eligible({ querySucceeded: false }), false)
  assert.equal(eligible({ generationInFlight: true }), false)
})
