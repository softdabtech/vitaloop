import AddInterventionForm from './AddInterventionForm.jsx'

export default function InterventionsPanel({ assignmentId, interventions, onAdd, loading, canSubmit }) {
  const items = interventions || []

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
      <h3 style={{ margin: '0 0 10px', color: '#fff' }}>Interventions</h3>
      {!assignmentId ? (
        <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Assign a client program first to enable intervention timeline.</p>
      ) : null}
      <AddInterventionForm assignmentId={assignmentId} onSubmit={onAdd} loading={loading} canSubmit={canSubmit} />
      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {!items.length ? (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>No interventions recorded in this session yet.</div>
        ) : (
          items.map((item, idx) => (
            <div key={`${item?.id || 'local'}-${idx}`} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10 }}>
              <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>{item.change_type || 'update'}</div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{item.description || '-'}</div>
              <pre style={{ marginTop: 6, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 8, overflowX: 'auto' }}>{JSON.stringify(item.changes || {}, null, 2)}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
