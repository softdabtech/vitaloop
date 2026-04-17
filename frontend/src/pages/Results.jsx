import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import BiomarkerCard from '../components/BiomarkerCard.jsx'
import BiomarkerRangeBars from '../components/BiomarkerRangeBars.jsx'
import ProtocolCard from '../components/ProtocolCard.jsx'
import Paywall from '../components/Paywall.jsx'
import { useSubscription } from '../hooks/useSubscription.js'

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

  const deficient = biomarkers.filter((b) => b.status === 'DEFICIENT' || b.status === 'ELEVATED')
  const optimal = biomarkers.filter((b) => b.status === 'OPTIMAL').length
  const borderline = biomarkers.filter((b) => b.status === 'BORDERLINE').length

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
            <p className="text-rose-700 font-semibold mb-2">⚠ Deficiencies / Elevations Detected</p>
            <p className="text-slate-600 text-sm">{deficient.map((b) => b.name).join(', ')}</p>
          </div>
        )}

        <BiomarkerRangeBars biomarkers={biomarkers} />

        <div className="grid sm:grid-cols-2 gap-3 mb-10">
          {biomarkers.map((b) => <BiomarkerCard key={b.id} biomarker={b} />)}
        </div>

        <h3 className="text-xl font-bold text-slate-900 mb-4">Your Supplement Protocol</h3>

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
