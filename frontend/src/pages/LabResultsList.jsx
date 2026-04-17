import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Calendar, ChevronRight, Upload } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import '../styles/dashboard2026.css'

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value.includes('optimal') || value.includes('normal')) return 'optimal'
  if (value.includes('border') || value.includes('warn')) return 'warning'
  if (value.includes('critical') || value.includes('deficient') || value.includes('elevated')) return 'critical'
  return 'warning'
}

function normalizeProgressPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export default function LabResultsList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return

    let active = true
    api.get('/progress')
      .then((res) => {
        if (!active) return
        setItems(normalizeProgressPayload(res.data))
        setError(null)
      })
      .catch(() => {
        if (!active) return
        setError('Could not load lab results.')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = new Date(a?.test_date || a?.created_at || 0).getTime()
      const db = new Date(b?.test_date || b?.created_at || 0).getTime()
      return db - da
    })
  }, [items])

  if (loading) {
    return (
      <div className="vtl-shell min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 h-8 w-56 animate-pulse rounded-xl bg-slate-700" />
          <div className="space-y-3">
          {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-800" />
          ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="vtl-shell min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="vtl-card mb-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mb-1 text-2xl font-bold tracking-tight text-slate-100">Lab Results</h2>
            <p className="text-sm text-slate-300">History of uploaded tests and biomarker quality snapshot.</p>
          </div>
          <button
            onClick={() => navigate('/upload')}
            className="vtl-button-primary inline-flex items-center justify-center gap-2 px-5 text-sm"
          >
            <Upload className="h-4 w-4" />
            Upload New Test
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        {sortedItems.length === 0 ? (
          <div className="vtl-card p-10 text-center">
            <FlaskConical className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <p className="mb-1 font-semibold text-slate-100">No lab uploads yet</p>
            <p className="mb-4 text-sm text-slate-400">Upload your first document to generate biomarkers and protocol.</p>
            <button
              onClick={() => navigate('/upload')}
              className="vtl-button-primary px-5 text-sm"
            >
              Go to Upload
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
            <div className="space-y-3">
              {sortedItems.map((item, index) => {
                const date = item?.test_date || item?.created_at?.slice(0, 10) || 'Unknown date'
                const biomarkers = Array.isArray(item?.biomarkers) ? item.biomarkers : []
                const optimal = biomarkers.filter((b) => normalizeStatus(b?.status) === 'optimal').length
                const warning = biomarkers.filter((b) => normalizeStatus(b?.status) === 'warning').length
                const critical = biomarkers.filter((b) => normalizeStatus(b?.status) === 'critical').length
                const uploadId = item?.upload_id || item?.id

                return (
                  <button
                    key={uploadId || `${date}-${index}`}
                    onClick={() => uploadId && navigate(`/results/${uploadId}`)}
                    disabled={!uploadId}
                    className="vtl-card vtl-card-hover h-16 w-full rounded-2xl px-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex h-full flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-sm font-semibold text-slate-100">{item?.lab_name || `Upload #${sortedItems.length - index}`}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {date}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="vtl-status-pill border border-emerald-500/35 bg-emerald-500/15 text-emerald-200">Optimal {optimal}</span>
                        <span className="vtl-status-pill border border-amber-500/35 bg-amber-500/15 text-amber-200">Warning {warning}</span>
                        <span className="vtl-status-pill border border-rose-500/35 bg-rose-500/15 text-rose-200">Critical {critical}</span>
                      </div>

                      <div className="inline-flex items-center gap-1 text-sm text-slate-300">
                        Open
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <aside className="vtl-card h-fit p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Results Insight</h3>
              <p className="mt-3 text-sm text-slate-400">Most recent trend snapshot from all uploaded biomarkers.</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-300">Stable zone</p>
                  <p className="mt-1 text-sm text-slate-100">Focus on maintaining optimal markers with current protocol.</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-300">Needs attention</p>
                  <p className="mt-1 text-sm text-slate-100">Watch warning markers and repeat test in 8-12 weeks.</p>
                </div>
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-rose-300">Red flags</p>
                  <p className="mt-1 text-sm text-slate-100">Discuss critical markers with your practitioner promptly.</p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
