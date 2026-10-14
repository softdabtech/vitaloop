import { describe, expect, it } from 'vitest'
import { normalizePath, resolvePageMeta, CABINET_ROUTE_META } from './pathUtils.js'

describe('pathUtils', () => {
  describe('normalizePath', () => {
    it('removes trailing slashes', () => {
      expect(normalizePath('/dashboard/')).toBe('/dashboard')
      expect(normalizePath('/health-profile/')).toBe('/health-profile')
      expect(normalizePath('/billing-history/')).toBe('/billing-history')
    })

    it('preserves nested routes', () => {
      expect(normalizePath('/results/abc123/')).toBe('/results/abc123')
      expect(normalizePath('/protocol/def456/')).toBe('/protocol/def456')
    })

    it('preserves root path', () => {
      expect(normalizePath('/')).toBe('/')
    })

    it('handles paths without trailing slashes', () => {
      expect(normalizePath('/dashboard')).toBe('/dashboard')
      expect(normalizePath('/results/abc123')).toBe('/results/abc123')
    })

    it('handles empty string', () => {
      expect(normalizePath('')).toBe('/')
      expect(normalizePath(null)).toBe('/')
    })
  })

  describe('resolvePageMeta', () => {
    it('resolves exact paths', () => {
      const meta = resolvePageMeta('/dashboard', false)
      expect(meta.title).toBe('Dashboard')
      expect(meta.key).toBe('dashboard')
    })

    it('resolves paths with trailing slashes', () => {
      const meta = resolvePageMeta('/health-profile/', false)
      expect(meta.title).toBe('Profile & Safety')
      expect(meta.key).toBe('health_profile')
    })

    it('resolves Ukrainian titles', () => {
      const meta = resolvePageMeta('/billing-history', true)
      expect(meta.title).toBe('Історія платежів')
    })

    it('resolves nested route patterns', () => {
      const meta = resolvePageMeta('/results/abc123', false)
      expect(meta.title).toBe('Results')
      expect(meta.key).toBe('results')
    })

    it('resolves protocol nested routes', () => {
      const meta = resolvePageMeta('/protocol/def456', false)
      expect(meta.title).toBe('Protocol')
      expect(meta.key).toBe('protocol')
    })

    it('resolves check-ins routes', () => {
      const meta = resolvePageMeta('/check-ins', false)
      expect(meta.title).toBe('Check-in History')
      expect(meta.key).toBe('check_ins')
    })

    it('falls back for unknown paths', () => {
      const meta = resolvePageMeta('/unknown-route', false)
      expect(meta.title).toBe('Vitaloop')
    })
  })

  describe('CABINET_ROUTE_META', () => {
    it('contains all required cabinet routes', () => {
      const requiredRoutes = [
        '/dashboard',
        '/upload',
        '/lab-plan',
        '/lab-results',
        '/results',
        '/protocol',
        '/account',
        '/health-profile',
        '/subscription',
        '/billing-history',
        '/check-ins',
        '/help-center',
      ]

      requiredRoutes.forEach((route) => {
        expect(CABINET_ROUTE_META).toHaveProperty(route)
        expect(CABINET_ROUTE_META[route]).toHaveProperty('title')
        expect(CABINET_ROUTE_META[route]).toHaveProperty('ukTitle')
        expect(CABINET_ROUTE_META[route]).toHaveProperty('key')
      })
    })

    it('each entry has title, ukTitle, and key', () => {
      Object.values(CABINET_ROUTE_META).forEach((meta) => {
        expect(meta).toHaveProperty('title')
        expect(meta).toHaveProperty('ukTitle')
        expect(meta).toHaveProperty('key')
        expect(typeof meta.title).toBe('string')
        expect(typeof meta.ukTitle).toBe('string')
        expect(typeof meta.key).toBe('string')
      })
    })
  })
})
