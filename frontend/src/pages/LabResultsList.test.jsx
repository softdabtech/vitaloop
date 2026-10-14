import { describe, expect, it } from 'vitest'
import { buildFetchResultsError, canViewResults, lifecycleState, patientFacingLabName, shouldShowBiomarkerCounts, sortProgressItems } from './LabResultsList.jsx'

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

  it('keeps ready results viewable with biomarker counts', () => {
    const item = { status: 'done', biomarkers: [{ status: 'OPTIMAL' }] }

    expect(lifecycleState(item)).toBe('ready')
    expect(canViewResults(item)).toBe(true)
    expect(shouldShowBiomarkerCounts(item)).toBe(true)
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
})
