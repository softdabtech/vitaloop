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

const { completeProtocolAction, listInterventions } = await import('./interventions.js')

describe('intervention API helpers', () => {
  it('fetches persisted interventions', async () => {
    getMock.mockResolvedValueOnce({ data: [{ id: 'event-1' }] })
    await expect(listInterventions()).resolves.toEqual([{ id: 'event-1' }])
    expect(getMock).toHaveBeenCalledWith('/interventions')
  })

  it('posts protocol action completion payload unchanged', async () => {
    const payload = {
      event_type: 'protocol_action',
      action_id: 'v1:action-plan:hydration:0',
      source_report_version_id: 'report-1',
      label: 'Stay hydrated',
      description: 'Drink water throughout the day.',
    }
    postMock.mockResolvedValueOnce({ data: { id: 'event-1' } })
    await expect(completeProtocolAction(payload)).resolves.toEqual({ id: 'event-1' })
    expect(postMock).toHaveBeenCalledWith('/interventions', payload)
  })
})
