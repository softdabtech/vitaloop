import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Subscription from './Subscription.jsx'

const { subscriptionMock, creemMock } = vi.hoisted(() => ({
  subscriptionMock: vi.fn(),
  creemMock: { openCreemCheckout: vi.fn(), openCreemBillingPortal: vi.fn() },
}))

vi.mock('../hooks/useSubscription.js', () => ({ useSubscription: subscriptionMock }))
vi.mock('../lib/creemCheckout.js', () => creemMock)
vi.mock('../lib/locale.js', () => ({ isUkrainianLocale: () => false }))
vi.mock('../lib/analytics.js', () => ({ gaViewPricing: vi.fn(), gaBeginCheckout: vi.fn() }))
vi.mock('../components/dashboard/CabinetPageHeader.jsx', () => ({ default: ({ title }) => <h1>{title}</h1> }))

const freeState = {
  isPremium: false, subStatus: 'free', uploadCount: 1, uploadLimit: 1,
  uploadsRemaining: 0, loading: false, error: null, refresh: vi.fn(),
}

describe('Subscription checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionMock.mockReturnValue(freeState)
    creemMock.openCreemCheckout.mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  it('offers only Creem-hosted monthly and annual checkout', async () => {
    render(<Subscription />)
    expect(screen.getByRole('button', { name: 'Get Premium — $9.99/month' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Get annual Premium — $99.99/year' })).toBeTruthy()
    expect(screen.getByText(/Creem’s secure hosted checkout/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Get Premium — $9.99/month' }))
    await waitFor(() => expect(creemMock.openCreemCheckout).toHaveBeenCalledWith('monthly'))
  })

  it('opens Creem billing portal for an active Premium subscription', async () => {
    subscriptionMock.mockReturnValue({ ...freeState, isPremium: true, subStatus: 'active', uploadLimit: Infinity, uploadsRemaining: Infinity })
    render(<Subscription />)
    expect(screen.getByRole('heading', { name: 'Manage Premium' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Billing history' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Free' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }))
    await waitFor(() => expect(creemMock.openCreemBillingPortal).toHaveBeenCalledOnce())
  })

  it('shows a recoverable status error instead of leaving subscription management blank', () => {
    subscriptionMock.mockReturnValue({ ...freeState, error: new Error('request timed out') })

    render(<Subscription />)

    expect(screen.getByRole('alert').textContent).toContain('We could not load your subscription status')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(freeState.refresh).toHaveBeenCalledOnce()
  })
})
