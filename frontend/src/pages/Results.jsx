import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import ProtocolCard from '../components/ProtocolCard.jsx'
import Paywall from '../components/Paywall.jsx'
import { useSubscription } from '../hooks/useSubscription.js'

const STATUS_META = {
  DEFICIENT: { rank: 0, border: 'border-rose-300', stripe: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700', text: 'text-rose-700' },
  ELEVATED: { rank: 1, border: 'border-orange-300', stripe: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700', text: 'text-orange-700' },
  BORDERLINE: { rank: 2, border: 'border-amber-300', stripe: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700', text: 'text-amber-700' },
  OPTIMAL: { rank: 3, border: 'border-emerald-300', stripe: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700' },
}

function scoreStatus(status) {
  return (STATUS_META[String(status || '').toUpperCase()] || { rank: 4 }).rank
}

function formatMetric(biomarker) {
  const value = biomarker?.value ?? '--'
  const unit = biomarker?.unit ? ` ${biomarker.unit}` : ''
  return `${value}${unit}`
}

function computeRangePercent(biomarker) {
  const low = Number(biomarker?.ref_low)
  const high = Number(biomarker?.ref_high)
  const value = Number(biomarker?.value)
  if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(value) || high <= low) return 0
  return Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100))
}

export default function Results() {
  const { uploadId } = useParams()
  const navigate = useNavigate()
  const { isActive } = useSubscription()
  const [biomarkers, setBiomarkers] = useState([])
  const [protocol, setProtocol] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [bmRes, prRes] = await Promise.all([
        supabase.from('biomarkers').select('*').eq('upload_id', uploadId),
        supabase.from('protocols').select('*').eq('upload_id', uploadId).single(),
      ])
      setBiomarkers(bmRes.data ?? [])
      setProtocol(prRes.data?.recommendations ?? [])
      setLoading(false)
    }
    load()
  }, [uploadId])

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading…</div>

  const rankedBiomarkers = [...biomarkers].sort((a, b) => scoreStatus(a.status) - scoreStatus(b.status))
  const deficient = biomarkers.filter((b) => b.status === 'DEFICIENT' || b.status === 'ELEVATED')
  const optimal = biomarkers.filter((b) => b.status === 'OPTIMAL').length
  const borderline = biomarkers.filter((b) => b.status === 'BORDERLINE').length
  const topPriority = rankedBiomarkers.find((b) => String(b.status || '').toUpperCase() !== 'OPTIMAL') || rankedBiomarkers[0] || null

  return (
    <div className="vtl-page min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-slate-700 text-sm mb-6">← Back to dashboard</button>

        <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Lab Results</h2>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="vtl-light-card p-3 text-center">
            <div className="text-xl font-bold text-emerald-600">{optimal}</div>
            <div className="text-[11px] text-slate-500 uppercase">Optimal</div>
          </div>
          <div className="vtl-light-card p-3 text-center">
            <div className="text-xl font-bold text-amber-600">{borderline}</div>
            <div className="text-[11px] text-slate-500 uppercase">Borderline</div>
          </div>
          <div className="vtl-light-card p-3 text-center">
            <div className="text-xl font-bold text-rose-600">{deficient.length}</div>
            <div className="text-[11px] text-slate-500 uppercase">Needs Attention</div>
          </div>
        </div>

        {deficient.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 mb-6">
            <p className="text-rose-700 font-semibold mb-2">Deficiencies / Elevations Detected</p>
            <p className="text-slate-600 text-sm">{deficient.map((b) => b.name).join(', ')}</p>
          </div>
        )}

        {topPriority && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Top priority</div>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Your #1 priority: {topPriority.name} ({formatMetric(topPriority)})
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This marker should be addressed first to improve near-term outcomes and guide your next protocol cycle.
            </p>
            <button
              onClick={() => navigate(`/protocol/${uploadId}`)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              See supplement for this
            </button>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mb-10">
          {rankedBiomarkers.map((b) => {
            const status = String(b.status || '').toUpperCase()
            const meta = STATUS_META[status] || STATUS_META.BORDERLINE
            const rangeLabel = b.ref_low != null && b.ref_high != null ? `${b.ref_low}-${b.ref_high} ${b.unit || ''}`.trim() : 'No reference range'
            const bar = computeRangePercent(b)
            return (
              <div key={b.id} className={`relative overflow-hidden rounded-xl border bg-white p-4 ${meta.border}`}>
                <span className={`absolute inset-y-0 left-0 w-1.5 ${meta.stripe}`} aria-hidden="true" />
                <div className="pl-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">{b.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>{status}</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {b.value} <span className="text-sm font-medium text-slate-500">{b.unit}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Normal: {rangeLabel}</div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${meta.stripe}`} style={{ width: `${bar}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900">Your Supplement Protocol</h3>
          <button
            onClick={() => navigate(`/protocol/${uploadId}`)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            View Full Protocol →
          </button>
        </div>

        {isActive ? (
          <div className="space-y-3">
            {protocol.map((rec, i) => <ProtocolCard key={i} recommendation={rec} />)}
          </div>
        ) : (
          <Paywall />
        )}
      </div>
    </div>
  )
}
