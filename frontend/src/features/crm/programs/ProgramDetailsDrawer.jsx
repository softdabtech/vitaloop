export default function ProgramDetailsDrawer({ program, onClose }) {
  if (!program) return null

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, width: 420, maxWidth: '100%', height: '100%', background: '#111827', borderLeft: '1px solid rgba(255,255,255,0.14)', padding: 18, overflowY: 'auto', zIndex: 70 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#fff' }}>Program Details</h3>
        <button onClick={onClose} style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', borderRadius: 8, padding: '4px 8px' }}>Close</button>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.5 }}>
        <p><strong>Name:</strong> {program.name || '-'}</p>
        <p><strong>Category:</strong> {program.category || '-'}</p>
        <p><strong>Status:</strong> {program.status || '-'}</p>
        <p><strong>Duration:</strong> {program.duration_days || '-'} days</p>
        <p><strong>Description:</strong> {program.description || 'No description'}</p>
        <p><strong>Created:</strong> {program.created_at ? new Date(program.created_at).toLocaleString() : '-'}</p>
        <div>
          <strong>Checkpoint intervals:</strong>
          <pre style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 10, overflowX: 'auto' }}>{JSON.stringify(program.checkpoint_intervals || [], null, 2)}</pre>
        </div>
        <div>
          <strong>Template protocol:</strong>
          <pre style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 10, overflowX: 'auto' }}>{JSON.stringify(program.template_protocol || {}, null, 2)}</pre>
        </div>
        <div>
          <strong>Biomarker targets:</strong>
          <pre style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 10, overflowX: 'auto' }}>{JSON.stringify(program.biomarker_targets || {}, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
