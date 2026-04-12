import clsx from 'clsx'

const STATUS_COLORS = {
  OPTIMAL: 'border-green-500 bg-green-900/20 text-green-400',
  BORDERLINE: 'border-yellow-500 bg-yellow-900/20 text-yellow-400',
  DEFICIENT: 'border-red-500 bg-red-900/20 text-red-400',
  ELEVATED: 'border-orange-500 bg-orange-900/20 text-orange-400',
}

export default function BiomarkerCard({ biomarker }) {
  const { name, value, unit, ref_low, ref_high, status } = biomarker
  const range = ref_low != null && ref_high != null ? `${ref_low}–${ref_high} ${unit}` : null
  const pct = ref_low != null && ref_high != null
    ? Math.min(100, Math.max(0, ((value - ref_low) / (ref_high - ref_low)) * 100))
    : null

  return (
    <div className={clsx('border rounded-xl p-4', STATUS_COLORS[status] ?? 'border-gray-700')}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-medium text-white">{name}</span>
        <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', STATUS_COLORS[status])}>{status}</span>
      </div>
      <div className="text-2xl font-bold text-white">
        {value} <span className="text-sm font-normal text-gray-400">{unit}</span>
      </div>
      {range && <div className="text-xs text-gray-500 mt-1">Normal: {range}</div>}
      {pct != null && (
        <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-current" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}
