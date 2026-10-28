import { describe, expect, it } from 'vitest'
import { getNextBestAction, uploadLifecycleState } from './UserDashboard.jsx'

describe('UserDashboard upload lifecycle state', () => {
  it.each([
    ['processing', 'processing'],
    ['failed', 'failed'],
    ['queued', 'queued'],
    ['uploaded', 'queued'],
  ])('maps %s to a patient-facing lifecycle state', (status, expectedState) => {
    expect(uploadLifecycleState({ status })).toBe(expectedState)
  })

  it('keeps legacy rows without a status as ready', () => {
    expect(uploadLifecycleState({})).toBe('ready')
  })
})

describe('UserDashboard next best action', () => {
  it.each([
    [{}, 'symptoms', 'Start symptom check'],
    [{ hasSymptomContext: true }, 'lab_plan', 'Build lab plan'],
    [{ hasSymptomContext: true, hasLabPlan: true }, 'upload', 'Upload lab results'],
    [{ hasSymptomContext: true, hasUpload: true, hasResult: true, uploadId: 'report-1' }, 'results', 'Review results'],
    [{ hasSymptomContext: true, hasResult: true, hasProtocol: true, uploadId: 'report-1' }, 'protocol', 'Continue action plan'],
    [{ hasSymptomContext: true, hasResult: true, hasProtocol: true, retestDue: true, uploadId: 'report-1' }, 'retest', 'Review retest plan'],
  ])('chooses %s as the single actionable next step', (state, key, label) => {
    expect(getNextBestAction(state)).toMatchObject({ key, label })
  })
})
