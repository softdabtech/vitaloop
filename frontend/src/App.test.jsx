import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { isCabinetRoutePath, shouldRedirectToOnboarding } from './App.jsx'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn() },
}))

vi.mock('./lib/api.js', () => ({ default: apiMock }))
vi.mock('./hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'test-user' }, loading: false }),
}))
vi.mock('./components/PaywallModal.jsx', () => ({ default: () => null }))
vi.mock('./components/dashboard/UserCabinetLayout.jsx', () => ({
  default: ({ children }) => children,
}))
vi.mock('./pages/HealthProfile.jsx', () => ({
  default: () => <div>Health profile route content</div>,
}))

beforeEach(() => {
  apiMock.get.mockReset()
  window.scrollTo = vi.fn()
  globalThis.Element.prototype.scrollIntoView = vi.fn()
  window.history.replaceState({}, '', '/health-profile')
})

afterEach(() => {
  cleanup()
  delete globalThis.Element.prototype.scrollIntoView
  window.history.replaceState({}, '', '/')
})

describe('cabinet route classification', () => {
  it('classifies Help Center with cabinet routes', () => {
    expect(isCabinetRoutePath('/help-center')).toBe(true)
    expect(isCabinetRoutePath('/help-center/article')).toBe(true)
  })

  it('keeps public Help outside the cabinet shell', () => {
    expect(isCabinetRoutePath('/help')).toBe(false)
    expect(isCabinetRoutePath('/help/section/billing')).toBe(false)
  })
})

describe('EndUserFlowRoute onboarding error recovery', () => {
  it('opens SupportChat accessibly and restores launcher focus after Escape', async () => {
    apiMock.get.mockResolvedValue({ data: { requires_onboarding: false } })

    render(<App />)
    const launcher = await screen.findByRole('button', { name: 'Open support chat' })
    fireEvent.click(launcher)

    expect(await screen.findByRole('dialog', { name: 'VITALOOP Support' })).toBeTruthy()
    const input = screen.getByRole('textbox', { name: 'Message' })
    await waitFor(() => expect(document.activeElement).toBe(input))

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'VITALOOP Support' })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(launcher))
  })

  it('shows the error screen, retries, recovers to the protected route, and does not redirect', async () => {
    apiMock.get
      .mockRejectedValueOnce(new Error('Onboarding service unavailable'))
      .mockResolvedValueOnce({ data: { requires_onboarding: false } })

    render(<App />)

    expect(await screen.findByText('Unable to load dashboard')).toBeTruthy()
    expect(screen.getByText('Onboarding service unavailable')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Health profile route content')).toBeTruthy()
    expect(apiMock.get).toHaveBeenCalledTimes(2)
    expect(window.location.pathname).toBe('/health-profile')
    expect(screen.queryByText('Unable to load dashboard')).toBeNull()
  })

  it('keeps the error UI after a persistent failure without redirecting or spinning', async () => {
    apiMock.get.mockRejectedValue(new Error('Service remains unavailable'))

    render(<App />)

    expect(await screen.findByText('Unable to load dashboard')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Service remains unavailable')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByText('Loading your health dashboard...')).toBeNull()
    expect(window.location.pathname).toBe('/health-profile')
    expect(screen.queryByText('Health profile route content')).toBeNull()
  })
})

describe('onboarding route guard', () => {
  it('does not redirect while onboarding state is unresolved', () => {
    expect(shouldRedirectToOnboarding({
      onboardingStateKnown: false,
      requiresOnboarding: true,
      allowBeforeOnboarding: false,
    })).toBe(false)
  })

  it('redirects only for an explicit required state', () => {
    expect(shouldRedirectToOnboarding({
      onboardingStateKnown: true,
      requiresOnboarding: true,
      allowBeforeOnboarding: false,
    })).toBe(true)
    expect(shouldRedirectToOnboarding({
      onboardingStateKnown: true,
      requiresOnboarding: false,
      allowBeforeOnboarding: false,
    })).toBe(false)
  })
})
