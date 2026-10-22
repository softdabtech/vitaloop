import { describe, expect, it } from 'vitest'
import { decisionRetestSummary } from './DecisionHeader.jsx'

describe('decisionRetestSummary', () => {
  it('uses the stored retest wording without inferring a clinical date', () => {
    expect(decisionRetestSummary([{ timing: '4–8 weeks', marker: 'Bilirubin' }], 'Not specified'))
      .toBe('4–8 weeks')
    expect(decisionRetestSummary([], 'Not specified')).toBe('Not specified')
  })
})
