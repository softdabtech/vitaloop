import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import KnowledgeRulesAdminPanel, { askRequiredChangeNote } from './KnowledgeRulesAdminPanel.jsx'

if (!globalThis.window) {
  globalThis.window = {}
}

vi.mock('../../../hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { id: '11111111-1111-1111-1111-111111111111' } }),
}))

const useCRMQueryMock = vi.fn()
vi.mock('../../../hooks/useCRMQuery.js', () => ({
  useCRMQuery: (...args) => useCRMQueryMock(...args),
}))

vi.mock('../../../api/knowledgeAdmin.js', () => ({
  approveKnowledgeRule: vi.fn(),
  createDraftCopy: vi.fn(),
  deprecateKnowledgeRule: vi.fn(),
  getKnowledgeRecommendation: vi.fn(),
  getKnowledgeRule: vi.fn(),
  getKnowledgeRuleAudit: vi.fn(),
  listKnowledgeRecommendations: vi.fn(),
  listKnowledgeRules: vi.fn(),
  submitKnowledgeRuleReview: vi.fn(),
  updateKnowledgeRule: vi.fn(),
}))

function buildQueryResult(data) {
  return {
    data,
    error: null,
    loading: false,
    refetch: vi.fn(),
    setData: vi.fn(),
  }
}

describe('KnowledgeRulesAdminPanel', () => {
  beforeEach(() => {
    useCRMQueryMock.mockReset()
  })

  it('renders rules list and filters', () => {
    useCRMQueryMock
      .mockReturnValueOnce(buildQueryResult([
        {
          id: 'rule-1',
          key: 'rule_low_ferritin_fatigue',
          name: 'Low ferritin with fatigue',
          governance_status: 'active',
          active: true,
          version: 'v1',
          confidence: 0.72,
          severity: 'moderate',
          requires_doctor: false,
          source: 'clinical_guideline_placeholder',
          updated_at: '2026-06-01T12:00:00Z',
        },
      ]))
      .mockReturnValueOnce(buildQueryResult(null))
      .mockReturnValueOnce(buildQueryResult([]))
      .mockReturnValueOnce(buildQueryResult([]))
      .mockReturnValueOnce(buildQueryResult(null))

    const html = renderToStaticMarkup(<KnowledgeRulesAdminPanel />)
    expect(html).toContain('Search by key')
    expect(html).toContain('rule_low_ferritin_fatigue')
    expect(html).toContain('governance_status')
  })

  it('shows create draft copy action for active rule instead of edit', () => {
    useCRMQueryMock
      .mockReturnValueOnce(buildQueryResult([]))
      .mockReturnValueOnce(buildQueryResult({
        id: 'rule-1',
        key: 'rule_low_ferritin_fatigue',
        name: 'Low ferritin with fatigue',
        governance_status: 'active',
        active: true,
        version: 'v1',
        confidence: 0.72,
        severity: 'moderate',
        requires_doctor: false,
        source: 'clinical_guideline_placeholder',
        source_url: 'https://example.org/source',
        conditions: { all: [{ lab_marker: 'ferritin', operator: 'lt', value: 30 }] },
        outputs: { recommendation_keys: ['iron_followup_discussion'] },
        explanation_template: 'template',
      }))
      .mockReturnValueOnce(buildQueryResult([]))
      .mockReturnValueOnce(buildQueryResult([]))
      .mockReturnValueOnce(buildQueryResult(null))

    const html = renderToStaticMarkup(<KnowledgeRulesAdminPanel />)
    expect(html).toContain('Create draft copy')
    expect(html).not.toContain('>Edit<')
  })

  it('requires non-empty change_note in mutation dialog helper', () => {
    window.prompt = vi.fn().mockReturnValue('   ')
    window.alert = vi.fn().mockImplementation(() => {})

    const result = askRequiredChangeNote('Deprecate rule')

    expect(result).toBeNull()
    expect(window.prompt).toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalledWith('change_note is required')
  })
})
