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
      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
              <th style={{ padding: 10, textAlign: 'left' }}>Name</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Category</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Duration</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Status</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Created</th>
              <th style={{ padding: 10, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((program) => (
              <tr key={program.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: 10, color: '#fff' }}>{program.name || 'Unnamed'}</td>
                <td style={{ padding: 10 }}>{program.category || '-'}</td>
                <td style={{ padding: 10 }}>{program.duration_days || '-'} days</td>
                <td style={{ padding: 10 }}><StatusBadge status={program.status} /></td>
                <td style={{ padding: 10 }}>{program.created_at ? new Date(program.created_at).toLocaleDateString() : '-'}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>
                  <button onClick={() => onSelect?.(program)} style={{ border: 'none', background: '#1d9e75', color: '#fff', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
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
