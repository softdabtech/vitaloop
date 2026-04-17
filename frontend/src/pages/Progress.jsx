import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import ProgressChart from '../components/ProgressChart.jsx'
import EmptyState from '../components/EmptyState.jsx'
import LockedFeatureOverlay from '../components/LockedFeatureOverlay.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { useSubscription } from '../hooks/useSubscription.js'
import { useNavigate } from 'react-router-dom'
import '../styles/dashboard2026.css'

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
    <div className="vtl-page px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
        <div className="mb-4 h-56 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  )

  // Premium error
  if (error === 'premium') {
    return (
      <div className="vtl-page px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <CabinetPageHeader
            title="Progress Tracker"
            subtitle="Track concrete biomarker movement between uploads and monitor protocol effect over time."
          />
          <div className="vtl-light-card p-8 text-center">
            <h3 className="mb-2 text-xl font-semibold text-slate-800">Advanced Tracking</h3>
            <p className="mb-6 text-slate-500">Detailed progress tracking is available with Vitaloop Premium.</p>
          <button 
            onClick={() => { window.location.href = '/#pricing' }} 
              className="vtl-button-primary px-8"
          >
            Upgrade to Premium
          </button>
            <p className="mt-4 text-sm text-slate-400">You can still upload new tests as a free user.</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error === 'failed') {
    return (
      <div className="vtl-page px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <CabinetPageHeader
            title="Progress Tracker"
            subtitle="Track concrete biomarker movement between uploads and monitor protocol effect over time."
          />
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
            <p className="mb-4 text-rose-700">Unable to load progress data. Please try again.</p>
          <button 
            onClick={() => window.location.reload()} 
              className="vtl-button-primary px-6"
          >
            Retry
          </button>
          </div>
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
    <div className="vtl-page px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <CabinetPageHeader
          title="Progress Tracker"
          subtitle="Track concrete biomarker movement between uploads and monitor protocol effect over time."
        />
        {data.length === 0 ? (
          <div className="py-20 text-center">
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
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                {deltas.map((d) => (
                  <div key={d.key} className="vtl-light-card p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{d.label}</p>
                    <p className={`text-xl font-bold ${d.pct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {d.pct >= 0 ? '+' : ''}{d.pct}%
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">{d.start} to {d.end}</p>
                  </div>
                ))}
              </div>
            )}

            <LockedFeatureOverlay locked={!isPro}>
              <ProgressChart data={data} />
            </LockedFeatureOverlay>

            <div className="vtl-light-card mt-6 p-5">
              <p className="mb-3 text-sm font-semibold text-slate-700">Upload Timeline</p>
              <div className="space-y-3">
                {data.map((upload, index) => (
                  <div key={upload.id} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-800">Upload #{index + 1}</p>
                      <p className="text-xs text-slate-400">{upload.test_date || upload.created_at?.slice(0, 10)} · {upload.lab_name || 'Unknown lab'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="vtl-light-card mt-8 p-5 text-center">
              <p className="text-sm text-slate-500">Retest recommended every 90 days to track improvements.</p>
              <button onClick={() => navigate('/upload')} className="vtl-button-primary mt-3 px-6 text-sm">
                Upload New Test
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
