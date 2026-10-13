import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import {
  ActionCard,
  buildProtocolActionCompletionPayload,
  completedProtocolActionIds,
  RetestObligationCard,
  selectProtocolRetestPlan,
  selectProtocolRows,
} from './ProtocolPage.jsx'
import { formatRetestDate, reliableClinicalDate, retestState, selectRetestObligations } from '../lib/retest.js'

afterEach(cleanup)

const copy = {
  basedOn: 'Based on',
  healthDomains: 'Health domains',
  expectedTimeline: 'Expected timeline',
  retestMarkers: 'Retest markers',
  technicalDetails: 'Analysis details',
  safetyNotes: 'Safety notes',
  effort: 'Effort',
  evidence: 'Evidence',
  outcome: 'Intended outcome',
  markComplete: 'Mark complete',
  completing: 'Saving...',
  completed: 'Completed',
  completionFailed: "We couldn't save this update. Try again.",
  retestNotDue: 'Not due yet',
  retestDueNow: 'Due now',
  retestOverdue: 'Overdue',
  retestPending: 'Pending',
  retestCompleted: 'Completed',
  retestWindow: (start, end) => `Retest window: ${start} – ${end}`,
  retestSource: 'Based on this report',
  retestCompletedBy: (date) => date ? `Completed by a later result on ${date}.` : 'Completed by a later result.',
  viewLaterResult: 'View later result',
}

const action = {
  action_id: 'v1:action-plan:hydration:0',
  title: 'Stay hydrated',
  body: 'Drink water throughout the day.',
  source: 'rule',
}

