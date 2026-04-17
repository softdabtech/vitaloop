import { useState } from 'react'

// Zone → biomarker keywords mapping
const ZONES = [
  {
    id: 'brain',
    label: 'Brain',
    keywords: ['B12', 'Omega', 'D3', 'Vitamin D', 'B-12', 'folate'],
    supplements: 'Methylcobalamin, Omega-3 EPA/DHA, Vitamin D3',
    cx: 200, cy: 70, r: 38,
  },
  {
    id: 'heart',
    label: 'Heart',
    keywords: ['CoQ10', 'Magnesium', 'Cholesterol', 'LDL', 'HDL', 'Triglycerides'],
    supplements: 'CoQ10 Ubiquinol, Magnesium Glycinate, Berberine',
    cx: 200, cy: 200, r: 38,
  },
  {
    id: 'muscles',
    label: 'Muscles',
    keywords: ['Iron', 'Ferritin', 'Testosterone', 'Zinc'],
    supplements: 'Iron Bisglycinate, Ashwagandha, Zinc + Magnesium',
    cx: 155, cy: 290, r: 34,
  },
  {
    id: 'bones',
    label: 'Bones',
    keywords: ['Vitamin D', 'Calcium', 'K2', 'Phosphorus'],
    supplements: 'D3 + K2 Complex, Calcium Citrate',
    cx: 245, cy: 290, r: 34,
  },
  {
    id: 'gut',
    label: 'GI Tract',
    keywords: ['Zinc', 'B-vitamin', 'B12', 'folate', 'gut'],
    supplements: 'Probiotics 50B CFU, Zinc Carnosine, B-Complex',
    cx: 200, cy: 370, r: 34,
  },
]

function zoneColor(zone, biomarkers) {
  const relevantStatuses = biomarkers
    .filter((b) => zone.keywords.some((kw) => b.name.toLowerCase().includes(kw.toLowerCase())))
    .map((b) => b.status)

  if (relevantStatuses.includes('DEFICIENT') || relevantStatuses.includes('ELEVATED')) return '#ef4444'
  if (relevantStatuses.includes('BORDERLINE')) return '#eab308'
  if (relevantStatuses.includes('OPTIMAL')) return '#22c55e'
  return '#374151'
}

export default function BodyAvatar({ biomarkers }) {
  const [active, setActive] = useState(null)
  const matched = active
    ? biomarkers.filter((b) => active.keywords.some((kw) => b.name.toLowerCase().includes(kw.toLowerCase())))
    : []

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start">
      <svg viewBox="0 0 400 600" className="w-full max-w-xs mx-auto" style={{ filter: 'drop-shadow(0 8px 22px rgba(29,158,117,0.16))' }}>
        {/* Simple body outline */}
        <ellipse cx="200" cy="60" rx="40" ry="48" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="155" y="108" width="90" height="140" rx="18" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="100" y="112" width="52" height="110" rx="14" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="248" y="112" width="52" height="110" rx="14" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="155" y="246" width="38" height="130" rx="14" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="208" y="246" width="38" height="130" rx="14" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="150" y="374" width="40" height="80" rx="10" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="210" y="374" width="40" height="80" rx="10" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />

        {/* Hotspot zones */}
        {ZONES.map((zone) => (
          <g key={zone.id} onClick={() => setActive(active?.id === zone.id ? null : zone)} className="cursor-pointer">
            <circle
              cx={zone.cx} cy={zone.cy} r={zone.r}
              fill={zoneColor(zone, biomarkers)}
              fillOpacity={active?.id === zone.id ? 0.7 : 0.4}
              stroke={zoneColor(zone, biomarkers)}
              strokeWidth={active?.id === zone.id ? 2.5 : 1.5}
              style={{ transition: 'all 0.2s' }}
            />
            <text x={zone.cx} y={zone.cy + 5} textAnchor="middle" fontSize="11" fill="white" fontWeight="600">
              {zone.label}
            </text>
          </g>
        ))}
      </svg>

      {active && (
        <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 md:max-w-xs">
          <h4 className="mb-2 text-lg font-bold text-slate-900">{active.label}</h4>
          <p className="mb-3 text-xs text-slate-500">Related markers: {active.keywords.join(', ')}</p>
          {matched.length > 0 ? (
            <div className="mb-3 space-y-1">
              {matched.slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700">{m.name}</span>
                  <span
                    className={
                      m.status === 'OPTIMAL' ? 'text-emerald-600' :
                      m.status === 'BORDERLINE' ? 'text-amber-600' :
                      m.status === 'DEFICIENT' ? 'text-rose-600' :
                      m.status === 'ELEVATED' ? 'text-orange-600' : 'text-slate-500'
                    }
                  >
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-slate-500">No matching markers in your latest data.</p>
          )}
          <p className="mb-1 text-xs font-medium text-emerald-700">Recommended supplements:</p>
          <p className="text-sm text-slate-700">{active.supplements}</p>
        </div>
      )}
    </div>
  )
}
