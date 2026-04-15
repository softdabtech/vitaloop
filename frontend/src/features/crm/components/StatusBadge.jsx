const STATUS_COLORS = {
  active: { bg: 'rgba(16,185,129,0.2)', text: '#6ee7b7' },
  paused: { bg: 'rgba(245,158,11,0.2)', text: '#fcd34d' },
  completed: { bg: 'rgba(59,130,246,0.2)', text: '#93c5fd' },
  cancelled: { bg: 'rgba(239,68,68,0.2)', text: '#fca5a5' },
  started: { bg: 'rgba(168,85,247,0.2)', text: '#d8b4fe' },
  onboarding: { bg: 'rgba(14,165,233,0.2)', text: '#7dd3fc' },
  questionnaire_pending: { bg: 'rgba(236,72,153,0.2)', text: '#f9a8d4' },
  program_assigned: { bg: 'rgba(99,102,241,0.2)', text: '#c7d2fe' },
}

export default function StatusBadge({ status, fallback = 'unknown' }) {
  const safe = status || fallback
  const palette = STATUS_COLORS[safe] || { bg: 'rgba(148,163,184,0.2)', text: '#cbd5e1' }

  return (
    <span style={{
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      padding: '4px 8px',
      borderRadius: 999,
      background: palette.bg,
      color: palette.text,
      fontWeight: 700,
    }}>
      {String(safe).replaceAll('_', ' ')}
    </span>
  )
}
