import { cleanup, render, screen } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Help from './Help.jsx'

function renderHelp(embedded = false) {
  return render(
    <MemoryRouter initialEntries={[embedded ? '/help-center' : '/help']}>
      <HelmetProvider>
        <Help embedded={embedded} basePath={embedded ? '/help-center' : '/help'} />
      </HelmetProvider>
    </MemoryRouter>,
  )
}

describe('Help launch-readiness contract', () => {
  beforeEach(() => {
    globalThis.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    }))
  })

  afterEach(() => {
    cleanup()
    delete globalThis.IntersectionObserver
  })

  it('shows urgent safety guidance and support paths without search', () => {
    renderHelp(true)

    expect(screen.getByRole('heading', { name: /medical safety and urgent concerns/i })).toBeTruthy()
    expect(screen.getByText(/does not provide emergency care/i)).toBeTruthy()
    expect(screen.getByText(/qualified clinician/i)).toBeTruthy()
    expect(screen.getByText(/upload problems/i)).toBeTruthy()
    expect(screen.getByText(/account issues/i)).toBeTruthy()
    expect(screen.getByText(/billing issues/i)).toBeTruthy()
  })

  it('exposes embedded legal and safety destinations', () => {
    renderHelp(true)

    expect(screen.getByRole('link', { name: 'Privacy & Security' }).getAttribute('href')).toBe('/privacy-policy')
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    expect(screen.getByRole('link', { name: 'Editorial Policy' }).getAttribute('href')).toBe('/editorial-policy')
    expect(screen.getByRole('link', { name: 'Medical Review Policy' }).getAttribute('href')).toBe('/medical-review-policy')
    expect(screen.getByRole('link', { name: /Medical Disclaimer/ }).getAttribute('href')).toBe('/terms')
  })

  it('keeps public Help available without embedded legal shell', () => {
    renderHelp(false)

    expect(screen.getByRole('heading', { name: /medical safety and urgent concerns/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Legal and safety' })).toBeNull()
  })
})
