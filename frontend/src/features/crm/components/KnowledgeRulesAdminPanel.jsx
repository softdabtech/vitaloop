import { useCallback, useMemo, useState } from 'react'
import CRMErrorState from './CRMErrorState.jsx'
import CRMPageHeader from './CRMPageHeader.jsx'
import { useCRMQuery } from '../../../hooks/useCRMQuery.js'
import { useAuth } from '../../../hooks/useAuth.js'
import {
  approveKnowledgeRule,
  createDraftCopy,
  deprecateKnowledgeRule,
  getKnowledgeRecommendation,
  getKnowledgeRule,
  getKnowledgeRuleAudit,
  listKnowledgeRecommendations,
  listKnowledgeRules,
  submitKnowledgeRuleReview,
  updateKnowledgeRule,
} from '../../../api/knowledgeAdmin.js'

function prettyJson(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

export function askRequiredChangeNote(actionLabel) {
  const value = window.prompt(`${actionLabel}: enter change_note`) || ''
  const note = value.trim()
  if (!note) {
    window.alert('change_note is required')
    return null
  }
  return note
}

export default function KnowledgeRulesAdminPanel() {
  const { user } = useAuth()
  const [selectedRuleId, setSelectedRuleId] = useState('')
  const [selectedRecommendationId, setSelectedRecommendationId] = useState('')
  const [filters, setFilters] = useState({
    governance_status: '',
    active: '',
    key: '',
    requires_doctor: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const ruleFilters = useMemo(() => ({
    governance_status: filters.governance_status || undefined,
    active: filters.active === '' ? undefined : filters.active === 'true',
    key: filters.key || undefined,
    requires_doctor: filters.requires_doctor === '' ? undefined : filters.requires_doctor === 'true',
  }), [filters])

  const rulesQueryFn = useCallback(() => listKnowledgeRules(ruleFilters), [ruleFilters])
  const rules = useCRMQuery(rulesQueryFn, [rulesQueryFn])

  const ruleDetailQueryFn = useCallback(() => {
    if (!selectedRuleId) return null
    return getKnowledgeRule(selectedRuleId)
  }, [selectedRuleId])
  const ruleDetail = useCRMQuery(ruleDetailQueryFn, [ruleDetailQueryFn], { enabled: Boolean(selectedRuleId), initialData: null })

  const ruleAuditQueryFn = useCallback(() => {
    if (!selectedRuleId) return null
    return getKnowledgeRuleAudit(selectedRuleId, 100)
  }, [selectedRuleId])
  const ruleAudit = useCRMQuery(ruleAuditQueryFn, [ruleAuditQueryFn], { enabled: Boolean(selectedRuleId), initialData: [] })

  const recommendationsQueryFn = useCallback(() => listKnowledgeRecommendations(), [])
  const recommendations = useCRMQuery(recommendationsQueryFn, [recommendationsQueryFn])

  const recommendationDetailQueryFn = useCallback(() => {
    if (!selectedRecommendationId) return null
    return getKnowledgeRecommendation(selectedRecommendationId)
  }, [selectedRecommendationId])
  const recommendationDetail = useCRMQuery(recommendationDetailQueryFn, [recommendationDetailQueryFn], {
    enabled: Boolean(selectedRecommendationId),
    initialData: null,
  })

  async function refreshRuleData(nextRuleId = selectedRuleId) {
    await Promise.all([
      rules.refetch(),
      nextRuleId ? getKnowledgeRule(nextRuleId).then((row) => ruleDetail.setData(row)).catch(() => {}) : Promise.resolve(),
      nextRuleId ? getKnowledgeRuleAudit(nextRuleId, 100).then((rows) => ruleAudit.setData(rows)).catch(() => {}) : Promise.resolve(),
    ])
  }

  async function withMutation(action) {
    if (!user?.id) {
      window.alert('Current admin user id is missing; re-login required')
      return
    }
    setIsSaving(true)
    try {
      await action()
    } catch (error) {
      window.alert(error?.message || 'Mutation failed')
    } finally {
      setIsSaving(false)
    }
  }

  async function onSubmitReview(rule) {
    const change_note = askRequiredChangeNote('Submit review')
    if (!change_note) return
    await withMutation(async () => {
      await submitKnowledgeRuleReview(rule.id, {
        last_modified_by: user.id,
        change_note,
      })
      await refreshRuleData(rule.id)
    })
  }

  async function onApprove(rule) {
    const change_note = askRequiredChangeNote('Approve rule')
    if (!change_note) return
    await withMutation(async () => {
      await approveKnowledgeRule(rule.id, {
        medical_reviewed_by: user.id,
        medical_reviewed_at: new Date().toISOString(),
        last_modified_by: user.id,
        change_note,
      })
      await refreshRuleData(rule.id)
    })
  }

  async function onDeprecate(rule) {
    const change_note = askRequiredChangeNote('Deprecate rule')
    if (!change_note) return
    await withMutation(async () => {
      await deprecateKnowledgeRule(rule.id, {
        last_modified_by: user.id,
        change_note,
      })
      await refreshRuleData(rule.id)
    })
  }

  async function onCreateDraftCopy(rule) {
    const change_note = askRequiredChangeNote('Create draft copy')
    if (!change_note) return
    await withMutation(async () => {
      const created = await createDraftCopy(rule.id, {
        last_modified_by: user.id,
        change_note,
      })
      setSelectedRuleId(created?.id || '')
      await refreshRuleData(created?.id || '')
    })
  }

  async function onEditRule(rule) {
    const change_note = askRequiredChangeNote('Edit rule')
    if (!change_note) return

    const defaultPayload = {
      name: rule.name,
      description: rule.description,
      confidence: rule.confidence,
      severity: rule.severity,
      requires_doctor: rule.requires_doctor,
      source: rule.source,
      source_url: rule.source_url,
      explanation_template: rule.explanation_template,
      conditions: rule.conditions,
      outputs: rule.outputs,
      last_modified_by: user.id,
      change_note,
    }
    const raw = window.prompt('Edit payload JSON for PATCH /knowledge/rules/{id}', prettyJson(defaultPayload))
    if (!raw) return

    await withMutation(async () => {
      const parsed = JSON.parse(raw)
      parsed.last_modified_by = user.id
      parsed.change_note = change_note
      await updateKnowledgeRule(rule.id, parsed)
      await refreshRuleData(rule.id)
    })
  }

  function renderRuleActions(rule) {
    const status = String(rule.governance_status || '').toLowerCase()

    if (status === 'draft') {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onEditRule(rule)} disabled={isSaving}>Edit</button>
          <button type="button" onClick={() => onSubmitReview(rule)} disabled={isSaving}>Submit review</button>
          <button type="button" onClick={() => onDeprecate(rule)} disabled={isSaving}>Deprecate</button>
        </div>
      )
    }

    if (status === 'reviewed') {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onApprove(rule)} disabled={isSaving}>Approve</button>
          <button type="button" onClick={() => onEditRule(rule)} disabled={isSaving}>Edit</button>
          <button type="button" onClick={() => onDeprecate(rule)} disabled={isSaving}>Deprecate</button>
        </div>
      )
    }

    if (status === 'active') {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onCreateDraftCopy(rule)} disabled={isSaving}>Create draft copy</button>
          <button type="button" onClick={() => onDeprecate(rule)} disabled={isSaving}>Deprecate</button>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onCreateDraftCopy(rule)} disabled={isSaving}>Create draft copy</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <CRMPageHeader title="Knowledge Rules Management" subtitle="Stage 19 operations layer: governance, versioning and audit" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <select value={filters.governance_status} onChange={(e) => setFilters((prev) => ({ ...prev, governance_status: e.target.value }))}>
          <option value="">All statuses</option>
          <option value="draft">draft</option>
          <option value="reviewed">reviewed</option>
          <option value="active">active</option>
          <option value="deprecated">deprecated</option>
        </select>

        <select value={filters.active} onChange={(e) => setFilters((prev) => ({ ...prev, active: e.target.value }))}>
          <option value="">Any active</option>
          <option value="true">active=true</option>
          <option value="false">active=false</option>
        </select>

        <select value={filters.requires_doctor} onChange={(e) => setFilters((prev) => ({ ...prev, requires_doctor: e.target.value }))}>
          <option value="">Any requires_doctor</option>
          <option value="true">requires_doctor=true</option>
          <option value="false">requires_doctor=false</option>
        </select>

        <input
          type="text"
          placeholder="Search by key"
          value={filters.key}
          onChange={(e) => setFilters((prev) => ({ ...prev, key: e.target.value }))}
        />
      </div>

      {rules.error ? <CRMErrorState error={rules.error} onRetry={() => rules.refetch()} /> : null}
      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: 'rgba(255,255,255,0.04)' }}>
              <th style={{ padding: 10 }}>key</th>
              <th style={{ padding: 10 }}>name</th>
              <th style={{ padding: 10 }}>governance_status</th>
              <th style={{ padding: 10 }}>active</th>
              <th style={{ padding: 10 }}>version</th>
              <th style={{ padding: 10 }}>confidence</th>
              <th style={{ padding: 10 }}>severity</th>
              <th style={{ padding: 10 }}>requires_doctor</th>
              <th style={{ padding: 10 }}>source</th>
              <th style={{ padding: 10 }}>updated_at</th>
            </tr>
          </thead>
          <tbody>
            {(rules.data || []).map((rule) => (
              <tr
                key={rule.id}
                onClick={() => setSelectedRuleId(rule.id)}
                style={{
                  cursor: 'pointer',
                  background: selectedRuleId === rule.id ? 'rgba(16,185,129,0.12)' : 'transparent',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <td style={{ padding: 10 }}>{rule.key}</td>
                <td style={{ padding: 10 }}>{rule.name}</td>
                <td style={{ padding: 10 }}>{rule.governance_status}</td>
                <td style={{ padding: 10 }}>{String(rule.active)}</td>
                <td style={{ padding: 10 }}>{rule.version || '-'}</td>
                <td style={{ padding: 10 }}>{rule.confidence}</td>
                <td style={{ padding: 10 }}>{rule.severity || '-'}</td>
                <td style={{ padding: 10 }}>{String(rule.requires_doctor)}</td>
                <td style={{ padding: 10 }}>{rule.source || '-'}</td>
                <td style={{ padding: 10 }}>{rule.updated_at || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ruleDetail.data ? (
        <div style={{ display: 'grid', gap: 10, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
          <CRMPageHeader
            title={`Rule detail: ${ruleDetail.data.key}`}
            subtitle={`status=${ruleDetail.data.governance_status} active=${String(ruleDetail.data.active)} version=${ruleDetail.data.version || '-'}`}
          />
          {renderRuleActions(ruleDetail.data)}

          <div style={{ display: 'grid', gap: 8 }}>
            <div><strong>source:</strong> {ruleDetail.data.source || '-'}</div>
            <div><strong>source_url:</strong> {ruleDetail.data.source_url || '-'}</div>
            <div><strong>review metadata:</strong> reviewed_by={ruleDetail.data.medical_reviewed_by || '-'}, reviewed_at={ruleDetail.data.medical_reviewed_at || '-'}</div>
            <div><strong>copied from:</strong> {ruleDetail.data.copied_from_rule_id || '-'} / {ruleDetail.data.copied_from_version || '-'}</div>
            <div><strong>change_note:</strong> {ruleDetail.data.change_note || '-'}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <h4>conditions JSON</h4>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto', background: 'rgba(0,0,0,0.25)', padding: 10, borderRadius: 8 }}>{prettyJson(ruleDetail.data.conditions)}</pre>
            </div>
            <div>
              <h4>outputs JSON</h4>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto', background: 'rgba(0,0,0,0.25)', padding: 10, borderRadius: 8 }}>{prettyJson(ruleDetail.data.outputs)}</pre>
            </div>
          </div>

          <div>
            <h4>explanation_template</h4>
            <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.25)', padding: 10, borderRadius: 8 }}>{ruleDetail.data.explanation_template}</pre>
          </div>

          <div>
            <h4>Audit history</h4>
            {ruleAudit.error ? <CRMErrorState error={ruleAudit.error} onRetry={() => ruleAudit.refetch()} /> : null}
            <div style={{ display: 'grid', gap: 8 }}>
              {(ruleAudit.data || []).map((event) => (
                <div key={event.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{event.timestamp} | {event.action} | user={event.user_id || '-'}</div>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{prettyJson(event.new_value)}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 }}>
        <CRMPageHeader title="Recommendations (read-only)" subtitle="Stage 19 scope: list + detail" />
        {recommendations.error ? <CRMErrorState error={recommendations.error} onRetry={() => recommendations.refetch()} /> : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ maxHeight: 260, overflow: 'auto', display: 'grid', gap: 8 }}>
            {(recommendations.data || []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedRecommendationId(item.id)}
                style={{
                  textAlign: 'left',
                  borderRadius: 8,
                  border: selectedRecommendationId === item.id ? '1px solid rgba(16,185,129,0.8)' : '1px solid rgba(255,255,255,0.1)',
                  background: selectedRecommendationId === item.id ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                  color: '#fff',
                  padding: 8,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700 }}>{item.key}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{item.title}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  category={item.category || '-'} | priority={item.priority || '-'} | requires_doctor={String(item.requires_doctor)}
                </div>
              </button>
            ))}
          </div>

          <div>
            {recommendationDetail.error ? <CRMErrorState error={recommendationDetail.error} onRetry={() => recommendationDetail.refetch()} /> : null}
            {recommendationDetail.data ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div><strong>key:</strong> {recommendationDetail.data.key}</div>
                <div><strong>title:</strong> {recommendationDetail.data.title}</div>
                <div><strong>source:</strong> {recommendationDetail.data.source || '-'}</div>
                <div><strong>source_url:</strong> {recommendationDetail.data.source_url || '-'}</div>
                <div><strong>body:</strong></div>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, background: 'rgba(0,0,0,0.25)', padding: 10, borderRadius: 8 }}>{recommendationDetail.data.body}</pre>
                <div><strong>metadata:</strong></div>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, background: 'rgba(0,0,0,0.25)', padding: 10, borderRadius: 8 }}>{prettyJson(recommendationDetail.data.metadata)}</pre>
              </div>
            ) : <div style={{ opacity: 0.8 }}>Select recommendation to view details.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
