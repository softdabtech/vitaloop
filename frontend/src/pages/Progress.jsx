import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import ProgressChart from '../components/ProgressChart.jsx'
import EmptyState from '../components/EmptyState.jsx'
import LockedFeatureOverlay from '../components/LockedFeatureOverlay.jsx'
import { useSubscription } from '../hooks/useSubscription.js'
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
  const { subStatus } = useSubscription()
  const isPro = subStatus === 'active'
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    api.get('/progress')
      .then((res) => {
        setData(res.data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Progress fetch error:', err)
        const status = err.response?.status
        
        if (status === 401) {
          navigate('/login')
        } else if (status === 402) {
          setError('premium')
        } else {
          setError('failed')
        }
        setLoading(false)
      })
  }, [user, navigate])

  if (loading) return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="animate-pulse h-8 w-48 bg-gray-700 rounded-xl mb-6" />
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[1,2,3].map(i => <div key={i} className="animate-pulse bg-gray-800 rounded-xl h-20" />)}
      </div>
      <div className="animate-pulse bg-gray-800 rounded-xl h-48 mb-4" />
      <div className="animate-pulse bg-gray-800 rounded-xl h-32" />
    </div>
  )

  // Premium error
  if (error === 'premium') {
    return (
      <div className="min-h-screen p-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-green-400 mb-6">Progress Tracker</h2>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 text-center border border-green-500/20">
          <h3 className="text-xl font-semibold text-white mb-2">Advanced Tracking</h3>
          <p className="text-gray-400 mb-6">Detailed progress tracking is available with Vitaloop Premium.</p>
          <button 
            onClick={() => {
              // /checkout does not exist; route user to landing pricing block.
              window.location.href = '/#pricing'
            }} 
            className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-semibold transition"
          >
            Upgrade to Premium
          </button>
          <p className="text-gray-500 text-sm mt-4">You can still upload new tests as a free user.</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error === 'failed') {
    return (
      <div className="min-h-screen p-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-green-400 mb-6">Progress Tracker</h2>
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 text-center">
          <p className="text-red-300 mb-4">Unable to load progress data. Please try again.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

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
        <EmptyState
          icon="📈"
          title="No lab results yet"
          subtitle="Upload your first blood test to start tracking biomarker progress over time."
          action="Upload First Test"
          onAction={() => navigate('/upload')}
        />
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

          <LockedFeatureOverlay locked={!isPro}>
            <ProgressChart data={data} />
          </LockedFeatureOverlay>

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
