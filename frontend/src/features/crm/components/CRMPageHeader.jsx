export default function CRMPageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
      <div>
        <h1 style={{ margin: 0, color: '#fff', fontSize: 24 }}>{title}</h1>
        {subtitle ? <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{subtitle}</p> : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 8 }}>{actions}</div> : null}
    </div>
  )
}
