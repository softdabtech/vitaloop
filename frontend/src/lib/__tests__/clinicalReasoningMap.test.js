import { describe, it, expect } from 'vitest'
import { buildClinicalReasoningMap } from '../clinicalReasoningMap'

function hypothesis(overrides = {}) {
  return {
    hypothesis_id: 'h1',
    domain: 'iron_status',
    label: 'Possible iron availability pattern',
    calibrated_confidence: 'moderate',
    calibrated_score: 0.6,
    supporting_evidence: [{ name: 'ferritin' }],
    what_would_confirm_or_rule_out: [{ marker: 'transferrin saturation' }],
    reasoning_statement: 'This pattern is possible but not yet the strongest explanation.',
    doctor_only: false,
    blocked: false,
    ...overrides,
  }
}

describe('buildClinicalReasoningMap', () => {
  it('builds cards from P14/P15/P16/P17 fixtures', () => {
    const result = buildClinicalReasoningMap({
      clinicalHypotheses: { hypotheses: [hypothesis()] },
      clinicalContradictions: {
        contradictions: [
          { id: 'c1', domain: 'iron_status', message: 'Inflammation may limit ferritin interpretation.', related_hypotheses: ['h1'] },
        ],
      },
      reasoningTraces: [{ pattern_id: 'h1', pattern_name: 'Iron availability', matched_symptoms: ['fatigue'] }],
      evidenceGaps: { gaps: [{ domain: 'iron_status', missing_marker: 'transferrin_saturation', reason: 'would_reduce_uncertainty' }] },
      actionPlanByRole: { practitioner: [{ source: 'pattern', source_id: 'h1' }], urgent: [], doctor: [], self: [] },
      negativeEvidence: { stable_domains: [{ domain: 'kidney' }], under_tested_domains: [{ domain: 'thyroid' }] },
    })

    expect(result.cards).toHaveLength(1)
    const card = result.cards[0]
    expect(card.id).toBe('h1')
    expect(card.domain).toBe('iron_status')
    expect(card.confidenceLabel).toBe('moderate')
    expect(card.actionBucket).toBe('practitioner')
    expect(card.symptoms).toEqual(['fatigue'])
    expect(card.supportingMarkers).toEqual(['ferritin'])
  })

  it('surfaces a matching contradiction as a limitation on the card', () => {
    const result = buildClinicalReasoningMap({
      clinicalHypotheses: { hypotheses: [hypothesis()] },
      clinicalContradictions: {
        contradictions: [{ id: 'c1', domain: 'iron_status', message: 'Limits confidence.', related_hypotheses: [] }],
      },
    })

    expect(result.cards[0].contradictions).toEqual(['Limits confidence.'])
  })

  it('includes evidence gaps and next tests on the card', () => {
    const result = buildClinicalReasoningMap({
      clinicalHypotheses: { hypotheses: [hypothesis()] },
      evidenceGaps: { gaps: [{ domain: 'iron_status', missing_marker: 'crp', reason: 'would_reduce_uncertainty' }] },
    })

    expect(result.cards[0].evidenceGaps.length).toBeGreaterThan(0)
    expect(result.cards[0].nextTests).toEqual(['transferrin saturation'])
  })

  it('falls back to a derived action bucket for a doctor-flagged hypothesis', () => {
    const result = buildClinicalReasoningMap({
      clinicalHypotheses: { hypotheses: [hypothesis({ calibrated_confidence: 'doctor_only', doctor_only: true })] },
    })

    expect(result.cards[0].actionBucket).toBe('doctor')
  })

  it('returns empty cards and empty domain lists for completely empty input', () => {
    const result = buildClinicalReasoningMap({})

    expect(result.cards).toEqual([])
    expect(result.stableDomains).toEqual([])
    expect(result.underTestedDomains).toEqual([])
  })

  it('does not crash when called with no arguments', () => {
    expect(() => buildClinicalReasoningMap()).not.toThrow()
  })

  it('does not crash on an old result missing every P14-P17 field', () => {
    const result = buildClinicalReasoningMap({
      clinicalHypotheses: null,
      clinicalContradictions: undefined,
      reasoningTraces: [],
      evidenceGaps: null,
      actionPlanByRole: null,
      negativeEvidence: null,
    })

    expect(result.cards).toEqual([])
  })

  it('does not crash on malformed hypothesis entries and drops entries with no id', () => {
    const result = buildClinicalReasoningMap({
      clinicalHypotheses: { hypotheses: ['not_an_object', null, 42, {}] },
    })

    expect(Array.isArray(result.cards)).toBe(true)
    expect(result.cards).toHaveLength(0)
  })

  it('surfaces negative_evidence stable and under-tested domains', () => {
    const result = buildClinicalReasoningMap({
      negativeEvidence: {
        stable_domains: [{ domain: 'kidney', status: 'no_strong_signal_detected' }],
        under_tested_domains: [{ domain: 'thyroid', status: 'under_tested' }],
      },
    })

    expect(result.stableDomains).toHaveLength(1)
    expect(result.underTestedDomains).toHaveLength(1)
  })

  it('caps cards at maxCards', () => {
    const hypotheses = [hypothesis({ hypothesis_id: 'a' }), hypothesis({ hypothesis_id: 'b' }), hypothesis({ hypothesis_id: 'c' }), hypothesis({ hypothesis_id: 'd' })]
    const result = buildClinicalReasoningMap({ clinicalHypotheses: { hypotheses }, maxCards: 3 })

    expect(result.cards).toHaveLength(3)
  })
})
