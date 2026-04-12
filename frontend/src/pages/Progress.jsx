import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import ProgressChart from '../components/ProgressChart.jsx'
import { useNavigate } from 'react-router-dom'

function getBiomarkerValue(upload, name) {
  const marker = upload.biomarkers.find((b) => b.name.toLowerCase().includes(name.toLowerCase()))
  return marker?.value
}

function deltaPct(first, last) {
  if (first == null || last == null || first === 0) return null
  return Math.round(((last - first) / first) * 100)
}

export default function Progress() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    api.get('/progress').then((res) => {
      setData(res.data)
      setLoading(false)
    })
  }, [user])

  if (loading) return <div className="flex items-center justify-center h-screen">Loading…</div>

  const first = data[0]
  const last = data[data.length - 1]

  const tracked = [
    { key: 'Vitamin D', label: 'Vitamin D' },
    { key: 'Ferritin', label: 'Ferritin' },
    { key: 'B12', label: 'B12' },
  ]

  const deltas = tracked
    .map((item) => {
      const start = getBiomarkerValue(first, item.key)
      const end = getBiomarkerValue(last, item.key)
      return {
        ...item,
        start,
        end,
        pct: deltaPct(start, end),
      }
    })
    .filter((d) => d.pct != null)

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-green-400 mb-6">Progress Tracker</h2>
      {data.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 mb-4">No lab results yet.</p>
          <button onClick={() => navigate('/upload')} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg">
            Upload First Test
          </button>
        </div>
      ) : (
        <>
          {deltas.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-3 mb-6">
              {deltas.map((d) => (
                <div key={d.key} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">{d.label}</p>
                  <p className={`text-xl font-bold ${d.pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {d.pct >= 0 ? '+' : ''}{d.pct}%
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">{d.start} → {d.end}</p>
                </div>
              ))}
            </div>
          )}

          <ProgressChart data={data} />

          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-300 mb-3">Upload Timeline</p>
            <div className="space-y-3">
              {data.map((upload, index) => (
                <div key={upload.id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm text-gray-200">Upload #{index + 1}</p>
                    <p className="text-xs text-gray-500">{upload.test_date || upload.created_at?.slice(0, 10)} · {upload.lab_name || 'Unknown lab'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-gray-400 text-sm">Retest recommended every 90 days to track improvements.</p>
            <button onClick={() => navigate('/upload')} className="mt-3 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg text-sm">
              Upload New Test
            </button>
          </div>
        </>
      )}
    </div>
  )
}
