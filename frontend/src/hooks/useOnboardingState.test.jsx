import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnboardingState } from './useOnboardingState.js'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn() },
}))

vi.mock('../lib/api.js', () => ({ default: apiMock }))

function Harness({ enabled = true }) {
  const { state, loading, retry } = useOnboardingState({ enabled })
  return (
    <div>
      <output data-testid="loading">{String(loading)}</output>
      <output data-testid="requires">{String(state.requires_onboarding)}</output>
      <button type="button" onClick={retry}>Retry</button>
    </div>
  )
}

describe('useOnboardingState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not request or require onboarding while auth is unresolved', () => {
    render(<Harness enabled={false} />)

    expect(apiMock.get).not.toHaveBeenCalled()
    expect(screen.getByTestId('loading').textContent).toBe('true')
    expect(screen.getByTestId('requires').textContent).toBe('null')
  })

  it('keeps transient failures unresolved and retries explicitly', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('aborted')).mockResolvedValueOnce({
      data: { requires_onboarding: false, completed: true },
    })
    render(<Harness />)

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledOnce())
    expect(screen.getByTestId('requires').textContent).toBe('null')

    act(() => {
      screen.getByRole('button', { name: 'Retry' }).click()
    })
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('requires').textContent).toBe('false')
  })

  it('preserves explicit required and complete backend states', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { requires_onboarding: true } })
    const { unmount } = render(<Harness />)

    await waitFor(() => expect(screen.getByTestId('requires').textContent).toBe('true'))
    unmount()

    apiMock.get.mockResolvedValueOnce({ data: { requires_onboarding: false } })
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('requires').textContent).toBe('false'))
  })
})
