import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Subscription from './Subscription.jsx'

const { subscriptionMock, authMock, premiumAccessMock, apiMock } = vi.hoisted(() => ({
  subscriptionMock: vi.fn(),
  authMock: vi.fn(),
  premiumAccessMock: {
    requestPremiumAccess: vi.fn(),
    requestSubscriptionCancellation: vi.fn(),
  },
  apiMock: { post: vi.fn() },
}))

vi.mock('../hooks/useSubscription.js', () => ({ useSubscription: subscriptionMock }))
vi.mock('../hooks/useAuth.js', () => ({ useAuth: authMock }))
vi.mock('../lib/premiumAccess.js', () => premiumAccessMock)
vi.mock('../lib/api.js', () => ({ default: apiMock }))
vi.mock('../lib/locale.js', () => ({ isUkrainianLocale: () => false }))
vi.mock('../lib/analytics.js', () => ({
  gaViewPricing: vi.fn(),
  gaBeginCheckout: vi.fn(),
  gaPurchase: vi.fn(),
}))
vi.mock('../components/dashboard/CabinetPageHeader.jsx', () => ({
  default: ({ title }) => <h1>{title}</h1>,
}))

const freeState = {
  isPremium: false,
  subStatus: 'free',
  uploadCount: 1,
  uploadLimit: 1,
  uploadsRemaining: 0,
  loading: false,
  error: null,
  refresh: vi.fn(),
}

const premiumState = {
  ...freeState,
  isPremium: true,
  subStatus: 'active',
  uploadCount: 4,
  uploadLimit: Infinity,
  uploadsRemaining: Infinity,
}

function renderPage() {
  return render(<Subscription />)
}

describe('English Subscription truth contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockReturnValue({ user: { email: 'person@example.com' } })
    subscriptionMock.mockReturnValue(freeState)
  })

  afterEach(() => {
    cleanup()
  })

  it('explains Free status, usage, price, and manual activation without internal keys', () => {
    renderPage()

    expect(screen.getByText('Free plan active')).toBeTruthy()
    expect(screen.getByText('0 / 1')).toBeTruthy()
    expect(screen.getByText(/\$10\/month/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Request Premium activation' })).toBeTruthy()
    expect(screen.queryByText('Access key')).toBeNull()
    expect(screen.queryByText('Buy now')).toBeNull()
    expect(screen.queryByText('Checkout')).toBeNull()
    expect(screen.queryByText('Ask about annual access')).toBeNull()
  })

  it('shows Premium as active without inventing renewal or billing facts', () => {
    subscriptionMock.mockReturnValue(premiumState)
    renderPage()

    expect(screen.getByText('Premium active')).toBeTruthy()
    expect(screen.getByText('Unlimited')).toBeTruthy()
    expect(screen.queryByText('Access key')).toBeNull()
    expect(screen.queryByText(/renewal/i)).toBeNull()
    expect(screen.queryByText(/\$10\/month/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel subscription' })).toBeTruthy()
  })

  it('uses the manual support cancellation path for English Premium', async () => {
    subscriptionMock.mockReturnValue(premiumState)
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }))

    await waitFor(() => expect(premiumAccessMock.requestSubscriptionCancellation).toHaveBeenCalledWith({
      userEmail: 'person@example.com',
      source: 'subscription_page',
    }))
    expect(apiMock.post).not.toHaveBeenCalled()
  })

  it('shows a retry and support path when entitlement status cannot load', () => {
    const refresh = vi.fn()
    subscriptionMock.mockReturnValue({ ...freeState, error: new Error('status unavailable'), refresh })
    renderPage()

    expect(screen.getByRole('alert').textContent).toMatch(/could not load your subscription status/i)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refresh).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href')).toBe('mailto:info@softdab.tech')
  })

  it('prefills a support-only Premium request without health information', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Request Premium activation' }))

    await waitFor(() => expect(premiumAccessMock.requestPremiumAccess).toHaveBeenCalledWith({
      userEmail: 'person@example.com',
      source: 'subscription_page',
    }))
  })
})
