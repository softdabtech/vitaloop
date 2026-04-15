import { useCallback, useState } from 'react'
import { getAuditLogs } from '../../../api/crmQuestionnaires.js'
import { isNotImplemented } from '../../../api/crmClient.js'
import { useCRMQuery } from '../../../hooks/useCRMQuery.js'
import CRMPageHeader from '../components/CRMPageHeader.jsx'
import CRMTableState from '../components/CRMTableState.jsx'

export default function AuditLogPage() {
  const [filters, setFilters] = useState({ entityType: '', userId: '' })

  const queryFn = useCallback(() => getAuditLogs(filters), [filters.entityType, filters.userId])
  const { data, error, loading, refetch } = useCRMQuery(queryFn, [queryFn])

  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  const normalizedError = isNotImplemented(error)
    ? new Error('Audit endpoint is not implemented in current backend router. Screen is wired and ready once endpoint is added.')
    : error

  return (
    <div>
      <CRMPageHeader title="Activity / Audit" subtitle="Operational trail for CRM actions" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 12 }}>
        <input value={filters.entityType} onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value }))} placeholder="Filter by entity type" style={inputStyle} />
        <input value={filters.userId} onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))} placeholder="Filter by user id" style={inputStyle} />
        <button onClick={() => refetch()} style={buttonStyle}>Apply</button>
      </div>

      <CRMTableState
        loading={loading}
        error={normalizedError}
        onRetry={refetch}
        isEmpty={!items.length && !normalizedError}
        emptyTitle="No activity events"
        emptyDescription="No recent records for selected filters."
      >
        <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
                <th style={{ padding: 10, textAlign: 'left' }}>Created</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Action</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Entity</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Entity ID</th>
                <th style={{ padding: 10, textAlign: 'left' }}>User ID</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Changes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={`${item.id || idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: 10 }}>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                  <td style={{ padding: 10 }}>{item.action || '-'}</td>
                  <td style={{ padding: 10 }}>{item.entity_type || '-'}</td>
                  <td style={{ padding: 10 }}><code>{item.entity_id || '-'}</code></td>
                  <td style={{ padding: 10 }}><code>{item.user_id || '-'}</code></td>
                  <td style={{ padding: 10 }}>
                    <pre style={{ margin: 0, maxHeight: 120, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 8 }}>{JSON.stringify(item.changes || {}, null, 2)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CRMTableState>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,0.25)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8,
  padding: '8px 10px',
}

const buttonStyle = {
  border: 'none',
  background: '#1d9e75',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
}
