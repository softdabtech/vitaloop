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
      <div className="mb-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <input value={filters.entityType} onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value }))} placeholder="Filter by entity type" className={inputClassName} />
        <input value={filters.userId} onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))} placeholder="Filter by user id" className={inputClassName} />
        <button onClick={() => refetch()} className="vtl-button-primary px-4 py-2 text-sm">Apply</button>
      </div>

      <CRMTableState
        loading={loading}
        error={normalizedError}
        onRetry={refetch}
        isEmpty={!items.length && !normalizedError}
        emptyTitle="No activity events"
        emptyDescription="No recent records for selected filters."
      >
        <div className="overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/40">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-slate-700/70 text-slate-400">
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Created</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Action</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Entity</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Entity ID</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">User ID</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Changes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={`${item.id || idx}`} className="border-b border-slate-800/80 text-sm text-slate-200">
                  <td className="p-3 text-slate-300">{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                  <td className="p-3">{item.action || '-'}</td>
                  <td className="p-3">{item.entity_type || '-'}</td>
                  <td className="p-3"><code className="text-slate-300">{item.entity_id || '-'}</code></td>
                  <td className="p-3"><code className="text-slate-300">{item.user_id || '-'}</code></td>
                  <td className="p-3">
                    <pre className="m-0 max-h-[120px] overflow-y-auto rounded-lg bg-slate-950/55 p-2 text-xs text-slate-200">{JSON.stringify(item.changes || {}, null, 2)}</pre>
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

const inputClassName = 'w-full rounded-xl border border-slate-600 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
