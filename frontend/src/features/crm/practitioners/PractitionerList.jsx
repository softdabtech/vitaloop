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
      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
              <th style={{ padding: 10, textAlign: 'left' }}>Practitioner ID</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Specialization</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Status</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Capacity</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Availability</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: 10 }}><code>{item.id}</code></td>
                <td style={{ padding: 10 }}>{item.specialization || '-'}</td>
                <td style={{ padding: 10 }}><StatusBadge status={item.status} /></td>
                <td style={{ padding: 10 }}>{item.current_clients ?? 0} / {item.max_clients ?? 0}</td>
                <td style={{ padding: 10 }}>{item.availability || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CRMTableState>
  )
}
