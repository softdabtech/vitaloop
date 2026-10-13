import { describe, expect, it } from 'vitest'
import { uploadLifecycleState } from './UserDashboard.jsx'

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
