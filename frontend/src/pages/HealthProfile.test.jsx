import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HealthProfile, {
  buildProfileUpdatePayload,
  mapProfileFromApi,
  mapProfileFromUserMeta,
} from './HealthProfile.jsx'

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), patch: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}))
const testUser = { user_metadata: { full_name: 'Metadata Name', age: 41 } }

vi.mock('../lib/api.js', () => ({ default: apiMock }))
vi.mock('react-hot-toast', () => ({ default: toastMock }))
vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({ user: testUser }),
}))
vi.mock('../lib/locale.js', () => ({ isUkrainianLocale: () => false }))
vi.mock('../lib/cabinetI18n.js', () => ({
  ct: () => ({
    healthProfile: {
      title: 'Health Profile',
      subtitle: 'Profile subtitle',
      helper: 'Profile helper',
    },
  }),
}))
vi.mock('../lib/funnel.js', () => ({ trackFunnelEvent: vi.fn() }))
vi.mock('../lib/analytics.js', () => ({ gaEvent: vi.fn() }))
vi.mock('../components/dashboard/CabinetPageHeader.jsx', () => ({
  default: ({ title }) => <h1>{title}</h1>,
}))
vi.mock('../components/coach/CoachUI.jsx', () => ({
  CoachButton: ({ children, ...props }) => <button {...props}>{children}</button>,
  CoachCard: ({ children }) => <section>{children}</section>,
  CoachInput: ({ label, children }) => <label>{label}{children}</label>,
  CoachProgress: ({ value }) => <progress value={value} max="100" />,
}))

const profile = {
  full_name: 'Persisted Name',
  age: 42,
  sex: 'female',
  height_cm: 170,
  weight_kg: 65,
  goals: ['More energy'],
  timezone: 'Europe/London',
  medications: 'None',
  allergies: 'Nuts',
  pregnancy_status: 'none',
  current_supplements: ['Vitamin D'],
  current_medications: ['Medication A'],
  prior_diagnoses: 'None',
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <HealthProfile />
    </QueryClientProvider>,
  )
}

describe('HealthProfile profile resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.get.mockResolvedValue({ data: { profile } })
    apiMock.patch.mockResolvedValue({ data: { profile } })
  })

  afterEach(() => {
    cleanup()
  })

  it('maps persisted scalar and list fields without changing their contract', () => {
    const mapped = mapProfileFromApi(profile)

    expect(mapped).toMatchObject({
      full_name: 'Persisted Name',
      age: 42,
      sex: 'female',
      height_cm: 170,
      weight_kg: 65,
      timezone: 'Europe/London',
      goals: ['More energy'],
      medications: 'None',
      allergies: 'Nuts',
      pregnancy_status: 'none',
      current_supplements: 'Vitamin D',
      current_medications: 'Medication A',
      prior_diagnoses: 'None',
    })
  })

  it('uses auth full_name only when the persisted profile omits it', () => {
    expect(mapProfileFromApi({ age: 42 }, { full_name: 'Metadata Name' }).full_name).toBe('Metadata Name')
    expect(mapProfileFromApi({ full_name: 'Persisted Name' }, { full_name: 'Metadata Name' }).full_name).toBe('Persisted Name')
    expect(mapProfileFromUserMeta({ full_name: 'Metadata Name' }).full_name).toBe('Metadata Name')
  })

  it('shows a non-destructive load warning and retries the profile request', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('network failure')).mockResolvedValueOnce({ data: { profile } })
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/could not be loaded/i)
    expect(screen.getByRole('textbox', { name: 'Full name' }).value).toBe('Metadata Name')

    fireEvent.click(alert.querySelector('button'))

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByRole('textbox', { name: 'Full name' }).value).toBe('Persisted Name')
  })

  it('loads and patches full_name, then displays the saved response', async () => {
    renderPage()
    expect((await screen.findByRole('textbox', { name: 'Full name' })).value).toBe('Persisted Name')

    fireEvent.change(screen.getByRole('textbox', { name: 'Full name' }), { target: { value: 'Updated Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile & Safety' }))

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledOnce())
    expect(apiMock.patch.mock.calls[0][1]).toMatchObject({ full_name: 'Updated Name' })
    expect(await screen.findByDisplayValue('Persisted Name')).toBeTruthy()
    expect(toastMock.success).toHaveBeenCalledWith('Profile & Safety updated!')
  })

  it('does not send an accidental empty full_name overwrite', () => {
    expect(buildProfileUpdatePayload({ full_name: '  ', current_supplements: '', current_medications: '' }).full_name).toBeNull()
  })

  it('keeps save errors visible without success feedback', async () => {
    apiMock.patch.mockRejectedValueOnce(new Error('save failure'))
    renderPage()
    await screen.findByRole('textbox', { name: 'Full name' })

    fireEvent.click(screen.getByRole('button', { name: 'Save Profile & Safety' }))

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Failed to save profile'))
    expect(toastMock.success).not.toHaveBeenCalled()
  })
})
