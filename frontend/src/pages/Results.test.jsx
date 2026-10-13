import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TestingPlanSection } from './Results.jsx'
import { reliableClinicalDate } from '../lib/retest.js'

afterEach(cleanup)

const copy = {
  testingPlanTitle: 'Testing & Retest Plan',
  testingPlanIntro: 'Testing plan',
  testingPlanEmpty: 'No tests',
  testingPlanPriority: { high: 'High priority', medium: 'Medium priority', low: 'Low priority' },
  testingPlanTiming: 'Suggested timing',
  testingPlanCompletedTitle: 'Completed since your last report',
  retestNotDue: 'Not due yet',
  retestDueNow: 'Due now',
  retestOverdue: 'Overdue',
  retestPending: 'Pending',
  retestCompleted: 'Completed',
  retestWindow: (start, end) => `Retest window: ${start} – ${end}`,
  retestNext: 'Next retest',
  retestCompletedBy: 'Completed by a later result.',
  viewLaterResult: 'View later result',
  addToLabPlan: 'Add to lab plan',
  savingToLabPlan: 'Saving...',
  inLabPlan: 'In lab plan',
}

const baseProps = {
  nextBestTests: null,
  retestPlan: [{ marker: 'Hemoglobin', timing: '6-12 weeks', reason: 'Follow up' }],
  evidenceGaps: null,
  nextTestFunnel: null,
  labPlanItems: [],
  savingPlanTest: null,
  onAddToLabPlan: () => {},
  sourceReportVersionId: null,
  copy,
  isUk: false,
  today: new Date('2026-10-13T12:00:00Z'),
}

const futureObligation = {
  id: 'retest-1',
  marker: 'canonical_hemoglobin',
  source_report_version_id: 'report-1',
  retest_window_start: '2026-11-21',
  retest_window_end: '2027-01-02',
  fulfillment_status: 'pending',
  timing: '6-12 weeks',
}

describe('Results persisted retest presentation', () => {
  it('explains a completed marker and its distinct future retest', () => {
    render(
      <TestingPlanSection
        {...baseProps}
        persistedRetestPlan={[futureObligation]}
        nextTestFunnel={{ completed_since_last_upload: [{ marker: 'HGB' }] }}
      />,
    )

    expect(screen.getByText('Completed since your last report')).toBeTruthy()
    expect(screen.getByText('Next retest')).toBeTruthy()
    expect(screen.getByText('Not due yet')).toBeTruthy()
    expect(screen.getByText('Retest window: Nov 21, 2026 – Jan 2, 2027')).toBeTruthy()
    expect(screen.getByText('6-12 weeks')).toBeTruthy()
  })

  it.each([
    ['future', 'Not due yet', new Date('2026-10-13T12:00:00Z')],
    ['due', 'Due now', new Date('2026-12-01T12:00:00Z')],
    ['overdue', 'Overdue', new Date('2027-02-01T12:00:00Z')],
  ])('renders the persisted %s state', (_name, label, today) => {
    render(<TestingPlanSection {...baseProps} persistedRetestPlan={[futureObligation]} today={today} />)
    expect(screen.getByText(label)).toBeTruthy()
    expect(screen.getByText('Retest window: Nov 21, 2026 – Jan 2, 2027')).toBeTruthy()
  })

  it('renders a fulfilled obligation once with its result link and no pending suggestion', () => {
    render(
      <TestingPlanSection
        {...baseProps}
        persistedRetestPlan={[{
          ...futureObligation,
          fulfillment_status: 'fulfilled',
          fulfilled_by_upload_id: 'upload-42',
        }]}
      />,
    )

    expect(screen.getByText('Completed')).toBeTruthy()
    expect(screen.getByText('Completed by a later result.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View later result' }).getAttribute('href')).toBe('/results/upload-42')
    expect(screen.queryByText('Suggested timing: 6-12 weeks')).toBeNull()
    expect(screen.queryByText('Add to lab plan')).toBeNull()
  })

  it('keeps report timing as the safe fallback when interventions are unavailable', () => {
    render(<TestingPlanSection {...baseProps} persistedRetestPlan={[]} />)
    expect(screen.getByText('6-12 weeks')).toBeTruthy()
    expect(screen.queryByText('Not due yet')).toBeNull()
    expect(screen.queryByText(/Retest window:/)).toBeNull()
  })

  it('does not use created_at as a fulfillment clinical date', () => {
    expect(reliableClinicalDate({
      created_at: '2026-10-13T08:00:00Z',
      metadata: { created_at: '2026-10-13T08:00:00Z' },
    })).toBeNull()
  })

  it('keeps long state and window content wrap-safe', () => {
    const { container } = render(<TestingPlanSection {...baseProps} persistedRetestPlan={[futureObligation]} />)
    expect(container.querySelector('.flex.flex-wrap')).toBeTruthy()
    expect(container.querySelector('.break-words')).toBeTruthy()
  })
})
