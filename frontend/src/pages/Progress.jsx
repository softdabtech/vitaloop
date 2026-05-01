import { useNavigate } from 'react-router-dom'
import ProgressChart from '../components/ProgressChart.jsx'
import EmptyState from '../components/EmptyState.jsx'
import FeatureGate from '../components/FeatureGate.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { useProgress } from '../hooks/useQueries.js'
import '../styles/dashboard2026.css'

function getBiomarkerValue(upload, name) {
  if (!upload || !Array.isArray(upload.biomarkers)) return null
  const marker = upload.biomarkers.find((b) => b.name.toLowerCase().includes(name.toLowerCase()))
  return marker?.value
}

function deltaPct(first, last) {
  if (first == null || last == null || first === 0) return null
  return Math.round(((last - first) / first) * 100)
}

export default function Progress() {
  const navigate = useNavigate()
  const { data = [], isLoading } = useProgress()

  const handlePaywall = () => {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'SUBSCRIPTION_REQUIRED' } }))
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
        <div className="mb-4 h-56 animate-pulse rounded-xl bg-slate-100" />
      </div>
    )
  }

  const uploadsWithBiomarkers = data.filter((upload) => Array.isArray(upload?.biomarkers) && upload.biomarkers.length > 0)
  const first = uploadsWithBiomarkers[0]
  const last = uploadsWithBiomarkers[uploadsWithBiomarkers.length - 1]

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
    <div className="mx-auto w-full max-w-6xl">
        <CabinetPageHeader
          title="Progress Tracker"
          subtitle="Track concrete biomarker movement between uploads and monitor protocol effect over time."
        />
        {data.length === 0 ? (
          <div className="space-y-4 py-8">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                'Expected biomarker movement between uploads',
                'What improved after protocol adherence',
                'Where retesting or deeper follow-up is needed',
              ].map((item) => (
                <div key={item} className="vtl-light-card p-5 text-sm text-slate-500">{item}</div>
              ))}
            </div>
            <div className="py-10 text-center">
              <EmptyState
                icon="📈"
                title="No lab results yet"
                subtitle="Upload your first blood test to start tracking biomarker progress over time."
                action="Upload First Test"
                onAction={() => navigate('/upload')}
              />
            </div>
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

            <FeatureGate
              feature="progress"
              onLocked={handlePaywall}
              fallback={<div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center"><p className="text-amber-700">Advanced progress tracking available with Premium</p></div>}
            >
              <ProgressChart data={uploadsWithBiomarkers} />
            </FeatureGate>

            <div className="vtl-light-card mt-6 p-5">
              <p className="mb-3 text-sm font-semibold text-slate-700">Upload Timeline</p>
              <div className="space-y-3">
                {data.map((upload, index) => (
                  <div key={upload.id} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-800">Upload #{index + 1}</p>
                      <p className="text-xs text-slate-400">{upload.test_date || upload.created_at?.slice(0, 10) || 'Unknown date'} · {upload.lab_name || 'Unknown lab'}</p>
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
  )
}
