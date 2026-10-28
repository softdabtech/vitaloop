import { describe, expect, it } from 'vitest'
import { checkInSummary } from './CheckInHistory.jsx'

describe('CheckInHistory', () => {
  it('uses persisted check-in notes without inventing a history record', () => {
    expect(checkInSummary({ symptom_changes: 'Less fatigue' })).toBe('Less fatigue')
    expect(checkInSummary({ notes: 'Stable' })).toBe('Stable')
    expect(checkInSummary({})).toBe('No symptom note recorded')
  })
})
