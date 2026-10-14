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

import {
  PersonalLabPlan,
  classifyLabRecommendationContext,
  clinicalResultDate,
  isHistoricalLabPlanItem,
  normalizeLabPlanItems,
  reportTestDisplayName,
  selectReportSpecificRecommendations,
} from './LabPlan.jsx'

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
  it('keeps historical context breakpoint-independent when report ids use different scalar types', () => {
    expect(isHistoricalLabPlanItem({ source_report_version_id: 17 }, '18')).toBe(true)
    expect(isHistoricalLabPlanItem({ source_report_version_id: 17 }, '17')).toBe(false)
  })

  it('keeps persisted reasons neutral while the active report identity is unavailable', () => {
    render(<PersonalLabPlan items={[plannedItem]} isUk={false} loading={false} error={false} onRetry={vi.fn()} />)

    expect(screen.getByText('Historical context')).toBeTruthy()
    expect(screen.getByText('This test was added from an earlier report.')).toBeTruthy()
    expect(screen.queryByText(plannedItem.reason)).toBeNull()
    expect(screen.getByText('Planned')).toBeTruthy()
  })

  it('classifies fulfilled report recommendations without exposing their reason', () => {
    expect(classifyLabRecommendationContext(
      { marker: 'crp', source_report_version_id: 'report-current' },
      {
        activeReportVersionId: 'report-current',
        plannedItems: [{ test_name: 'CRP', status: 'fulfilled' }],
      },
    )).toEqual({ historical: false, fulfilled: true })
  })

  it('classifies an older report recommendation as historical', () => {
    expect(classifyLabRecommendationContext(
      { marker: 'vitamin_d', source_report_version_id: 'report-old' },
      { activeReportVersionId: 'report-current', plannedItems: [] },
    )).toEqual({ historical: true, fulfilled: false })
  })

  it('keeps report-specific biomarker labels human-readable', () => {
    expect(reportTestDisplayName('mch')).toBe('MCH')
    expect(reportTestDisplayName('transferrin_saturation')).toBe('Transferrin Saturation')
  })

  it('does not show current or fulfilled tests as unresolved report gaps', () => {
    const recommendations = selectReportSpecificRecommendations(
      [
        { marker: 'vitamin_d', reason: 'Older deficiency context.' },
        { marker: 'crp', reason: 'Inflammation follow-up.' },
        { marker: 'ferritin', reason: 'Iron storage context.' },
        { marker: 'transferrin_saturation', reason: 'Clarify iron status.' },
      ],
      new Set(['vitamin_d', 'ferritin']),
      new Set(['crp']),
    )

    expect(recommendations.map((item) => item.name)).toEqual(['Transferrin Saturation'])
  })

  it('renders a persisted planned item with human-readable context', () => {
    render(<PersonalLabPlan items={[plannedItem]} activeReportVersionId="report-secret" isUk={false} loading={false} error={false} onRetry={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Your saved Lab Plan' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Ferritin' })).toBeTruthy()
    expect(screen.getByText('Planned')).toBeTruthy()
    expect(screen.getByText('Repeat to check whether the change persists.')).toBeTruthy()
    expect(screen.getByText('In 6-12 weeks')).toBeTruthy()
    expect(screen.getByText('Based on your report · recommendation')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Ferritin' }).className).toContain('lab-plan-item-card__name')
  })

  it('keeps long persisted test names and timing in mobile-safe blocks', () => {
    render(
      <PersonalLabPlan
        items={[{ ...plannedItem, test_name: 'Transferrin Saturation', timing_text: 'Repeat in 6-12 weeks after the next clinical review window.' }]}
        activeReportVersionId="report-secret"
        isUk={false}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Transferrin Saturation' }).className).toContain('lab-plan-item-card__name')
    expect(screen.getByText('Repeat in 6-12 weeks after the next clinical review window.').className).toContain('lab-plan-item-card__timing')
  })

  it('normalizes persisted biomarker names without changing the source item', () => {
    const item = { ...plannedItem, test_name: 'mch', canonical_normalized_test_name: 'mch' }
    render(<PersonalLabPlan items={[item]} activeReportVersionId="report-secret" isUk={false} loading={false} error={false} onRetry={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'MCH' })).toBeTruthy()
    expect(item.test_name).toBe('mch')
  })

  it('marks an item from an earlier report as historical without changing its status', () => {
    render(
      <PersonalLabPlan
        items={[plannedItem]}
        activeReportVersionId="report-current"
        isUk={false}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText(/From an earlier report/)).toBeTruthy()
    expect(screen.getByText('This test was added from an earlier report.')).toBeTruthy()
    expect(screen.getByText('Planned')).toBeTruthy()
  })

  it('shows neutral historical context instead of an earlier clinical reason', () => {
    const item = {
      ...plannedItem,
      test_name: 'Vitamin D',
      reason: 'Vitamin D is deficient and should be trended after intervention or clinical review.',
      source_report_version_id: 'earlier-report',
    }
    render(
      <PersonalLabPlan
        items={[item]}
        isUk={false}
        loading={false}
        error={false}
        onRetry={vi.fn()}
        activeReportVersionId="current-report"
      />,
    )

    expect(screen.getByText('Historical context')).toBeTruthy()
    expect(screen.getByText('This test was added from an earlier report.')).toBeTruthy()
    expect(screen.queryByText(item.reason)).toBeNull()
    expect(screen.getByText((_, element) => (
      element?.tagName === 'P' && element.textContent.includes('From an earlier report')
    ))).toBeTruthy()
  })

  it('preserves current report rationale and fulfilled state', () => {
    const item = {
      ...plannedItem,
      status: 'fulfilled',
      source_report_version_id: 'current-report',
      fulfilled_by_upload_id: 'upload-2',
    }
    useLabResultsMock.mockReturnValue({ data: { test_date: '2026-10-12' }, isError: false })
    render(
      <PersonalLabPlan
        items={[item]}
        isUk={false}
        loading={false}
        error={false}
        onRetry={vi.fn()}
        activeReportVersionId="current-report"
      />,
    )

    expect(screen.getByText(item.reason)).toBeTruthy()
    expect(screen.getByText('Completed')).toBeTruthy()
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