describe('ProtocolPage completion seam', () => {
  it('uses the action plan when it is the completable persisted source', () => {
    const protocol = [{ title: 'Legacy protocol item', body: 'Legacy body' }]
    const actionPlan = [{ ...action, title: 'Persisted action' }]
    const selected = selectProtocolRows({
      coreProtocol: [],
      storedProtocol: protocol,
      actionPlan,
    })

    expect(selected).toBe(actionPlan)
    render(<ActionCard item={selected[0]} copy={copy} isUk={false} reportVersionId="report-1" onComplete={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Persisted action' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeTruthy()
  })

  it('preserves legacy protocol rendering when no action identity exists', () => {
    const protocol = [{ title: 'Legacy protocol item', body: 'Legacy body' }]
    const selected = selectProtocolRows({
      coreProtocol: [],
      storedProtocol: protocol,
      actionPlan: [{ title: 'Legacy action plan item', body: 'Legacy body' }],
    })

    expect(selected).toBe(protocol)
    render(<ActionCard item={selected[0]} copy={copy} isUk={false} reportVersionId="report-1" onComplete={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Legacy protocol item' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mark complete' })).toBeNull()
  })

  it('shows completion control only when action identity and report version are present', () => {
    const onComplete = vi.fn()
    const { rerender } = render(
      <ActionCard item={action} copy={copy} isUk={false} reportVersionId="report-1" onComplete={onComplete} />,
    )
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeTruthy()

    rerender(<ActionCard item={{ ...action, action_id: undefined }} copy={copy} isUk={false} reportVersionId="report-1" onComplete={onComplete} />)
    expect(screen.queryByRole('button', { name: 'Mark complete' })).toBeNull()

    rerender(<ActionCard item={action} copy={copy} isUk={false} reportVersionId={null} onComplete={onComplete} />)
    expect(screen.queryByRole('button', { name: 'Mark complete' })).toBeNull()
  })

  it('calls completion handler with the action when clicked and blocks saving duplicates', () => {
    const onComplete = vi.fn()
    const { rerender } = render(
      <ActionCard item={action} copy={copy} isUk={false} reportVersionId="report-1" saving onComplete={onComplete} />,
    )
    const button = screen.getByRole('button', { name: 'Saving...' })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onComplete).not.toHaveBeenCalled()

    rerender(<ActionCard item={action} copy={copy} isUk={false} reportVersionId="report-1" onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
    expect(onComplete).toHaveBeenCalledWith(action)
  })

  it('shows completed state after successful completion', () => {
    render(<ActionCard item={action} copy={copy} isUk={false} reportVersionId="report-1" completed onComplete={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Completed' }).disabled).toBe(true)
  })

  it('shows a safe inline error and keeps the action retryable after a failed save', () => {
    const onComplete = vi.fn()
    render(
      <ActionCard
        item={action}
        copy={copy}
        isUk={false}
        reportVersionId="report-1"
        error={copy.completionFailed}
        onComplete={onComplete}
      />,
    )

    expect(screen.getByRole('alert').textContent).toBe(copy.completionFailed)
    expect(screen.queryByRole('button', { name: 'Completed' })).toBeNull()
    const button = screen.getByRole('button', { name: 'Mark complete' })
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(onComplete).toHaveBeenCalledWith(action)
    expect(screen.queryByText('raw backend error')).toBeNull()
  })

  it('clears an action error when retry succeeds without affecting another action', () => {
    const onComplete = vi.fn()
    const otherAction = { ...action, action_id: 'v1:action-plan:other:0', title: 'Other action' }
    const { rerender } = render(
      <>
        <ActionCard item={action} copy={copy} isUk={false} reportVersionId="report-1" error={copy.completionFailed} onComplete={onComplete} />
        <ActionCard item={otherAction} copy={copy} isUk={false} reportVersionId="report-1" error={copy.completionFailed} onComplete={onComplete} />
      </>,
    )

    expect(screen.getAllByRole('alert')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark complete' })[0])
    rerender(
      <>
        <ActionCard item={action} copy={copy} isUk={false} reportVersionId="report-1" completed onComplete={onComplete} />
        <ActionCard item={otherAction} copy={copy} isUk={false} reportVersionId="report-1" error={copy.completionFailed} onComplete={onComplete} />
      </>,
    )

    expect(screen.getByRole('button', { name: 'Completed' }).disabled).toBe(true)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('builds the backend completion payload', () => {
    expect(buildProtocolActionCompletionPayload(action, 'report-1')).toEqual({
      event_type: 'protocol_action',
      action_id: action.action_id,
      source_report_version_id: 'report-1',
      label: 'Stay hydrated',
      description: 'Drink water throughout the day.',
    })
  })

  it('restores only matching completed actions after reload', () => {
    const ids = completedProtocolActionIds([
      { source_report_version_id: 'report-1', related_recommendation_id: action.action_id },
      { source_report_version_id: 'report-1', related_recommendation_id: 'other-action' },
      { source_report_version_id: 'report-2', related_recommendation_id: action.action_id },
    ], 'report-1')
    expect(ids).toEqual(new Set([action.action_id, 'other-action']))
    expect(ids.has('unrelated-action')).toBe(false)
  })

  it('does not restore an action from an unrelated report', () => {
    expect(completedProtocolActionIds([
      { source_report_version_id: 'report-2', related_recommendation_id: action.action_id },
    ], 'report-1')).toEqual(new Set())
  })
})

describe('ProtocolPage retest obligations', () => {
  const baseEvent = {
    id: 'retest-1',
    action_type: 'retest',
    source_report_version_id: 'report-1',
    related_recommendation_id: 'Hemoglobin',
    fulfillment_status: 'pending',
    retest_window_start: '2026-10-10',
    retest_window_end: '2026-10-20',
    metadata: { retest_target: 'Hemoglobin', timing: '6-12 weeks' },
  }

  it('derives not due, due now, overdue, and completed states from persisted dates', () => {
    expect(retestState({ ...baseEvent, retest_window_start: '2026-11-01', retest_window_end: '2026-11-20' }, new Date('2026-10-13T12:00:00Z'))).toBe('pending_not_open')
    expect(retestState(baseEvent, new Date('2026-10-13T12:00:00Z'))).toBe('due_now')
    expect(retestState({ ...baseEvent, retest_window_end: '2026-10-12' }, new Date('2026-10-13T12:00:00Z'))).toBe('overdue')
    expect(retestState({ ...baseEvent, fulfillment_status: 'fulfilled' }, new Date('2026-10-13T12:00:00Z'))).toBe('fulfilled')
  })

  it('selects one persisted obligation per marker for the report', () => {
    expect(selectRetestObligations([
      baseEvent,
      { ...baseEvent, id: 'duplicate', source_report_version_id: 'report-1' },
      { ...baseEvent, id: 'other-report', source_report_version_id: 'report-2' },
    ], 'report-1')).toHaveLength(1)
  })

  it('renders exact windows and keeps timing as secondary context', () => {
    render(<RetestObligationCard item={baseEvent} copy={copy} isUk={false} today={new Date('2026-10-13T12:00:00Z')} />)
    expect(screen.getByText('Due now')).toBeTruthy()
    expect(screen.getByText('Retest window: Oct 10, 2026 – Oct 20, 2026')).toBeTruthy()
    expect(screen.getByText('6-12 weeks')).toBeTruthy()
  })

  it('renders fulfilled result links and never uses created_at as a clinical date', () => {
    const item = { ...baseEvent, fulfillment_status: 'fulfilled', fulfilled_by_upload_id: 'upload-2' }
    render(<RetestObligationCard item={item} resultDate={null} copy={copy} isUk={false} />)
    expect(screen.getByText('Completed by a later result.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View later result' }).getAttribute('href')).toBe('/results/upload-2')
    expect(reliableClinicalDate({
      created_at: '2026-10-13T08:00:00Z',
      metadata: { created_at: '2026-10-13T08:00:00Z' },
    })).toBeNull()
    expect(formatRetestDate('2026-10-20')).toBe('Oct 20, 2026')
  })

  it('uses report timing only when persisted obligations are unavailable', () => {
    const reportPlan = [{ marker: 'Ferritin', timing: '6-12 weeks' }]
    const persisted = [{ ...baseEvent, marker: 'Hemoglobin' }]
    expect(selectProtocolRetestPlan({
      interventionsAvailable: true,
      persistedRetestPlan: persisted,
      reportRetestPlan: reportPlan,
    })).toBe(persisted)
    expect(selectProtocolRetestPlan({
      interventionsAvailable: false,
      persistedRetestPlan: [],
      reportRetestPlan: reportPlan,
    })).toBe(reportPlan)
  })

  it('keeps the fulfilled card mobile-safe for long marker and link content', () => {
    const { container } = render(
      <RetestObligationCard
        item={{ ...baseEvent, marker: 'Very Long Clinical Marker Name', fulfillment_status: 'fulfilled', fulfilled_by_upload_id: 'upload-2' }}
        resultDate="2026-10-20"
        copy={copy}
        isUk={false}
      />,
    )
    expect(container.querySelector('a').className).toContain('max-w-full')
  })
})
