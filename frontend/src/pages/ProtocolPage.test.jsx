import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import {
  ActionCard,
  buildProtocolActionCompletionPayload,
  completedProtocolActionIds,
  selectProtocolRows,
} from './ProtocolPage.jsx'

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
