import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Upload, { classifyAnalysisResponse } from '../pages/Upload.jsx'

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../lib/api.js', () => ({ default: apiMock }))
vi.mock('../hooks/useSubscription.js', () => ({
  useSubscription: () => ({ isPremium: true, uploadsRemaining: Infinity, loading: false }),
}))
vi.mock('../hooks/useQueries.js', () => ({
  useQuestionnaireSession: () => ({ data: null }),
}))

function renderUpload() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Upload />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiMock.get.mockReset()
  apiMock.get.mockResolvedValue({ data: { completed: true, checklist: { profile_basics: true } } })
})

afterEach(() => cleanup())

describe('Upload page', () => {
  it.each([
    [{ analysis_status: 'failed', upload_id: 'u' }, 'failed', false],
    [{ analysis_status: 'needs_confirmation', upload_id: 'u' }, 'needs_confirmation', false],
    [{ analysis_status: 'partial', upload_id: 'u', report_version: { id: 'r' } }, 'partial', true],
    [{ analysis_status: 'partial', upload_id: 'u' }, 'partial', false],
    [{ analysis_status: 'completed', finalization_replay: true, upload_id: 'u' }, 'replay', true],
    [{ analysis_status: 'completed', downstream_status: 'retryable', upload_id: 'u' }, 'followup_pending', true],
    [{ analysis_status: 'completed', upload_id: 'u' }, 'completed', true],
  ])('classifies API persistence state safely', (response, kind, canNavigate) => {
    expect(classifyAnalysisResponse(response)).toEqual({ kind, canNavigate })
  })

  it.each([
    ['PDF', '.pdf'],
    ['PNG', '.png'],
    ['JPEG', '.jpg'],
    ['GIF', '.gif'],
    ['BMP', '.bmp'],
    ['WebP', '.webp'],
    ['TIFF', '.tiff'],
    ['XLSX', '.xlsx'],
    ['XLS', '.xls'],
    ['CSV', '.csv'],
  ])('advertises the supported %s file extension', (_type, extension) => {
    const { container } = renderUpload()
    expect(container.querySelector('input[type="file"]').accept).toContain(extension)
  })

  it('renders upload instructions and supported-format guidance', () => {
    renderUpload()
    expect(screen.getByText(/Drag and drop your lab report/)).toBeTruthy()
    expect(screen.getByText(/PDF, images, XLS\/XLSX, or CSV\. Max 20MB\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose File' })).toBeTruthy()
  })

  it('loads onboarding status without requiring an external service', () => {
    renderUpload()
    expect(apiMock.get).toHaveBeenCalledWith('/auth/onboarding/state')
  })
})
