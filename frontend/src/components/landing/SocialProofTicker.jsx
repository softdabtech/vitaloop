const ITEMS = [
  '🔬 Quest Diagnostics', '🧪 LabCorp', '🏥 SonoHealth', '⭐ 4.9/5 rating',
  '👤 Sarah M. — Vitamin D +89% in 90 days', '👤 James K. — Fixed iron deficiency',
  '🌍 Available worldwide', '🔒 HIPAA-ready', '🧬 50+ biomarkers tracked',
  '💊 iHerb · Amazon · Thorne · Solgar', '⚡ Results in under 60 seconds',
]

export default function SocialProofTicker() {
  const repeated = [...ITEMS, ...ITEMS, ...ITEMS]

  return (
    <div
      aria-hidden="true"
      style={{
        background: 'var(--gray-50)',
        borderTop: '0.5px solid var(--gray-100)',
        borderBottom: '0.5px solid var(--gray-100)',
        height: 48,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
      }}
    >
      <div className="ticker-track" style={{ alignItems: 'center', whiteSpace: 'nowrap' }}>
        {repeated.map((text, i) => (
          <span key={i} style={{ fontSize: 13, color: 'var(--gray-500)', padding: '0 4px', display: 'inline-flex', alignItems: 'center' }}>
            {text}
            <span style={{ marginLeft: 24, marginRight: 20, color: 'var(--teal-300)' }}>·</span>
          </span>
        ))}
      </div>
    </div>
  )
}
