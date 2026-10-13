import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const { useLabResultsMock } = vi.hoisted(() => ({
  useLabResultsMock: vi.fn(),
}))

vi.mock('../hooks/useQueries.js', () => ({
  useDashboardSummary: vi.fn(() => ({ data: null })),
  useLabResults: useLabResultsMock,
  useQuestionnaireSession: vi.fn(() => ({ data: null })),
  useReportDetails: vi.fn(() => ({ data: null })),
}))

import { PersonalLabPlan, clinicalResultDate, normalizeLabPlanItems } from './LabPlan.jsx'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const plannedItem = {
  id: 'plan-1',
  test_name: 'Ferritin',
  canonical_normalized_test_name: 'ferritin',
  status: 'planned',
  reason: 'Repeat to check whether the change persists.',
  timing_text: 'In 6-12 weeks',
  source_recommendation_id: 'v1:next-test:secret',
  source_report_version_id: 'report-secret',
}

describe('PersonalLabPlan', () => {
  it('renders a persisted planned item with human-readable context', () => {
    render(<PersonalLabPlan items={[plannedItem]} isUk={false} loading={false} error={false} onRetry={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Your saved Lab Plan' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Ferritin' })).toBeTruthy()
    expect(screen.getByText('Planned')).toBeTruthy()
    expect(screen.getByText('Repeat to check whether the change persists.')).toBeTruthy()
    expect(screen.getByText('In 6-12 weeks')).toBeTruthy()
    expect(screen.getByText('Based on your report · recommendation')).toBeTruthy()
  })

  it('renders a fulfilled item as completed and links to the later result', () => {
    useLabResultsMock.mockReturnValue({
      data: { test_date: '2026-10-12', created_at: '2026-10-13T08:00:00Z' },
      isError: false,
    })
    render(
      <PersonalLabPlan
        items={[{ ...plannedItem, status: 'fulfilled', fulfilled_by_upload_id: 'upload-2' }]}
        isUk={false}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText('Completed')).toBeTruthy()
    expect(screen.getByText('Fulfilled by result from 2026-10-12')).toBeTruthy()
    expect(screen.queryByText('Planned')).toBeNull()
    expect(screen.getByRole('link', { name: 'View later result' }).getAttribute('href')).toBe('/results/upload-2')
  })

  it('does not use created_at as the clinical result date', () => {
    expect(clinicalResultDate({
      created_at: '2026-10-13T08:00:00Z',
    })).toBeNull()
  })

  it('uses a safe fulfillment message when the result has no reliable date', () => {
    useLabResultsMock.mockReturnValue({
      data: { created_at: '2026-10-13T08:00:00Z' },
      isError: false,
    })
    render(
      <PersonalLabPlan
        items={[{ ...plannedItem, status: 'fulfilled', fulfilled_by_upload_id: 'upload-2' }]}
        isUk={false}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText('Fulfilled by a later result.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View later result' })).toBeTruthy()
  })

  it('keeps the item completed when the later result cannot be loaded', () => {
    useLabResultsMock.mockReturnValue({ data: undefined, isError: true })
    render(
      <PersonalLabPlan
        items={[{ ...plannedItem, status: 'fulfilled', fulfilled_by_upload_id: 'upload-2' }]}
        isUk={false}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText('Completed')).toBeTruthy()
    expect(screen.queryByText('Planned')).toBeNull()
    expect(screen.getByText('Result details are temporarily unavailable.')).toBeTruthy()
  })

  it('fetches a shared fulfilled upload once for multiple plan items', () => {
    useLabResultsMock.mockReturnValue({
      data: { test_date: '2026-10-12' },
      isError: false,
    })
    render(
      <PersonalLabPlan
        items={[
          { ...plannedItem, status: 'fulfilled', test_name: 'Ferritin', fulfilled_by_upload_id: 'upload-2' },
          { ...plannedItem, status: 'fulfilled', test_name: 'Hemoglobin', canonical_normalized_test_name: 'hemoglobin', fulfilled_by_upload_id: 'upload-2' },
        ]}
        isUk={false}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />,
    )

    expect(useLabResultsMock).toHaveBeenCalledTimes(1)
    expect(useLabResultsMock).toHaveBeenCalledWith('upload-2')
    expect(screen.getAllByText('Fulfilled by result from 2026-10-12')).toHaveLength(2)
  })

  it('does not expose internal provenance identifiers in the main UI', () => {
    render(<PersonalLabPlan items={[plannedItem]} isUk={false} loading={false} error={false} onRetry={vi.fn()} />)

    expect(screen.queryByText('v1:next-test:secret')).toBeNull()
    expect(screen.queryByText('report-secret')).toBeNull()
  })

  it('deduplicates alias rows using the persisted canonical identity', () => {
    const items = normalizeLabPlanItems([
      plannedItem,
      { ...plannedItem, id: 'plan-2', test_name: 'Ferritin', normalized_test_name: 'iron storage' },
    ])

    expect(items).toHaveLength(1)
    render(<PersonalLabPlan items={items} isUk={false} loading={false} error={false} onRetry={vi.fn()} />)
    expect(screen.getAllByRole('heading', { name: 'Ferritin' })).toHaveLength(1)
  })

  it('renders a real empty state without presenting the catalog as saved items', () => {
    render(<PersonalLabPlan items={[]} isUk={false} loading={false} error={false} onRetry={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'No tests in your Lab Plan yet' })).toBeTruthy()
    expect(screen.queryByText('CBC')).toBeNull()
  })

  it('renders loading and API error states distinctly from an empty plan', () => {
    const onRetry = vi.fn()
    const { rerender } = render(<PersonalLabPlan items={[]} isUk={false} loading error={false} onRetry={onRetry} />)
    expect(screen.getByText('Loading your saved Lab Plan…')).toBeTruthy()
    expect(screen.queryByText('No tests in your Lab Plan yet')).toBeNull()

    rerender(<PersonalLabPlan items={[]} isUk={false} loading={false} error onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(screen.queryByText('No tests in your Lab Plan yet')).toBeNull()
  })
})
