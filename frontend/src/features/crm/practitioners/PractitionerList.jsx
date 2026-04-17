import CRMTableState from '../components/CRMTableState.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function PractitionerList({ loading, error, practitioners, onRetry }) {
  const items = practitioners || []

  return (
    <CRMTableState
      loading={loading}
      error={error}
      onRetry={onRetry}
      isEmpty={!items.length}
      emptyTitle="No practitioners loaded"
      emptyDescription="Current backend does not expose practitioner list endpoint yet. Use direct lookup by ID or create practitioner."
    >
      <div className="overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/40">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-slate-700/70 text-slate-400">
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Practitioner ID</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Specialization</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Status</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Capacity</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Availability</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-800/80 text-sm text-slate-200">
                <td className="p-3"><code className="text-slate-200">{item.id}</code></td>
                <td className="p-3 text-slate-300">{item.specialization || '-'}</td>
                <td className="p-3"><StatusBadge status={item.status} /></td>
                <td className="p-3 text-slate-300">{item.current_clients ?? 0} / {item.max_clients ?? 0}</td>
                <td className="p-3 text-slate-300">{item.availability || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CRMTableState>
  )
}
