import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts'
import '../styles/dashboard2026.css'

export default function ProgressChart({ data }) {
  // Build per-biomarker timeseries across uploads
  const markerCatalog = useMemo(() => {
    const map = new Map()
    data.forEach((upload) => {
      ;(upload.biomarkers || []).forEach((b) => {
        if (!map.has(b.name)) {
          map.set(b.name, {
            name: b.name,
            unit: b.unit || '',
            ref_low: Number.isFinite(Number(b.ref_low)) ? Number(b.ref_low) : null,
            ref_high: Number.isFinite(Number(b.ref_high)) ? Number(b.ref_high) : null,
          })
          return
        }

        const existing = map.get(b.name)
        if (!existing.unit && b.unit) existing.unit = b.unit
        if (existing.ref_low == null && Number.isFinite(Number(b.ref_low))) existing.ref_low = Number(b.ref_low)
        if (existing.ref_high == null && Number.isFinite(Number(b.ref_high))) existing.ref_high = Number(b.ref_high)
      })
    })
    return [...map.values()]
  }, [data])

  const [selectedNames, setSelectedNames] = useState([])

  const activeNames = selectedNames.length > 0
    ? markerCatalog.filter((m) => selectedNames.includes(m.name)).map((m) => m.name).slice(0, 6)
    : markerCatalog.slice(0, 6).map((m) => m.name)

  const chartData = data.map((upload) => {
    const point = { date: upload.test_date || upload.created_at?.split('T')[0] }
    ;(upload.biomarkers || []).forEach((b) => {
      point[b.name] = Number.isFinite(Number(b.value)) ? Number(b.value) : null
    })
    return point
  })

  const firstSelected = markerCatalog.find((m) => m.name === activeNames[0])

  const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7', '#f97316']

  const toggleName = (name) => {
    setSelectedNames((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name)
      if (prev.length >= 6) return [...prev.slice(1), name]
      return [...prev, name]
    })
  }

  if (chartData.length < 2) {
    return (
      <div className="vtl-card p-6 text-center text-slate-400">
        Upload at least 2 lab results to see trend charts.
      </div>
    )
  }

  return (
    <div className="vtl-card p-5 sm:p-6">
      <h3 className="mb-4 text-lg font-semibold text-slate-100">Biomarker Trends</h3>
      <div className="mb-4 flex flex-wrap gap-2">
        {markerCatalog.map((m) => {
          const active = activeNames.includes(m.name)
          return (
            <button
              key={m.name}
              onClick={() => toggleName(m.name)}
              className={`rounded-lg border px-2 py-1 text-xs transition ${
                active
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-600'
              }`}
            >
              {m.name}
            </button>
          )
        })}
      </div>

      {firstSelected?.unit && (
        <p className="mb-2 text-xs text-slate-500">Primary axis unit: {firstSelected.unit}</p>
      )}

      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }} />
          <Legend />

          {firstSelected?.ref_low != null && firstSelected?.ref_high != null && (
            <ReferenceArea
              y1={firstSelected.ref_low}
              y2={firstSelected.ref_high}
              fill="#22c55e"
              fillOpacity={0.08}
            />
          )}

          {activeNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {firstSelected?.ref_low != null && firstSelected?.ref_high != null && (
        <p className="mt-3 text-xs text-slate-500">
          Reference band for {firstSelected.name}: {firstSelected.ref_low} - {firstSelected.ref_high}{firstSelected.unit ? ` ${firstSelected.unit}` : ''}
        </p>
      )}
    </div>
  )
}
