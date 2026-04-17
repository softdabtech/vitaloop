import { useMemo } from 'react'
import StatusBadge from '../components/StatusBadge.jsx'
import CRMTableState from '../components/CRMTableState.jsx'

export default function ProgramList({ loading, error, programs, onRetry, onSelect }) {
  const items = useMemo(() => programs || [], [programs])

  return (
    <CRMTableState
      loading={loading}
      error={error}
      isEmpty={!items.length}
      onRetry={onRetry}
      emptyTitle="No program templates yet"
      emptyDescription="Create your first protocol template to start assigning programs."
    >
      <div className="overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/40">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-slate-700/70 text-slate-400">
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Name</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Category</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Duration</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Status</th>
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Created</th>
              <th className="p-3 text-right text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((program) => (
              <tr key={program.id} className="border-b border-slate-800/80 text-sm text-slate-200">
                <td className="p-3 text-slate-100">{program.name || 'Unnamed'}</td>
                <td className="p-3 text-slate-300">{program.category || '-'}</td>
                <td className="p-3 text-slate-300">{program.duration_days || '-'} days</td>
                <td className="p-3"><StatusBadge status={program.status} /></td>
                <td className="p-3 text-slate-300">{program.created_at ? new Date(program.created_at).toLocaleDateString() : '-'}</td>
                <td className="p-3 text-right">
                  <button onClick={() => onSelect?.(program)} className="vtl-button-primary min-h-[34px] rounded-lg px-3 py-1.5 text-xs font-semibold">
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CRMTableState>
  )
}
