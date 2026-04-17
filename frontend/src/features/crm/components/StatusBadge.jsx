const STATUS_COLORS = {
  active: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-200',
  paused: 'border-amber-500/35 bg-amber-500/15 text-amber-200',
  completed: 'border-sky-500/35 bg-sky-500/15 text-sky-200',
  cancelled: 'border-rose-500/35 bg-rose-500/15 text-rose-200',
  started: 'border-violet-500/35 bg-violet-500/15 text-violet-200',
  onboarding: 'border-cyan-500/35 bg-cyan-500/15 text-cyan-200',
  questionnaire_pending: 'border-pink-500/35 bg-pink-500/15 text-pink-200',
  program_assigned: 'border-indigo-500/35 bg-indigo-500/15 text-indigo-200',
}

export default function StatusBadge({ status, fallback = 'unknown' }) {
  const safe = status || fallback
  const palette = STATUS_COLORS[safe] || 'border-slate-500/35 bg-slate-500/15 text-slate-300'

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.05em] ${palette}`}>
      {String(safe).replaceAll('_', ' ')}
    </span>
  )
}
