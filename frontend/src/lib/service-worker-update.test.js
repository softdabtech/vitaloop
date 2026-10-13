import { describe, expect, it, vi } from 'vitest'
import { updateServiceWorker } from './service-worker-update.js'

describe('service worker update checks', () => {
  it('requests a fresh worker update when registration is available', async () => {
    const registration = { update: vi.fn().mockResolvedValue(undefined) }

    await expect(updateServiceWorker(registration)).resolves.toBe(true)
    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('does not fail when registration has no update method', async () => {
    await expect(updateServiceWorker(null)).resolves.toBe(false)
  })
})
