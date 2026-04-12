function getMarkerPosition(value, low, high) {
  if (low == null || high == null || high <= low) return null
  const raw = ((value - low) / (high - low)) * 100
  return Math.max(0, Math.min(100, raw))
}

function statusColor(status) {
  if (status === 'OPTIMAL') return 'bg-green-500'
  if (status === 'BORDERLINE') return 'bg-yellow-500'
  if (status === 'DEFICIENT') return 'bg-red-500'
  if (status === 'ELEVATED') return 'bg-orange-500'
  return 'bg-gray-500'
}

export default function BiomarkerRangeBars({ biomarkers }) {
  const withRange = biomarkers
    .filter((b) => b.ref_low != null && b.ref_high != null)
    .slice(0, 8)

  if (withRange.length === 0) return null

  return (
    <div className="bg-gray-900 rounded-xl p-4 mb-8 border border-gray-800">
      <h3 className="text-white font-semibold mb-4">Range Comparison</h3>
      <div className="space-y-4">
        {withRange.map((b) => {
          const pos = getMarkerPosition(b.value, b.ref_low, b.ref_high)
          return (
            <div key={b.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-200">{b.name}</span>
                <span className="text-gray-400">{b.value} {b.unit}</span>
              </div>
              <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-red-500/30 via-green-500/35 to-orange-500/30" />
                <div
                  className={`absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-white ${statusColor(b.status)}`}
                  style={{ left: `calc(${pos}% - 6px)` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1 text-gray-500">
                <span>{b.ref_low}</span>
                <span>{b.status}</span>
                <span>{b.ref_high}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
