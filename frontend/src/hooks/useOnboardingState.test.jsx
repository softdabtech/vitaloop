import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnboardingState, ONBOARDING_LOAD_STATE } from './useOnboardingState.js'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn() },
}))

vi.mock('../lib/api.js', () => ({ default: apiMock }))

function Harness({ enabled = true }) {
  const { state, loadState, error, loading, isError, retry } = useOnboardingState({ enabled })
  return (
    <div>
      <output data-testid="loading">{String(loading)}</output>
      <output data-testid="loadState">{loadState}</output>
      <output data-testid="isError">{String(isError)}</output>
      <output data-testid="requires">{String(state.requires_onboarding)}</output>
      <output data-testid="error">{error ? error.message : 'null'}</output>
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

  it('shows ERROR state when onboarding request fails', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('Network error'))
    render(<Harness />)

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledOnce())
    expect(screen.getByTestId('loadState').textContent).toBe(ONBOARDING_LOAD_STATE.ERROR)
    expect(screen.getByTestId('isError').textContent).toBe('true')
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(screen.getByTestId('error').textContent).toBe('Network error')
    expect(screen.getByTestId('requires').textContent).toBe('null')
  })

  it('retries successfully after error', async () => {
    apiMock.get
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        data: { requires_onboarding: false, completed: true },
      })

    render(<Harness />)

    await waitFor(() => expect(screen.getByTestId('isError').textContent).toBe('true'))

    act(() => {
      screen.getByRole('button', { name: 'Retry' }).click()
    })

    await waitFor(() => expect(screen.getByTestId('loadState').textContent).toBe(ONBOARDING_LOAD_STATE.RESOLVED))
    expect(screen.getByTestId('requires').textContent).toBe('false')
    expect(screen.getByTestId('isError').textContent).toBe('false')
  })

  it('keeps transient failures unresolved and retries explicitly', async () => {
    apiMock.get
      .mockRejectedValueOnce(new Error('aborted'))
      .mockResolvedValueOnce({
        data: { requires_onboarding: false, completed: true },
      })

    render(<Harness />)

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledOnce())
    expect(screen.getByTestId('loadState').textContent).toBe(ONBOARDING_LOAD_STATE.ERROR)
    expect(screen.getByTestId('requires').textContent).toBe('null')

    act(() => {
      screen.getByRole('button', { name: 'Retry' }).click()
    })

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByTestId('loadState').textContent).toBe(ONBOARDING_LOAD_STATE.RESOLVED))
    expect(screen.getByTestId('requires').textContent).toBe('false')
  })

  it('preserves explicit required and complete backend states', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { requires_onboarding: true } })
    const { unmount } = render(<Harness />)

    await waitFor(() => expect(screen.getByTestId('requires').textContent).toBe('true'))
    expect(screen.getByTestId('loadState').textContent).toBe(ONBOARDING_LOAD_STATE.RESOLVED)
    unmount()

    vi.clearAllMocks()
    apiMock.get.mockResolvedValueOnce({ data: { requires_onboarding: false } })
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('requires').textContent).toBe('false'))
    expect(screen.getByTestId('loadState').textContent).toBe(ONBOARDING_LOAD_STATE.RESOLVED)
  })

  it('no infinite spinner on persistent error', async () => {
    apiMock.get.mockRejectedValue(new Error('Service unavailable'))
    render(<Harness />)

    await waitFor(() => expect(screen.getByTestId('isError').textContent).toBe('true'))
    expect(screen.getByTestId('loadState').textContent).toBe(ONBOARDING_LOAD_STATE.ERROR)
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })
})
