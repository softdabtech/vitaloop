const PRIORITY_COLORS = {
  HIGH:   'bg-rose-50 border-rose-200',
  MEDIUM: 'bg-amber-50 border-amber-200',
  LOW:    'bg-slate-50 border-slate-200',
}

const PRIORITY_BADGE = {
  HIGH:   'bg-rose-100 text-rose-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-slate-100 text-slate-500',
}

export default function ProtocolCard({ recommendation }) {
  const { supplement, dosage, timing, priority, rationale, iherb_url } = recommendation
  const timingLabel = (timing || '').replace(/_/g, ' ')

  return (
    <div className={`border rounded-xl p-4 transition-shadow hover:shadow-sm ${PRIORITY_COLORS[priority] ?? 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">{supplement}</div>
          <div className="text-sm text-slate-500 mt-0.5">{dosage}{timingLabel ? ` · ${timingLabel}` : ''}</div>
          {rationale && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{rationale}</p>}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap uppercase tracking-wider flex-shrink-0 ${
          PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.LOW
        }`}>{priority ?? 'LOW'}</span>
      </div>
      {iherb_url && (
        <a
          href={iherb_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center text-sm bg-emerald-500 hover:bg-emerald-400 text-white py-1.5 rounded-lg transition font-medium"
        >
          Buy on iHerb →
        </a>
      )}
    </div>
  )
}
