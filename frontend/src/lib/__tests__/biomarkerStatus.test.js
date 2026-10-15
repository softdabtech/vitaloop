import { describe, expect, it } from 'vitest'
import {
  biomarkerStatusLabel,
  normalizeBiomarkerStatus,
  summarizeBiomarkerStatuses,
} from '../biomarkerStatus.js'

describe('evidence-aware biomarker status contract', () => {
  it.each([
    ['BORDERLINE', { status: 'BORDERLINE' }],
    ['BORDERLINE', { status: 'LOW NORMAL', ref_low: 1, ref_high: 10 }],
    ['UNKNOWN', { status: 'UNKNOWN', ref_low: 1, ref_high: 10 }],
    ['UNKNOWN', { status: 'UNEVALUATED', ref_low: 1, ref_high: 10 }],
    ['UNKNOWN', { status: 'OPTIMAL' }],
    ['OPTIMAL', { status: 'OPTIMAL', ref_low: 1, ref_high: 10 }],
    ['DEFICIENT', { status: 'OPTIMAL', value: 4, ref_low: 5 }],
    ['ELEVATED', { status: 'OPTIMAL', value: 12, ref_high: 10 }],
    ['UNKNOWN', { status: 'OPTIMAL', value: 6, ref_low: 5 }],
    ['DEFICIENT', { status: 'DEFICIENT' }],
    ['ELEVATED', { status: 'CRITICAL' }],
    ['UNKNOWN', { status: 'OPTIMAL', value: 4, ref_low: 'invalid', ref_high: 10 }],
  ])('classifies %j without inventing clinical thresholds', (expected, biomarker) => {
    expect(normalizeBiomarkerStatus(biomarker)).toBe(expected)
  })

  it('derives stable counts from persisted biomarker statuses, not narrative or saved counts', () => {
    const snapshot = [
      { status: 'NORMAL', ref_low: 1, ref_high: 10 },
      { status: 'BORDERLINE' },
      { status: 'UNKNOWN', ref_low: 1, ref_high: 10 },
      { status: 'UNEVALUATED' },
      { status: 'OPTIMAL', value: 4, ref_low: 5 },
      { status: 'CRITICAL' },
    ]

    expect(summarizeBiomarkerStatuses(snapshot)).toEqual({
      total: 6,
      optimal: 1,
      borderline: 1,
      deficient: 1,
      elevated: 1,
      unknown: 2,
    })
    expect(biomarkerStatusLabel('UNKNOWN')).toBe('Not evaluated')
    expect(biomarkerStatusLabel('BORDERLINE', true)).toBe('Потребує спостереження')
  })
})
