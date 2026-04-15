export default function CRMStatCard({ label, value, hint, tone = '#1d9e75' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${tone}33`, borderRadius: 14, padding: 16 }}>
      <div style={{ color: tone, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ color: '#fff', marginTop: 8, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.55)', marginTop: 8, fontSize: 12 }}>{hint || '\u00a0'}</div>
    </div>
  )
}
