import { describe, expect, it, vi } from 'vitest'

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock('../lib/api.js', () => ({
  default: {
    get: getMock,
    post: postMock,
  },
}))

const { addLabPlanItem, listLabPlanItems } = await import('./labPlan.js')

describe('lab plan API helpers', () => {
  it('fetches saved plan items', async () => {
    getMock.mockResolvedValueOnce({ data: [{ id: 'plan-1' }] })
    await expect(listLabPlanItems()).resolves.toEqual([{ id: 'plan-1' }])
    expect(getMock).toHaveBeenCalledWith('/lab-plan/items')
  })

  it('posts only the report and generated test identity', async () => {
    const payload = {
      source_report_version_id: 'report-1',
      test_name: 'Ferritin',
    }
    postMock.mockResolvedValueOnce({ data: { id: 'plan-1', test_type: 'retest' } })
    await expect(addLabPlanItem(payload)).resolves.toEqual({ id: 'plan-1', test_type: 'retest' })
    expect(postMock).toHaveBeenCalledWith('/lab-plan/items', payload)
  })

  it('forwards a server-generated recommendation identity without creating one', async () => {
    const payload = {
      source_report_version_id: 'report-1',
      source_recommendation_id: 'v1:next-test:evidence_gaps:ferritin:0',
      test_name: 'Ferritin',
    }
    postMock.mockResolvedValueOnce({ data: { id: 'plan-1' } })

    await expect(addLabPlanItem(payload)).resolves.toEqual({ id: 'plan-1' })
    expect(postMock).toHaveBeenCalledWith('/lab-plan/items', payload)
  })
})
