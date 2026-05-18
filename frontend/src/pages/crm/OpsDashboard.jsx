import { useCallback, useState } from 'react'
import { getPrograms } from '../../api/crmPrograms.js'
import { getClients } from '../../api/crmClients.js'
import { getPractitioners } from '../../api/crmPractitioners.js'
import { getFunnelOverview } from '../../api/crmOps.js'
import { getActiveClientActivity, getClaudeUsage, getUserActivityDetail } from '../../api/crmOpsData.js'
import { isNotImplemented } from '../../api/crmClient.js'
import { useCRMQuery } from '../../hooks/useCRMQuery.js'
import { useCRMRoleAccess } from '../../hooks/useCRMRoleAccess.js'
import CRMLayout from '../../features/crm/components/CRMLayout.jsx'
import CRMPageHeader from '../../features/crm/components/CRMPageHeader.jsx'
import CRMStatCard from '../../features/crm/components/CRMStatCard.jsx'
import CRMErrorState from '../../features/crm/components/CRMErrorState.jsx'

const DROPOFF_QUALITY_PRESETS = [
  { id: 'low', label: 'Low', minReached: 1 },
  { id: 'medium', label: 'Medium', minReached: 5 },
  { id: 'high', label: 'High', minReached: 10 },
]

export default function OpsDashboard() {
  const { canAccessOps } = useCRMRoleAccess()
  const [funnelDays, setFunnelDays] = useState(30)
  const [dropoffSortBy, setDropoffSortBy] = useState('count')
  const [dropoffMinReached, setDropoffMinReached] = useState(5)
  const [dropoffLimit] = useState(10)
  const [activityDays] = useState(30)
  const [detailDays] = useState(90)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false)
  const funnelWindowOptions = [7, 14, 30, 90]
  const dropoffMinReachedOptions = [1, 3, 5, 10]

  const programsQuery = useCallback(() => getPrograms({ limit: 100, offset: 0 }), [])
  const clientsQuery = useCallback(() => getClients({ limit: 100, offset: 0 }), [])
  const practitionersQuery = useCallback(() => getPractitioners(), [])
  const apiMinDropoffReached = dropoffSortBy === 'rate' ? dropoffMinReached : 1
  const funnelQuery = useCallback(
    () => getFunnelOverview({
      days: funnelDays,
      minDropoffReached: apiMinDropoffReached,
      dropoffSort: dropoffSortBy,
      dropoffLimit,
    }),
    [funnelDays, apiMinDropoffReached, dropoffSortBy, dropoffLimit],
  )
  const claudeUsageQuery = useCallback(() => getClaudeUsage({ days: activityDays }), [activityDays])
  const clientActivityQuery = useCallback(() => getActiveClientActivity({ days: activityDays, limit: 200 }), [activityDays])
  const selectedUserActivityQuery = useCallback(() => {
    if (!selectedUserId) return null
    return getUserActivityDetail(selectedUserId, { days: detailDays })
  }, [selectedUserId, detailDays])

  const programs = useCRMQuery(programsQuery, [programsQuery], { enabled: canAccessOps })
  const clients = useCRMQuery(clientsQuery, [clientsQuery], { enabled: canAccessOps })
  const practitioners = useCRMQuery(practitionersQuery, [practitionersQuery], { enabled: canAccessOps })
  const funnel = useCRMQuery(funnelQuery, [funnelQuery, funnelDays, apiMinDropoffReached, dropoffSortBy, dropoffLimit], { enabled: canAccessOps })
  const claudeUsage = useCRMQuery(claudeUsageQuery, [claudeUsageQuery], { enabled: canAccessOps })
  const clientActivity = useCRMQuery(clientActivityQuery, [clientActivityQuery], { enabled: canAccessOps })
  const selectedUserActivity = useCRMQuery(selectedUserActivityQuery, [selectedUserActivityQuery], { enabled: canAccessOps && isActivityModalOpen && Boolean(selectedUserId), initialData: null })

  if (!canAccessOps) {
    return (
      <CRMLayout title="Ops Dashboard">
        <CRMErrorState title="Access denied" error={new Error('Only super_admin can access /ops')} />
      </CRMLayout>
    )
  }

  const criticalError = clients.error || programs.error
  const practitionerNotAvailable = isNotImplemented(practitioners.error)
  const funnelAvailable = !isNotImplemented(funnel.error) && !!funnel.data
  const activeWindowDays = Number(funnel.data?.window_days || funnelDays)
  const activeMinDropoffReached = Number(funnel.data?.min_dropoff_reached || apiMinDropoffReached)
  const activeDropoffSort = String(funnel.data?.dropoff_sort || dropoffSortBy)
  const activeDropoffLimit = Number(funnel.data?.dropoff_limit || dropoffLimit)
  const activeQualityPreset = DROPOFF_QUALITY_PRESETS.find((preset) => preset.minReached === dropoffMinReached) || null
  const funnelCounts = funnel.data?.counts || {}
  const funnelRates = funnel.data?.rates || {}
  const funnelLag = funnel.data?.lag_days || {}
  const dailySignups = Array.isArray(funnel.data?.daily_signups) ? funnel.data.daily_signups : []
  const maxDailySignups = dailySignups.reduce((max, item) => Math.max(max, Number(item?.count || 0)), 0) || 1
  const questionnaire = funnel.data?.questionnaire || {}
  const questionnaireDropoff = Array.isArray(questionnaire.dropoff_by_question) ? questionnaire.dropoff_by_question : []
  const dropoffConfidence = questionnaire.data_confidence || {}
  const dropoffConfidenceLevel = String(dropoffConfidence.level || 'unknown').toLowerCase()
  const dropoffConfidenceNotes = Array.isArray(dropoffConfidence.notes) ? dropoffConfidence.notes : []
  const dropoffSortExplainer = String(questionnaire.dropoff_sort_explainer || '')
  const confidenceDaily = Array.isArray(questionnaire.confidence_daily) ? questionnaire.confidence_daily : []
  const confidenceRollup = questionnaire.confidence_rollup || { avg_sample_size: 0, dominant_level: 'unknown', low_days_share_pct: 100, total_days: 0 }
  const dropoffConfidenceTheme = {
    low: {
      border: '1px solid rgba(239,68,68,0.45)',
      background: 'rgba(239,68,68,0.12)',
      color: '#fecaca',
      badgeBg: 'rgba(239,68,68,0.2)',
      badgeBorder: '1px solid rgba(239,68,68,0.55)',
    },
    medium: {
      border: '1px solid rgba(245,158,11,0.45)',
      background: 'rgba(245,158,11,0.12)',
      color: '#fde68a',
      badgeBg: 'rgba(245,158,11,0.2)',
      badgeBorder: '1px solid rgba(245,158,11,0.55)',
    },
    high: {
      border: '1px solid rgba(34,197,94,0.45)',
      background: 'rgba(34,197,94,0.12)',
      color: '#bbf7d0',
      badgeBg: 'rgba(34,197,94,0.2)',
      badgeBorder: '1px solid rgba(34,197,94,0.55)',
    },
    unknown: {
      border: '1px solid rgba(148,163,184,0.45)',
      background: 'rgba(148,163,184,0.12)',
      color: '#e2e8f0',
      badgeBg: 'rgba(148,163,184,0.2)',
      badgeBorder: '1px solid rgba(148,163,184,0.55)',
    },
  }[dropoffConfidenceLevel] || {
    border: '1px solid rgba(148,163,184,0.45)',
    background: 'rgba(148,163,184,0.12)',
    color: '#e2e8f0',
    badgeBg: 'rgba(148,163,184,0.2)',
    badgeBorder: '1px solid rgba(148,163,184,0.55)',
  }
  const isLowDropoffConfidence = dropoffConfidenceLevel === 'low'
  const questionnaireDaily = Array.isArray(questionnaire.daily_cohorts) ? questionnaire.daily_cohorts : []
  const maxDropoffReached = questionnaireDropoff.reduce((max, item) => Math.max(max, Number(item?.sessions_reached || 0)), 0) || 1
  const maxQuestionnaireDailyStarted = questionnaireDaily.reduce((max, item) => Math.max(max, Number(item?.started || 0)), 0) || 1
  const trendLimit = Math.min(Math.max(activeWindowDays, 1), 30)
  const claudeTotals = claudeUsage.data?.totals || {}
  const claudeByTask = Array.isArray(claudeUsage.data?.by_task) ? claudeUsage.data.by_task : []
  const activitySummary = clientActivity.data?.summary || {}
  const activityItems = Array.isArray(clientActivity.data?.items) ? clientActivity.data.items : []
  const selectedUser = selectedUserActivity.data?.user || null
  const selectedSummary = selectedUserActivity.data?.summary || {}
  const selectedLlmUsage = selectedUserActivity.data?.llm_usage || {}
  const selectedUploads = Array.isArray(selectedUserActivity.data?.uploads) ? selectedUserActivity.data.uploads : []
  const selectedCheckins = Array.isArray(selectedUserActivity.data?.checkins) ? selectedUserActivity.data.checkins : []
  const selectedInsights = Array.isArray(selectedUserActivity.data?.insights) ? selectedUserActivity.data.insights : []
  const selectedNotifications = Array.isArray(selectedUserActivity.data?.notifications) ? selectedUserActivity.data.notifications : []
  const selectedTimeline = Array.isArray(selectedUserActivity.data?.timeline) ? selectedUserActivity.data.timeline : []

  const formatNumber = (value) => Number(value || 0).toLocaleString('en-US')
  const openActivityModal = (userId) => {
    setSelectedUserId(userId)
    setIsActivityModalOpen(true)
  }
  const closeActivityModal = () => {
    setIsActivityModalOpen(false)
    setSelectedUserId(null)
  }

  const handleExportSnapshot = useCallback(() => {
    if (!funnel.data) return

    const payload = {
      exported_at: new Date().toISOString(),
      window_days: activeWindowDays,
      ui_state: {
        selected_window_days: funnelDays,
        dropoff_sort_by: dropoffSortBy,
        dropoff_min_sessions_reached: dropoffMinReached,
        api_min_dropoff_reached: activeMinDropoffReached,
        dropoff_quality_preset: activeQualityPreset?.id || 'custom',
        dropoff_sort_applied: activeDropoffSort,
        dropoff_limit_applied: activeDropoffLimit,
        trend_limit_days: trendLimit,
      },
      funnel: funnel.data,
    }
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStamp = new Date().toISOString().slice(0, 10)
    link.href = href
    link.download = `funnel-snapshot-${activeWindowDays}d-${dateStamp}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(href)
  }, [funnel.data, activeWindowDays, funnelDays, dropoffSortBy, dropoffMinReached, activeMinDropoffReached, activeDropoffSort, activeDropoffLimit, trendLimit])

  return (
    <CRMLayout title="Ops Dashboard">
      <CRMPageHeader title="Ops Dashboard" subtitle="Stage 6 operational shell backed by live CRM APIs" />

      {criticalError ? (
        <CRMErrorState error={criticalError} onRetry={() => { clients.refetch(); programs.refetch() }} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          <CRMStatCard label="Clients" value={clients.data?.total ?? '-'} hint="From GET /crm/clients" tone="#1d9e75" />
          <CRMStatCard label="Programs" value={programs.data?.total ?? '-'} hint="From GET /crm/programs" tone="#0ea5e9" />
          <CRMStatCard
            label="Practitioners"
            value={practitionerNotAvailable ? 'n/a' : (Array.isArray(practitioners.data?.items) ? practitioners.data.items.length : Array.isArray(practitioners.data) ? practitioners.data.length : '-')}
            hint={practitionerNotAvailable ? 'List endpoint pending in backend' : 'From GET /crm/practitioners'}
            tone="#f59e0b"
          />
        </div>
      )}

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <CRMPageHeader title="Claude API Spend" subtitle={`Token usage in last ${activityDays} days`} />
        {claudeUsage.error ? (
          <CRMErrorState error={claudeUsage.error} onRetry={() => claudeUsage.refetch()} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <CRMStatCard label="LLM requests" value={formatNumber(claudeTotals.requests)} hint="All tracked Claude calls" tone="#22c55e" />
              <CRMStatCard label="Prompt tokens" value={formatNumber(claudeTotals.prompt_tokens)} hint="Input tokens" tone="#0ea5e9" />
              <CRMStatCard label="Completion tokens" value={formatNumber(claudeTotals.completion_tokens)} hint="Output tokens" tone="#f59e0b" />
              <CRMStatCard label="Total tokens" value={formatNumber(claudeTotals.total_tokens)} hint={claudeUsage.data?.tracked ? 'Tracked from llm_usage_events' : 'Tracking disabled'} tone="#e11d48" />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12 }}>
              <h4 style={{ margin: '0 0 8px', color: '#fff' }}>Usage by task</h4>
              {claudeByTask.length === 0 ? (
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                  {claudeUsage.data?.note || 'No tracked Claude usage in selected period.'}
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {claudeByTask.slice(0, 8).map((row) => (
                    <div key={row.task_name} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 13 }}>{row.task_name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'right' }}>{formatNumber(row.requests)} req</span>
                      <span style={{ color: '#fde68a', fontSize: 12, textAlign: 'right' }}>{formatNumber(row.total_tokens)} tokens</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <CRMPageHeader title="Client Activity" subtitle={`Active behavior and engagement in last ${activityDays} days`} />
        {clientActivity.error ? (
          <CRMErrorState error={clientActivity.error} onRetry={() => clientActivity.refetch()} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <CRMStatCard label="Tracked users" value={formatNumber(activitySummary.users)} hint="End users in sampled segment" tone="#3b82f6" />
              <CRMStatCard label="Active users" value={formatNumber(activitySummary.active_users)} hint="Users with activity score > 0" tone="#10b981" />
              <CRMStatCard label="Uploads + check-ins" value={formatNumber((activitySummary.uploads || 0) + (activitySummary.checkins || 0))} hint="Core health interactions" tone="#f59e0b" />
              <CRMStatCard label="User Claude tokens" value={formatNumber(activitySummary.llm_total_tokens)} hint={clientActivity.data?.llm_tracked ? 'Attributed to users' : 'Token tracking migration pending'} tone="#e11d48" />
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12 }}>
              <h4 style={{ margin: '0 0 8px', color: '#fff' }}>Users overview</h4>
              {activityItems.length === 0 ? (
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>No user activity data available.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {activityItems.slice(0, 20).map((item) => (
                    <div key={item.user_id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 90px 90px 130px 110px', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.full_name}</p>
                        <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.email || 'no-email'}</p>
                      </div>
                      <span style={{ color: '#93c5fd', fontSize: 12, textAlign: 'right' }}>{formatNumber(item.metrics?.uploads)}</span>
                      <span style={{ color: '#86efac', fontSize: 12, textAlign: 'right' }}>{formatNumber(item.metrics?.checkins)}</span>
                      <span style={{ color: '#fde68a', fontSize: 12, textAlign: 'right' }}>{formatNumber(item.metrics?.llm_total_tokens)} tok</span>
                      <button
                        type="button"
                        onClick={() => openActivityModal(item.user_id)}
                        style={{
                          borderRadius: 8,
                          border: '1px solid rgba(59,130,246,0.55)',
                          background: 'rgba(59,130,246,0.18)',
                          color: '#dbeafe',
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '6px 8px',
                          cursor: 'pointer',
                        }}
                      >
                        Open activity
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <CRMPageHeader
          title={`Funnel (${activeWindowDays}d)`}
          subtitle="B2C conversion milestones from signup to paid"
          actions={[
            ...funnelWindowOptions.map((optionDays) => {
              const active = optionDays === funnelDays
              return (
                <button
                  key={optionDays}
                  type="button"
                  onClick={() => setFunnelDays(optionDays)}
                  style={{
                    cursor: active ? 'default' : 'pointer',
                    borderRadius: 10,
                    border: active ? '1px solid rgba(16,185,129,0.8)' : '1px solid rgba(255,255,255,0.18)',
                    background: active ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.03)',
                    color: active ? '#d1fae5' : 'rgba(255,255,255,0.85)',
                    fontWeight: active ? 700 : 500,
                    fontSize: 12,
                    padding: '6px 10px',
                  }}
                  disabled={active || funnel.loading}
                >
                  {optionDays}d
                </button>
              )
            }),
            <button
              key="export-snapshot"
              type="button"
              onClick={handleExportSnapshot}
              style={{
                cursor: funnel.data ? 'pointer' : 'not-allowed',
                borderRadius: 10,
                border: '1px solid rgba(56,189,248,0.55)',
                background: 'rgba(14,165,233,0.14)',
                color: '#e0f2fe',
                fontWeight: 600,
                fontSize: 12,
                padding: '6px 10px',
              }}
              disabled={!funnel.data || funnel.loading}
            >
              Export JSON
            </button>,
          ]}
        />
        {funnel.error && !funnelAvailable ? (
          <CRMErrorState error={funnel.error} onRetry={() => funnel.refetch()} />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <CRMStatCard label="Signups" value={funnelCounts.signup ?? '-'} hint={`end_user created in last ${activeWindowDays} days`} tone="#14b8a6" />
              <CRMStatCard label="Onboarding Completed" value={funnelCounts.onboarding_completed ?? '-'} hint={`${funnelRates.signup_to_onboarding_pct ?? 0}% from signups`} tone="#22c55e" />
              <CRMStatCard label="First Upload" value={funnelCounts.first_upload_completed ?? '-'} hint={`${funnelRates.signup_to_first_upload_pct ?? 0}% from signups`} tone="#3b82f6" />
              <CRMStatCard label="Paywall Seen" value={funnelCounts.paywall_seen ?? '-'} hint={`${funnelRates.paywall_to_paid_pct ?? 0}% to paid`} tone="#f59e0b" />
              <CRMStatCard label="Paid End Users" value={funnelCounts.paid_total_end_users ?? '-'} hint={`${funnelRates.signup_to_paid_pct ?? 0}% from signups`} tone="#a855f7" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <CRMStatCard label="Avg days to onboarding" value={funnelLag.signup_to_onboarding_avg ?? 0} hint="Lower is better" tone="#10b981" />
              <CRMStatCard label="Avg days to first upload" value={funnelLag.signup_to_first_upload_avg ?? 0} hint="Time-to-value" tone="#0ea5e9" />
              <CRMStatCard label="Avg days to paywall" value={funnelLag.signup_to_paywall_avg ?? 0} hint="Monetization delay" tone="#f97316" />
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12 }}>
              <h4 style={{ margin: '0 0 10px', color: '#fff' }}>Daily signups</h4>
              {dailySignups.length === 0 ? (
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>No signup activity in selected period.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {dailySignups.slice(-trendLimit).map((row) => {
                    const count = Number(row?.count || 0)
                    const widthPct = Math.max(4, Math.round((count / maxDailySignups) * 100))
                    return (
                      <div key={row.date} style={{ display: 'grid', gridTemplateColumns: '84px 1fr 28px', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{row.date?.slice(5) || '-'}</span>
                        <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 999 }}>
                          <div style={{ width: `${widthPct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #14b8a6, #22c55e)' }} />
                        </div>
                        <span style={{ color: '#fff', fontSize: 12, textAlign: 'right' }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, display: 'grid', gap: 12 }}>
              <h4 style={{ margin: 0, color: '#fff' }}>Questionnaire analytics</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                <CRMStatCard
                  label="Started sessions"
                  value={questionnaire.started_sessions ?? 0}
                  hint="In selected period"
                  tone="#06b6d4"
                />
                <CRMStatCard
                  label="Completed sessions"
                  value={questionnaire.completed_sessions ?? 0}
                  hint={`${questionnaire.completion_rate_pct ?? 0}% completion`}
                  tone="#22c55e"
                />
                <CRMStatCard
                  label="Median time to complete"
                  value={questionnaire.median_minutes_to_complete ?? 0}
                  hint="Minutes"
                  tone="#f59e0b"
                />
                <CRMStatCard
                  label="Incomplete with no answers"
                  value={questionnaire.incomplete_no_answers ?? 0}
                  hint="Session friction at entry"
                  tone="#ef4444"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <h5 style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>Drop-off by question</h5>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setDropoffSortBy('count')}
                      style={{
                        cursor: dropoffSortBy === 'count' ? 'default' : 'pointer',
                        borderRadius: 8,
                        border: dropoffSortBy === 'count' ? '1px solid rgba(250,204,21,0.85)' : '1px solid rgba(255,255,255,0.18)',
                        background: dropoffSortBy === 'count' ? 'rgba(250,204,21,0.16)' : 'rgba(255,255,255,0.03)',
                        color: '#fef9c3',
                        fontSize: 11,
                        padding: '4px 8px',
                      }}
                      disabled={dropoffSortBy === 'count'}
                    >
                      Top by count
                    </button>
                    <button
                      type="button"
                      onClick={() => setDropoffSortBy('rate')}
                      style={{
                        cursor: dropoffSortBy === 'rate' ? 'default' : 'pointer',
                        borderRadius: 8,
                        border: dropoffSortBy === 'rate' ? '1px solid rgba(16,185,129,0.85)' : '1px solid rgba(255,255,255,0.18)',
                        background: dropoffSortBy === 'rate' ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.03)',
                        color: '#d1fae5',
                        fontSize: 11,
                        padding: '4px 8px',
                      }}
                      disabled={dropoffSortBy === 'rate'}
                    >
                      Top by rate
                    </button>
                    {dropoffSortBy === 'rate' ? (
                      <>
                        {DROPOFF_QUALITY_PRESETS.map((preset) => {
                          const active = dropoffMinReached === preset.minReached
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setDropoffMinReached(preset.minReached)}
                              style={{
                                cursor: active ? 'default' : 'pointer',
                                borderRadius: 8,
                                border: active ? '1px solid rgba(56,189,248,0.85)' : '1px solid rgba(255,255,255,0.18)',
                                background: active ? 'rgba(14,165,233,0.16)' : 'rgba(255,255,255,0.03)',
                                color: active ? '#e0f2fe' : 'rgba(255,255,255,0.8)',
                                fontSize: 11,
                                padding: '4px 8px',
                              }}
                              disabled={active}
                            >
                              {preset.label}
                            </button>
                          )
                        })}
                        <select
                          value={dropoffMinReached}
                          onChange={(event) => setDropoffMinReached(Number(event.target.value))}
                          style={{
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#fff',
                            fontSize: 11,
                            padding: '4px 8px',
                          }}
                          aria-label="Minimum sessions reached threshold"
                        >
                          {dropoffMinReachedOptions.map((option) => (
                            <option key={option} value={option}>{`Reached >= ${option}`}</option>
                          ))}
                        </select>
                      </>
                    ) : null}
                  </div>
                </div>
                {questionnaireDropoff.length === 0 ? (
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                    {dropoffSortBy === 'rate'
                      ? `No questionnaire drop-off rows match reached >= ${activeMinDropoffReached}.`
                      : 'No questionnaire drop-off data yet.'}
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {dropoffSortBy === 'rate' ? (
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                        {`Quality guard: sessions reached >= ${activeMinDropoffReached}${activeQualityPreset ? ` (${activeQualityPreset.label})` : ''} · Top ${activeDropoffLimit} by ${activeDropoffSort}`}
                      </p>
                    ) : null}
                    <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 8, background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          color: dropoffConfidenceTheme.color,
                          border: dropoffConfidenceTheme.badgeBorder,
                          background: dropoffConfidenceTheme.badgeBg,
                          borderRadius: 999,
                          padding: '2px 8px',
                        }}>
                          {dropoffConfidenceLevel}
                        </span>
                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>
                          {`Data confidence · sample ${Number(dropoffConfidence.sample_size || 0)} · rows ${Number(dropoffConfidence.dropoff_rows_returned || 0)}/${Number(dropoffConfidence.dropoff_rows_available || 0)}`}
                        </p>
                      </div>
                      {dropoffSortExplainer ? (
                        <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{dropoffSortExplainer}</p>
                      ) : null}
                      {dropoffConfidenceNotes.length > 0 ? (
                        <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                          {dropoffConfidenceNotes.join(' ')}
                        </p>
                      ) : null}
                    </div>
                    {isLowDropoffConfidence ? (
                      <div style={{ border: dropoffConfidenceTheme.border, background: dropoffConfidenceTheme.background, borderRadius: 10, padding: 8 }}>
                        <p style={{ margin: 0, color: dropoffConfidenceTheme.color, fontSize: 12, fontWeight: 600 }}>
                          Low confidence warning: treat rank deltas as directional until sample size grows.
                        </p>
                      </div>
                    ) : null}
                    {questionnaireDropoff.map((row) => {
                      const reached = Number(row?.sessions_reached || 0)
                      const widthPct = Math.max(4, Math.round((reached / maxDropoffReached) * 100))
                      return (
                        <div key={`${row.question_order}-${row.question_id}`} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 180px', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{`Q${row.question_order}`}</span>
                          <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 999 }}>
                            <div style={{ width: `${widthPct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #38bdf8, #34d399)' }} />
                          </div>
                          <span style={{ color: '#fff', fontSize: 12, textAlign: 'right' }}>
                            {`${row.question_id} · drop ${row.dropoff_count} (${row.dropoff_rate_pct}%)`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <h5 style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>Daily questionnaire cohorts</h5>
                {questionnaireDaily.length === 0 ? (
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>No daily questionnaire trend yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {questionnaireDaily.slice(-trendLimit).map((row) => {
                      const started = Number(row?.started || 0)
                      const completed = Number(row?.completed || 0)
                      const startedWidthPct = Math.max(4, Math.round((started / maxQuestionnaireDailyStarted) * 100))
                      const completedWidthPct = Math.max(0, Math.round((completed / maxQuestionnaireDailyStarted) * 100))

                      return (
                        <div key={row.date} style={{ display: 'grid', gridTemplateColumns: '84px 1fr 110px', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{row.date?.slice(5) || '-'}</span>
                          <div style={{ position: 'relative', height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 999 }}>
                            <div style={{ width: `${startedWidthPct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #64748b, #94a3b8)' }} />
                            <div style={{ position: 'absolute', top: 0, left: 0, width: `${completedWidthPct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #22c55e, #10b981)' }} />
                          </div>
                          <span style={{ color: '#fff', fontSize: 12, textAlign: 'right' }}>{`${completed}/${started} · ${row.completion_rate_pct}%`}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Rollup confidence summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
                {[{
                  label: 'Avg daily sample',
                  value: confidenceRollup.avg_sample_size,
                }, {
                  label: 'Dominant level',
                  value: String(confidenceRollup.dominant_level || 'unknown').toUpperCase(),
                }, {
                  label: 'Low-conf days',
                  value: `${confidenceRollup.low_days_share_pct}%`,
                }].map(({ label, value }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 2 }}>{label}</div>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div>
                <h5 style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>Confidence trend</h5>
                {confidenceDaily.length === 0 ? (
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>No confidence trend yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {confidenceDaily.slice(-trendLimit).map((row) => {
                      const level = String(row?.level || 'unknown').toLowerCase()
                      const sample = Number(row?.sample_size || 0)
                      const levelStyle = level === 'high'
                        ? { bg: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.55)', color: '#bbf7d0' }
                        : level === 'medium'
                          ? { bg: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.55)', color: '#fde68a' }
                          : level === 'low'
                            ? { bg: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.55)', color: '#fecaca' }
                            : { bg: 'rgba(148,163,184,0.2)', border: '1px solid rgba(148,163,184,0.55)', color: '#e2e8f0' }

                      return (
                        <div key={row.date} style={{ display: 'grid', gridTemplateColumns: '84px 120px 1fr', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{row.date?.slice(5) || '-'}</span>
                          <span style={{
                            display: 'inline-flex',
                            justifyContent: 'center',
                            borderRadius: 999,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                            background: levelStyle.bg,
                            border: levelStyle.border,
                            color: levelStyle.color,
                          }}>
                            {level}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{`sample: ${sample}`}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isActivityModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(2,6,23,0.82)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
          onClick={closeActivityModal}
        >
          <div
            style={{
              width: 'min(1100px, 96vw)',
              maxHeight: '92vh',
              overflowY: 'auto',
              borderRadius: 14,
              border: '1px solid rgba(148,163,184,0.38)',
              background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))',
              padding: 16,
              boxShadow: '0 24px 60px rgba(2,6,23,0.55)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff' }}>Client activity profile</h3>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                  {selectedUser ? `${selectedUser.full_name} · ${selectedUser.email}` : 'Loading user profile...'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeActivityModal}
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.24)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 10px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>

            {selectedUserActivity.loading ? (
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Loading user activity details...</p>
            ) : selectedUserActivity.error ? (
              <CRMErrorState error={selectedUserActivity.error} onRetry={() => selectedUserActivity.refetch()} />
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                  <CRMStatCard label="Uploads" value={formatNumber(selectedSummary.uploads)} tone="#3b82f6" />
                  <CRMStatCard label="Check-ins" value={formatNumber(selectedSummary.checkins)} tone="#10b981" />
                  <CRMStatCard label="Insights" value={formatNumber(selectedSummary.insights)} tone="#f59e0b" />
                  <CRMStatCard label="Notifications" value={formatNumber(selectedSummary.notifications)} tone="#a855f7" />
                  <CRMStatCard label="Timeline events" value={formatNumber(selectedSummary.timeline_events)} tone="#14b8a6" />
                  <CRMStatCard label="Claude tokens" value={formatNumber(selectedLlmUsage.total_tokens)} hint={selectedLlmUsage.tracked ? 'Tracked by user' : 'Tracking unavailable'} tone="#e11d48" />
                </div>

                <div style={{ display: 'grid', gap: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10 }}>
                  <h4 style={{ margin: 0, color: '#fff' }}>Recent labs</h4>
                  {selectedUploads.length === 0 ? <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>No uploads in selected window.</p> : selectedUploads.slice(0, 10).map((item) => (
                    <p key={item.id} style={{ margin: 0, color: 'rgba(255,255,255,0.82)', fontSize: 12 }}>{`${item.created_at?.slice(0, 10) || '-'} · ${item.lab_name || 'Lab'} · ${item.status || 'n/a'}`}</p>
                  ))}
                </div>

                <div style={{ display: 'grid', gap: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10 }}>
                  <h4 style={{ margin: 0, color: '#fff' }}>Recent check-ins</h4>
                  {selectedCheckins.length === 0 ? <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>No check-ins in selected window.</p> : selectedCheckins.slice(0, 10).map((item) => (
                    <p key={item.id} style={{ margin: 0, color: 'rgba(255,255,255,0.82)', fontSize: 12 }}>{`${item.created_at?.slice(0, 10) || '-'} · adherence ${item.protocol_adherence ?? 'n/a'}% · energy ${item.energy_score ?? 'n/a'}/10`}</p>
                  ))}
                </div>

                <div style={{ display: 'grid', gap: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10 }}>
                  <h4 style={{ margin: 0, color: '#fff' }}>Insights and notifications</h4>
                  {selectedInsights.slice(0, 8).map((item) => (
                    <p key={item.id} style={{ margin: 0, color: 'rgba(255,255,255,0.82)', fontSize: 12 }}>{`${item.created_at?.slice(0, 10) || '-'} · ${item.insight_type || 'insight'} · ${item.title || 'Untitled insight'}`}</p>
                  ))}
                  {selectedNotifications.slice(0, 8).map((item) => (
                    <p key={item.id} style={{ margin: 0, color: 'rgba(191,219,254,0.95)', fontSize: 12 }}>{`${item.created_at?.slice(0, 10) || '-'} · ${item.channel || 'channel'} · ${item.subject || 'Notification'}`}</p>
                  ))}
                  {selectedInsights.length === 0 && selectedNotifications.length === 0 ? <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>No insights or notifications in selected window.</p> : null}
                </div>

                <div style={{ display: 'grid', gap: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10 }}>
                  <h4 style={{ margin: 0, color: '#fff' }}>Timeline events</h4>
                  {selectedTimeline.length === 0 ? <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>No timeline events in selected window.</p> : selectedTimeline.slice(0, 20).map((item) => (
                    <p key={item.id} style={{ margin: 0, color: 'rgba(255,255,255,0.82)', fontSize: 12 }}>{`${(item.occurred_at || '').slice(0, 16).replace('T', ' ') || '-'} · ${item.event_type || 'event'} · ${item.summary || ''}`}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 14 }}>
        <h3 style={{ margin: '0 0 8px', color: '#fff' }}>Lifecycle Signal</h3>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
          User to Questionnaire to Analysis to Program to Execution to Tracking to Adjustment
        </p>
      </div>
    </CRMLayout>
  )
}
