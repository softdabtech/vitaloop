import { beforeEach, describe, expect, it, vi } from 'vitest'
import { gaEvent, gaSignupIntent, gaViewPricing, getProductSurface } from './analytics.js'

describe('analytics safety', () => {
  beforeEach(() => {
    window.gtag = vi.fn()
  })

  it('detects main and UA surfaces from hostname', () => {
    expect(getProductSurface('vitaloop.today')).toBe('main')
    expect(getProductSurface('ua.vitaloop.today')).toBe('ua')
  })

  it('uses UI metadata instead of source for subscription and signup CTAs', () => {
    gaViewPricing('subscription_page')
    gaSignupIntent('symptom_assessment')
    const payloads = window.gtag.mock.calls.map(([, , payload]) => payload)
    expect(payloads[0]).toMatchObject({ ui_location: 'subscription_page', product_surface: 'main' })
    expect(payloads[1]).toMatchObject({ ui_location: 'symptom_intake', entry_point: 'symptom_assessment' })
    expect(payloads.every((payload) => !('source' in payload))).toBe(true)
  })

  it('filters health-derived values and internal IDs from GA4 payloads', () => {
    gaEvent('test_event', { email: 'a@a.com', upload_id: 'x', assessment_id: 'y', health_score: 9, biomarker: 'ferritin', ui_location: 'safe' })
    const payload = window.gtag.mock.calls[0][2]
    expect(payload).toMatchObject({ ui_location: 'safe', product_surface: 'main' })
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('upload_id')
    expect(payload).not.toHaveProperty('assessment_id')
    expect(payload).not.toHaveProperty('health_score')
    expect(payload).not.toHaveProperty('biomarker')
  })
})
