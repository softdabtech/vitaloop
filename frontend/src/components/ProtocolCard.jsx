const PRIORITY_COLORS = {
  HIGH: 'bg-red-500/10 border-red-500/40',
  MEDIUM: 'bg-yellow-500/10 border-yellow-500/40',
  LOW: 'bg-gray-700 border-gray-600',
}

export default function ProtocolCard({ recommendation }) {
  const { supplement, dosage, timing, priority, rationale, iherb_url } = recommendation
  const timingLabel = timing.replace(/_/g, ' ')

  return (
    <div className={`border rounded-xl p-4 ${PRIORITY_COLORS[priority] ?? 'bg-gray-800 border-gray-700'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{supplement}</div>
          <div className="text-sm text-gray-400 mt-0.5">{dosage} · {timingLabel}</div>
          <p className="text-xs text-gray-500 mt-2">{rationale}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap ${
          priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
          priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-gray-700 text-gray-400'
        }`}>{priority}</span>
      </div>
      {iherb_url && (
        <a
          href={iherb_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center text-sm bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg transition"
        >
          Buy on iHerb →
        </a>
      )}
    </div>
  )
}
