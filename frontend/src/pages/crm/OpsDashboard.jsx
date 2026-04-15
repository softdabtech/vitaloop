import { useCallback } from 'react'
import { getPrograms } from '../../api/crmPrograms.js'
import { getClients } from '../../api/crmClients.js'
import { getPractitioners } from '../../api/crmPractitioners.js'
import { isNotImplemented } from '../../api/crmClient.js'
import { useCRMQuery } from '../../hooks/useCRMQuery.js'
import { useCRMRoleAccess } from '../../hooks/useCRMRoleAccess.js'
import CRMLayout from '../../features/crm/components/CRMLayout.jsx'
import CRMPageHeader from '../../features/crm/components/CRMPageHeader.jsx'
import CRMStatCard from '../../features/crm/components/CRMStatCard.jsx'
import CRMErrorState from '../../features/crm/components/CRMErrorState.jsx'

export default function OpsDashboard() {
  const { canAccessOps } = useCRMRoleAccess()
  const programsQuery = useCallback(() => getPrograms({ limit: 100, offset: 0 }), [])
  const clientsQuery = useCallback(() => getClients({ limit: 100, offset: 0 }), [])
  const practitionersQuery = useCallback(() => getPractitioners(), [])

  const programs = useCRMQuery(programsQuery, [programsQuery], { enabled: canAccessOps })
  const clients = useCRMQuery(clientsQuery, [clientsQuery], { enabled: canAccessOps })
  const practitioners = useCRMQuery(practitionersQuery, [practitionersQuery], { enabled: canAccessOps })

  if (!canAccessOps) {
    return (
      <CRMLayout title="Ops Dashboard">
        <CRMErrorState title="Access denied" error={new Error('Only super_admin can access /ops')} />
      </CRMLayout>
    )
  }

  const criticalError = clients.error || programs.error
  const practitionerNotAvailable = isNotImplemented(practitioners.error)

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

      <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 14 }}>
        <h3 style={{ margin: '0 0 8px', color: '#fff' }}>Lifecycle Signal</h3>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
          User to Questionnaire to Analysis to Program to Execution to Tracking to Adjustment
        </p>
      </div>
    </CRMLayout>
  )
}
