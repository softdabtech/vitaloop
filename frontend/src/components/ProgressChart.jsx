import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'
import '../styles/dashboard2026.css'

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatValue(value) {
  if (value == null) return '-'
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString('en-US')
  if (Math.abs(value) >= 100) return value.toFixed(1)
  return value.toFixed(2)
}

function clampName(name) {
  const text = String(name || '').trim()
  if (text.length <= 28) return text
  return `${text.slice(0, 25)}...`
}

function markerPriority(name) {
  const normalized = String(name || '').toLowerCase()
  const preferred = [
    'vitamin d',
    'ferritin',
    'b12',
    'hemoglobin',
    'glucose',
    'hba1c',
    'tsh',
    'hdl',
    'ldl',
    'triglycer',
  ]

  const hit = preferred.findIndex((keyword) => normalized.includes(keyword))
  return hit >= 0 ? 100 - hit : 0
}

export default function ProgressChart({ data }) {
  const markerCatalog = useMemo(() => {
    const map = new Map()

    data.forEach((upload, uploadIndex) => {
      ;(upload.biomarkers || []).forEach((b) => {
        const markerName = String(b?.name || '').trim()
        if (!markerName) return

        const value = toNumber(b.value)
        if (value == null) return

        if (!map.has(markerName)) {
          map.set(markerName, {
            name: markerName,
            unit: b.unit || '',
            ref_low: Number.isFinite(Number(b.ref_low)) ? Number(b.ref_low) : null,
            ref_high: Number.isFinite(Number(b.ref_high)) ? Number(b.ref_high) : null,
            pointsByIndex: new Map(),
          })
        }

        const existing = map.get(markerName)
        if (!existing.unit && b.unit) existing.unit = b.unit
        if (existing.ref_low == null && Number.isFinite(Number(b.ref_low))) existing.ref_low = Number(b.ref_low)
        if (existing.ref_high == null && Number.isFinite(Number(b.ref_high))) existing.ref_high = Number(b.ref_high)
        existing.pointsByIndex.set(uploadIndex, value)
      })
    })

    return [...map.values()]
      .filter((marker) => marker.pointsByIndex.size >= 2)
      .sort((a, b) => {
        const priorityDiff = markerPriority(b.name) - markerPriority(a.name)
        if (priorityDiff !== 0) return priorityDiff
        return b.pointsByIndex.size - a.pointsByIndex.size
      })
  }, [data])

  const [selectedName, setSelectedName] = useState('')

  useEffect(() => {
    if (!markerCatalog.length) {
      setSelectedName('')
      return
    }

    if (!selectedName || !markerCatalog.some((marker) => marker.name === selectedName)) {
      setSelectedName(markerCatalog[0].name)
    }
  }, [markerCatalog, selectedName])

  const selectedMarker = markerCatalog.find((marker) => marker.name === selectedName) || markerCatalog[0] || null

  const chartData = data.map((upload) => {
    return { date: upload.test_date || upload.created_at?.split('T')[0] || 'Unknown date' }
  })

  const selectedChartData = selectedMarker
    ? chartData.map((point, index) => ({
      ...point,
      value: selectedMarker.pointsByIndex.get(index) ?? null,
    }))
    : []

  const values = selectedChartData
    .map((item) => item.value)
    .filter((value) => value != null)

  const firstValue = values.length ? values[0] : null
  const lastValue = values.length ? values[values.length - 1] : null
  const deltaPct =
    firstValue != null && lastValue != null && firstValue !== 0
      ? Math.round(((lastValue - firstValue) / firstValue) * 100)
      : null

  const inReferenceRange =
    selectedMarker
    && selectedMarker.ref_low != null
    && selectedMarker.ref_high != null
    && lastValue != null
      ? lastValue >= selectedMarker.ref_low && lastValue <= selectedMarker.ref_high
      : null

  const quickMarkers = markerCatalog.slice(0, 8)

  const trendColor =
    deltaPct == null
      ? '#3b82f6'
      : deltaPct >= 0
        ? '#22c55e'
        : '#f59e0b'

  if (chartData.length < 2 || markerCatalog.length === 0 || !selectedMarker) {
    return (
      <div className="vtl-card p-6 text-center text-slate-400">
        Upload at least 2 lab results with numeric biomarkers to see trend charts.
      </div>
    )
  }

  return (
    <div className="vtl-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Biomarker trend focus</h3>
          <p className="text-xs text-slate-500">One marker at a time for clearer interpretation on mobile and desktop.</p>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[280px]">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Marker</label>
          <select
            value={selectedName}
            onChange={(event) => setSelectedName(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {markerCatalog.map((marker) => (
              <option key={marker.name} value={marker.name}>
                {marker.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {quickMarkers.map((marker) => {
            const active = marker.name === selectedName
            return (
              <button
                key={marker.name}
                type="button"
                onClick={() => setSelectedName(marker.name)}
                title={marker.name}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                }`}
              >
                {clampName(marker.name)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest value</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatValue(lastValue)}{selectedMarker.unit ? ` ${selectedMarker.unit}` : ''}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Change vs first test</p>
          <p className={`mt-1 text-xl font-bold ${deltaPct == null ? 'text-slate-500' : deltaPct >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {deltaPct == null ? '-' : `${deltaPct >= 0 ? '+' : ''}${deltaPct}%`}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference status</p>
          <p className={`mt-1 text-xl font-bold ${inReferenceRange == null ? 'text-slate-500' : inReferenceRange ? 'text-emerald-700' : 'text-rose-700'}`}>
            {inReferenceRange == null ? 'N/A' : inReferenceRange ? 'In range' : 'Out of range'}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={selectedChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
          <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
          <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12 }}
            formatter={(value) => [formatValue(value), selectedMarker.name]}
          />

          {selectedMarker.ref_low != null && selectedMarker.ref_high != null && (
            <ReferenceArea
              y1={selectedMarker.ref_low}
              y2={selectedMarker.ref_high}
              fill="#22c55e"
              fillOpacity={0.12}
            />
          )}

          <Line
            type="monotone"
            dataKey="value"
            stroke={trendColor}
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {selectedMarker.ref_low != null && selectedMarker.ref_high != null && (
        <p className="mt-3 text-xs text-slate-500">
          Reference band for {selectedMarker.name}: {selectedMarker.ref_low} - {selectedMarker.ref_high}{selectedMarker.unit ? ` ${selectedMarker.unit}` : ''}
        </p>
      )}
    </div>
  )
}
