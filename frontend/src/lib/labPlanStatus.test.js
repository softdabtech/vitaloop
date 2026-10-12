import { describe, expect, it } from 'vitest'
import { labPlanItemLabel } from './labPlanStatus.js'

describe('lab plan item status labels', () => {
  it('renders planned items as In lab plan', () => {
    expect(labPlanItemLabel('planned')).toBe('In lab plan')
  })

  it('renders fulfilled items as Completed', () => {
    expect(labPlanItemLabel('fulfilled')).toBe('Completed')
  })
})
