export default function CRMEmptyState({ title = 'No data yet', description = 'Try adjusting filters or create a new record.', action }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
      <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>{title}</h3>
      <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{description}</p>
      {action || null}
    </div>
  )
}
