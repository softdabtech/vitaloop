import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import BiomarkerCard from '../components/BiomarkerCard.jsx'
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

  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>

  const deficient = biomarkers.filter((b) => b.status === 'DEFICIENT' || b.status === 'ELEVATED')

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-300 text-sm mb-6">
        ← Back to dashboard
      </button>

      <h2 className="text-2xl font-bold text-green-400 mb-6">Your Lab Results</h2>

      {deficient.length > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6">
          <p className="text-red-400 font-semibold mb-2">⚠ Deficiencies / Elevations Detected</p>
          <p className="text-gray-400 text-sm">{deficient.map((b) => b.name).join(', ')}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mb-10">
        {biomarkers.map((b) => <BiomarkerCard key={b.id} biomarker={b} />)}
      </div>

      <h3 className="text-xl font-bold text-white mb-4">Your Supplement Protocol</h3>

      {isActive ? (
        <div className="space-y-3">
          {protocol.map((rec, i) => <ProtocolCard key={i} recommendation={rec} />)}
        </div>
      ) : (
        <Paywall />
      )}
    </div>
  )
}
