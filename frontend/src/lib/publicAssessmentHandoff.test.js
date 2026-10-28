import { afterEach, describe, expect, it, vi } from 'vitest'

const post = vi.hoisted(() => vi.fn())

vi.mock('./api.js', () => ({ default: { post } }))

import {
  claimPendingPublicAssessment,
  clearPendingPublicAssessment,
  readPendingPublicAssessment,
  stagePublicAssessmentHandoff,
} from './publicAssessmentHandoff.js'

afterEach(() => {
  clearPendingPublicAssessment()
  vi.clearAllMocks()
})

describe('public assessment signup handoff', () => {
  it('keeps only opaque ownership values in session storage', () => {
    expect(stagePublicAssessmentHandoff({ assessmentId: 'assessment-123', sessionId: 'session-123' })).toBe(true)
    expect(readPendingPublicAssessment()).toEqual({ assessmentId: 'assessment-123', sessionId: 'session-123' })
  })

  it('does not stage incomplete handoff data', () => {
    expect(stagePublicAssessmentHandoff({ assessmentId: 'short', sessionId: 'session-123' })).toBe(false)
    expect(readPendingPublicAssessment()).toBeNull()
  })

  it('clears the context only after the authenticated claim succeeds', async () => {
    stagePublicAssessmentHandoff({ assessmentId: 'assessment-123', sessionId: 'session-123' })
    post.mockResolvedValueOnce({ data: { claimed: true } })

    await expect(claimPendingPublicAssessment()).resolves.toBe(true)
    expect(post).toHaveBeenCalledWith('/assessment/claim', {
      assessment_id: 'assessment-123',
      session_id: 'session-123',
    })
    expect(readPendingPublicAssessment()).toBeNull()
  })

  it('retains the context when a claim cannot complete', async () => {
    stagePublicAssessmentHandoff({ assessmentId: 'assessment-123', sessionId: 'session-123' })
    post.mockRejectedValueOnce(new Error('offline'))

    await expect(claimPendingPublicAssessment()).resolves.toBe(false)
    expect(readPendingPublicAssessment()).toEqual({ assessmentId: 'assessment-123', sessionId: 'session-123' })
  })
})
