import { useCallback, useState } from 'react'
import { getClients } from '../../api/crmClients.js'
import { getOpsMetrics, syncUsersToOps } from '../../api/crmOpsData.js'
import { useCRMQuery } from '../../hooks/useCRMQuery.js'
import { useCRMRoleAccess } from '../../hooks/useCRMRoleAccess.js'
import CRMLayout from '../../features/crm/components/CRMLayout.jsx'
import CRMPageHeader from '../../features/crm/components/CRMPageHeader.jsx'
import CRMErrorState from '../../features/crm/components/CRMErrorState.jsx'
import CRMTableState from '../../features/crm/components/CRMTableState.jsx'
import toast from 'react-hot-toast'

export default function Users() {
  const { canAccessOps } = useCRMRoleAccess()
  const [syncingUsers, setSyncingUsers] = useState(false)

  const clientsQuery = useCallback(() => getClients({ limit: 500, offset: 0 }), [])
  const metricsQuery = useCallback(() => getOpsMetrics(), [])

  const clients = useCRMQuery(clientsQuery, [clientsQuery], { enabled: canAccessOps })
  const metrics = useCRMQuery(metricsQuery, [metricsQuery], { enabled: canAccessOps })

  if (!canAccessOps) {
    return (
      <CRMLayout title="Users">
        <CRMErrorState title="Access denied" error={new Error('Only super_admin can access users')} />
      </CRMLayout>
    )
  }

  const handleSyncUsers = async () => {
    setSyncingUsers(true)
    try {
      const result = await syncUsersToOps()
      toast.success(`Sync started: ${result.clients_created} new clients created`)
      // Refresh data after sync
      setTimeout(() => {
        clients.refetch()
        metrics.refetch()
      }, 1000)
    } catch (err) {
      toast.error(err.message || 'Sync failed')
    } finally {
      setSyncingUsers(false)
    }
  }

  const clientsList = Array.isArray(clients.data?.items) ? clients.data.items : []
  const totalUsers = metrics.data?.users?.total ?? 0
  const orphaned = metrics.data?.users?.orphaned ?? 0

  return (
    <CRMLayout title="Users">
      <CRMPageHeader
        title="All Users"
        subtitle={`${totalUsers} registered users${orphaned > 0 ? ` (${orphaned} not synced)` : ''}`}
        actions={[
          <button
            key="sync"
            onClick={handleSyncUsers}
            disabled={syncingUsers}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid rgba(56,189,248,0.55)',
              background: syncingUsers ? 'rgba(156,163,175,0.2)' : 'rgba(14,165,233,0.14)',
              color: syncingUsers ? '#a3a3a3' : '#e0f2fe',
              fontSize: 13,
              fontWeight: 600,
              cursor: syncingUsers ? 'not-allowed' : 'pointer',
            }}
          >
            {syncingUsers ? 'Syncing...' : 'Sync Users'}
          </button>,
        ]}
      />

      {clients.error ? (
        <CRMErrorState error={clients.error} onRetry={() => clients.refetch()} />
      ) : clients.loading ? (
        <CRMTableState loading />
      ) : clientsList.length === 0 ? (
        <CRMTableState empty message="No users found. Try syncing users first." />
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>Display Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {clientsList.map((client, idx) => (
                <tr
                  key={client.id || idx}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: idx % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#e0f2fe' }}>
                    {client.email || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
                    {client.display_name || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12 }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      background:
                        client.onboarding_status === 'completed' ? 'rgba(34,197,94,0.2)' :
                          client.onboarding_status === 'in_progress' ? 'rgba(245,158,11,0.2)' :
                            'rgba(148,163,184,0.2)',
                      color:
                        client.onboarding_status === 'completed' ? '#bbf7d0' :
                          client.onboarding_status === 'in_progress' ? '#fde68a' :
                            '#cbd5e1',
                      fontSize: 11,
                      fontWeight: 500,
                    }}>
                      {client.onboarding_status || 'unknown'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    {client.created_at ? new Date(client.created_at).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats */}
      {metrics.data && (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>Total Registered</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{metrics.data?.users?.total ?? 0}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>In CRM</div>
            <div style={{ color: '#bbf7d0', fontSize: 24, fontWeight: 700 }}>{metrics.data?.users?.with_clients ?? 0}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>Orphaned</div>
            <div style={{ color: '#fca5a5', fontSize: 24, fontWeight: 700 }}>{metrics.data?.users?.orphaned ?? 0}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>Active Subscriptions</div>
            <div style={{ color: '#d8b4fe', fontSize: 24, fontWeight: 700 }}>{metrics.data?.subscriptions?.active ?? 0}</div>
          </div>
        </div>
      )}
    </CRMLayout>
  )
}
