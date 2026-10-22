import { describe, expect, it } from 'vitest'
import { buildFetchResultsError, canViewResults, getBiomarkerCounts, lifecycleState, patientFacingLabName, selectProgressMarkers, shouldShowBiomarkerCounts, sortProgressItems } from './LabResultsList.jsx'

describe('LabResultsList lifecycle state', () => {
  it('keeps uploads in real clinical-date order and leaves undated records last', () => {
    const items = [
      { id: 'older', test_date: '2025-08-10', created_at: '2026-10-13T10:00:00Z' },
      { id: 'undated', created_at: '2026-10-14T10:00:00Z' },
      { id: 'latest', collected_at: '2026-01-20', created_at: '2025-01-01T10:00:00Z' },
    ]

    expect(sortProgressItems(items).map((item) => item.id)).toEqual(['latest', 'older', 'undated'])
    expect(items.map((item) => item.id)).toEqual(['older', 'undated', 'latest'])
  })

  it('uses the frozen report measurement date ahead of mutable upload date fields', () => {
    const items = [
      { id: 'frozen-latest', measurement_date: '2026-10-01', test_date: '2025-01-01' },
      { id: 'older', test_date: '2026-09-01' },
    ]

    expect(sortProgressItems(items).map((item) => item.id)).toEqual(['frozen-latest', 'older'])
  })

  it('keeps ready results viewable with biomarker counts', () => {
    const item = { status: 'done', biomarkers: [{ status: 'OPTIMAL' }] }

    expect(lifecycleState(item)).toBe('ready')
    expect(canViewResults(item)).toBe(true)
    expect(shouldShowBiomarkerCounts(item)).toBe(true)
  })

  it.each([
    [
      'latest UNKNOWN and UNEVALUATED snapshots',
      [
        { status: 'OPTIMAL', value: 5, ref_low: 1, ref_high: 10 },
        { status: 'UNKNOWN', value: 5, ref_low: 1, ref_high: 10 },
        { status: 'UNEVALUATED', value: 5, ref_low: 1, ref_high: 10 },
      ],
      { total: 3, optimal: 1, borderline: 0, deficient: 0, elevated: 0, unknown: 2 },
    ],
    [
      'historical BORDERLINE snapshot',
      [
        { status: 'BORDERLINE', value: 5, ref_low: 1, ref_high: 10 },
        { status: 'NORMAL', value: 5, ref_low: 1, ref_high: 10 },
      ],
      { total: 2, optimal: 1, borderline: 1, deficient: 0, elevated: 0, unknown: 0 },
    ],
    [
      'historical missing-reference snapshot',
      [
        { status: 'OPTIMAL', value: 5 },
        { status: 'OPTIMAL', value: 4, ref_low: 5 },
        { status: 'OPTIMAL', value: 12, ref_high: 10 },
        { status: 'DEFICIENT' },
      ],
      { total: 4, optimal: 0, borderline: 0, deficient: 2, elevated: 1, unknown: 1 },
    ],
  ])('classifies %s with the shared evidence-aware contract', (_name, biomarkers, expected) => {
    expect(getBiomarkerCounts({ biomarkers })).toEqual(expected)
  })

  it.each([
    ['processing', 'processing'],
    ['failed', 'failed'],
    ['queued', 'queued'],
    ['uploaded', 'queued'],
  ])('blocks result access and counts for %s uploads', (status, expectedState) => {
    const item = { status, biomarkers: [{ status: 'OPTIMAL' }] }

    expect(lifecycleState(item)).toBe(expectedState)
    expect(canViewResults(item)).toBe(false)
    expect(shouldShowBiomarkerCounts(item)).toBe(false)
  })

  it('treats legacy rows without a status as ready', () => {
    expect(lifecycleState({ biomarkers: [] })).toBe('ready')
    expect(canViewResults({ biomarkers: [] })).toBe(true)
  })

  it('uses patient-facing error copy without backend details', () => {
    const result = buildFetchResultsError({
      response: { status: 500, data: { message: 'provider stack trace' } },
      message: 'internal failure',
    })

    expect(result.error).toBe('We could not load your lab results right now. Please try again.')
    expect(result.error).not.toContain('500')
    expect(result.error).not.toContain('provider')
  })

  it('does not expose internal source tokens in result history', () => {
    expect(patientFacingLabName('b2c_file')).toBe('Lab result')
    expect(patientFacingLabName('4b825dc642cb6eb9a060e54bf8d69288')).toBe('Lab result')
    expect(patientFacingLabName('Quest Diagnostics')).toBe('Quest Diagnostics')
  })

  it('keeps progress filters grounded in backend-provided statuses and history', () => {
    const topChanges = [
      { canonical_name: 'bilirubin', name: 'Bilirubin', current_status_group: 'needs_review' },
      { canonical_name: 'ast', name: 'AST', current_status_group: 'stable' },
    ]
    const newMarkers = [
      { canonical_name: 'crp', name: 'CRP', current_status_group: 'needs_review' },
    ]

    expect(selectProgressMarkers({ topChanges, newMarkers, filter: 'attention' }).map(({ marker }) => marker.name))
      .toEqual(['Bilirubin', 'CRP'])
    expect(selectProgressMarkers({ topChanges, newMarkers, filter: 'changed' }).map(({ marker }) => marker.name))
      .toEqual(['Bilirubin', 'AST'])
    expect(selectProgressMarkers({ topChanges, newMarkers, filter: 'insufficient' }).map(({ marker }) => marker.name))
      .toEqual(['CRP'])
  })
})
