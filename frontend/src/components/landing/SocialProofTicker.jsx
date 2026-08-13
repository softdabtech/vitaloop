const ITEMS = [
  'PDF, images, CSV, XLS, and manual entry',
  'Symptom-first intake',
  'Biomarker normalization',
  'Structured report logic',
  'Doctor discussion points',
  'Retest timing when supported by data',
  'Available online',
  'Privacy-first architecture',
  'Knowledge Base reasoning',
  'Safety notes and retest timing',
  'Educational wellness guidance',
  'Results with Knowledge Base reasoning',
]

export default function SocialProofTicker() {
  const all = [...ITEMS, ...ITEMS, ...ITEMS]

  return (
    <div
      aria-hidden="true"
      style={{
        background: 'var(--gray-50)',
        borderTop: '0.5px solid var(--gray-100)',
        borderBottom: '0.5px solid var(--gray-100)',
        height: 48, overflow: 'hidden',
        display: 'flex', alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center',
          whiteSpace: 'nowrap', userSelect: 'none',
          animation: 'ticker 50s linear infinite',
          willChange: 'transform',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.animationPlayState = 'paused' }}
        onMouseLeave={(e) => { e.currentTarget.style.animationPlayState = 'running' }}
      >
        {all.map((text, i) => (
          <span key={i} style={{ fontSize: 13, color: 'var(--gray-500)', padding: '0 4px', display: 'inline-flex', alignItems: 'center' }}>
            {text}
            <span style={{ margin: '0 16px', color: 'var(--teal-400)', fontSize: 6 }}>●</span>
          </span>
        ))}
      </div>
    </div>
  )
}
