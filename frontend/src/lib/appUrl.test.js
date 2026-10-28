import { describe, expect, it, vi } from 'vitest'

describe('appUrl', () => {
  it('uses the canonical English cabinet origin for relative paths', async () => {
    vi.stubEnv('VITE_APP_BASE_URL', 'https://app.vitaloop.today')
    const { appUrl, getAppBaseUrl } = await import('./appUrl.js')

    expect(getAppBaseUrl()).toBe('https://app.vitaloop.today')
    expect(appUrl('/dashboard?source=landing')).toBe('https://app.vitaloop.today/dashboard?source=landing')
  })

  it('does not alter an absolute URL', async () => {
    const { appUrl, publicSiteUrl } = await import('./appUrl.js')
    expect(appUrl('https://vitaloop.today/privacy-policy/')).toBe('https://vitaloop.today/privacy-policy/')
    expect(publicSiteUrl('/how-it-works/')).toBe('https://vitaloop.today/how-it-works/')
  })
})
