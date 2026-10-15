import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TestingPlanSection,
  UnifiedNarrativeSection,
  filterRepeatedActions,
  formatRange,
  normalizeBiomarkerStatus,
  reportContext,
  safetyStatusLabel,
  summarizeBiomarkerStatuses,
} from './Results.jsx'
import { actionSourceLabel as recommendationSourceLabel } from './ProtocolPage.jsx'
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
  narrativeTitle: 'Your personal interpretation',
  narrativeHeadline: 'What this report means for you',
  narrativeFound: 'What we found',
  narrativeConnections: 'How it connects to you',
  narrativeChanged: 'What changed over time',
  narrativeUncertainty: 'What we are not sure about',
  narrativePriority: 'Why this is a priority',
  narrativeNext: 'What to do next',
  narrativeNoChange: 'No verified change over time was available for this report.',
  safetyStatus: {
    blocked: 'Safety review required',
    approved_with_warnings: 'Reviewed with cautions',
    educational: 'Educational information',
  },
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
  it('reads patient-facing source and report date from the frozen report metadata', () => {
    expect(reportContext({
      metadata: {
        source: { lab_name: 'Very Long Lab Filename.pdf' },
        measurement_date: '2026-10-12',
      },
    })).toEqual({
      source: 'Very Long Lab Filename.pdf',
      date: '2026-10-12',
    })
  })

  it('prefers the uploaded filename over an internal source token', () => {
    expect(reportContext({
      upload: { lab_name: 'Гілевич (8).pdf' },
      metadata: { source: 'b2c_file' },
    }).source).toBe('Гілевич (8).pdf')
  })

  it('omits internal source tokens when no patient-facing filename exists', () => {
    expect(reportContext({ metadata: { source: 'b2c_file' } }).source).toBe('')
  })

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

  describe('Results uncertainty and narrative presentation', () => {
    it('keeps missing or unevaluated biomarkers fail-closed with clear wording', () => {
      expect(normalizeBiomarkerStatus({ value: 4, status: 'UNEVALUATED', ref_low: null, ref_high: null })).toBe('UNKNOWN')
      expect(normalizeBiomarkerStatus({ value: 4, status: 'UNKNOWN', ref_low: 1, ref_high: 10 })).toBe('UNKNOWN')
      expect(normalizeBiomarkerStatus({ value: 4, status: 'UNRECOGNIZED', ref_low: 1, ref_high: 10 })).toBe('UNKNOWN')
      expect(normalizeBiomarkerStatus({ value: 4, status: 'OPTIMAL', ref_low: 1 })).toBe('UNKNOWN')
      expect(normalizeBiomarkerStatus({ value: 4, status: 'DEFICIENT', ref_low: null, ref_high: 10 })).toBe('UNKNOWN')
      expect(normalizeBiomarkerStatus({ value: 4, status: 'OPTIMAL', ref_low: '', ref_high: 10 })).toBe('UNKNOWN')
      expect(normalizeBiomarkerStatus({ value: 4, status: 'OPTIMAL', ref_low: 5 })).toBe('DEFICIENT')
      expect(normalizeBiomarkerStatus({ value: 12, status: 'OPTIMAL', ref_high: 10 })).toBe('ELEVATED')
      expect(normalizeBiomarkerStatus({ value: 4, status: 'OPTIMAL', ref_low: 'bad', ref_high: 10 })).toBe('UNKNOWN')
      expect(normalizeBiomarkerStatus({ value: 4, status: 'OPTIMAL', ref_low: 10, ref_high: 1 })).toBe('UNKNOWN')
      expect(formatRange({ ref_low: null, ref_high: null })).toBe('Reference range could not be verified')
    })

    it('normalizes status aliases while preserving borderline as a separate category', () => {
      expect(normalizeBiomarkerStatus({ status: 'NORMAL', ref_low: 1, ref_high: 10 })).toBe('OPTIMAL')
      expect(normalizeBiomarkerStatus({ status: 'IN_RANGE', ref_low: 1, ref_high: 10 })).toBe('OPTIMAL')
      expect(normalizeBiomarkerStatus({ status: 'LOW NORMAL', ref_low: 1, ref_high: 10 })).toBe('BORDERLINE')
      expect(normalizeBiomarkerStatus({ status: 'L', ref_low: 1, ref_high: 10 })).toBe('DEFICIENT')
      expect(normalizeBiomarkerStatus({ status: 'CRITICAL', ref_low: 1, ref_high: 10 })).toBe('ELEVATED')
    })

    it('counts unknown and borderline separately from in-range biomarkers', () => {
      expect(summarizeBiomarkerStatuses([
        { status: 'DEFICIENT' },
        { status: 'ELEVATED', ref_low: 1, ref_high: 10 },
        { status: 'BORDERLINE', ref_low: 1, ref_high: 10 },
        { status: 'NORMAL', ref_low: 1, ref_high: 10 },
        { status: 'UNKNOWN', ref_low: 1, ref_high: 10 },
        { status: 'UNEVALUATED', ref_low: 1, ref_high: 10 },
        { status: 'OPTIMAL', ref_low: 1 },
        { status: 'OPTIMAL', ref_low: 5, value: 4 },
      ])).toEqual({
        total: 8,
        optimal: 1,
        borderline: 1,
        deficient: 1,
        elevated: 1,
        unknown: 4,
      })
    })

    it('translates safety states instead of exposing internal enum values', () => {
      expect(safetyStatusLabel('approved_with_warnings', copy)).toBe('Reviewed with cautions')
      expect(safetyStatusLabel('unexpected_internal_state', copy)).toBe('Educational information')
    })

    it('shows supported recommendation provenance without raw source fallbacks', () => {
      expect(recommendationSourceLabel('pattern', false)).toBe('Pattern insight')
      expect(recommendationSourceLabel('evidence_gap', true)).toBe('Брак даних')
      expect(recommendationSourceLabel('internal_source', false)).toBe('')
    })

    it('removes only exact duplicate action copy from secondary surfaces', () => {
      const items = [{ text: 'Improve hydration' }, { text: 'Discuss ferritin with a clinician' }]
      const authoritative = [{ title: 'Improve hydration' }]
      expect(filterRepeatedActions(items, authoritative)).toEqual([{ text: 'Discuss ferritin with a clinician' }])
    })

    it('shows the explicit changed-over-time narrative section when content exists', () => {
      render(
        <UnifiedNarrativeSection
          narrative={{
            what_we_found: [{ text: 'Ferritin is below the report range.' }],
            what_changed_over_time: [{ text: 'Ferritin improved since your previous report.' }],
            what_to_do_next: [{ text: 'Improve hydration' }],
          }}
          copy={copy}
          authoritativeActions={[{ title: 'Improve hydration' }]}
        />,
      )

      expect(screen.getByText('What changed over time')).toBeTruthy()
      expect(screen.getByText('Ferritin improved since your previous report.')).toBeTruthy()
      expect(screen.queryByText('Improve hydration')).toBeNull()
    })
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
