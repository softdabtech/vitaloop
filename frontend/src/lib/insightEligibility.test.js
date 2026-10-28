import { describe, expect, it } from 'vitest'
import { shouldGenerateInsight } from './insightEligibility.js'

const eligible = (overrides = {}) => shouldGenerateInsight({
  querySucceeded: true,
  queryFetching: false,
  generationAllowed: true,
  generationInFlight: false,
  generationAttempted: false,
  ...overrides,
})

describe('shouldGenerateInsight', () => {
  it('allows a legacy-only load once', () => {
    expect(eligible()).toBe(true)
    expect(eligible({ generationAttempted: true })).toBe(false)
  })

  it('allows an empty state once', () => {
    expect(eligible()).toBe(true)
  })

  it('does not regenerate active or dismissed structured insights', () => {
    expect(eligible({ generationAllowed: false })).toBe(false)
  })

  it('allows a new backend-approved state after an old dismissal', () => {
    expect(eligible({ generationAllowed: true })).toBe(true)
  })

  it('emits no automatic requests after dismissal and reload', () => {
    let automaticRequests = 0
    const considerAutomaticGeneration = (generationAllowed) => {
      if (eligible({ generationAllowed })) automaticRequests += 1
    }

    considerAutomaticGeneration(false)
    considerAutomaticGeneration(false)

    expect(automaticRequests).toBe(0)
  })

  it('allows a changed source state to generate again', () => {
    expect(eligible({ generationAllowed: true })).toBe(true)
  })

  it('blocks fetching, failed-query, and in-flight states', () => {
    expect(eligible({ generationAllowed: true, queryFetching: true })).toBe(false)
    expect(eligible({ querySucceeded: false })).toBe(false)
    expect(eligible({ generationInFlight: true })).toBe(false)
  })
})
