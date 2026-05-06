import { useNavigate } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import ProgressChart from '../components/ProgressChart.jsx'
import ProgressPhotoGallery from '../components/ProgressPhotoGallery.jsx'
import EmptyState from '../components/EmptyState.jsx'
import FeatureGate from '../components/FeatureGate.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { useProgress } from '../hooks/useQueries.js'
import api from '../lib/api.js'
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
  const [photos, setPhotos] = useState([])

  const handlePaywall = useCallback(() => {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'SUBSCRIPTION_REQUIRED' } }))
  }, [])

  const handlePhotoUpload = async (formData) => {
    try {
      const response = await api.post('/progress/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPhotos([...photos, response.data])
    } catch (error) {
      if (error.response?.status === 402) {
        handlePaywall()
        return
      }
      console.error('Photo upload failed:', error)
      throw error
    }
  }

  const handlePhotoDelete = async (photoId) => {
    try {
      await api.delete(`/progress/photos/${photoId}`)
      setPhotos(photos.filter((p) => p.id !== photoId))
    } catch (error) {
      console.error('Photo delete failed:', error)
      throw error
    }
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
        subtitle="See how your biomarkers are changing over time. Upload multiple tests to track your improvements."
      />
      {data.length === 0 ? (
        <div className="space-y-6 py-8">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: '📊 Track Changes', desc: 'See which biomarkers improved or need attention' },
              { title: '🎯 Measure Impact', desc: 'Know if your protocol is actually working' },
              { title: '📈 Plan Next Steps', desc: 'Decide when to retest and what to adjust' },
            ].map((item) => (
              <div key={item.title} className="vtl-light-card p-5 rounded-2xl">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="py-10 text-center">
            <EmptyState
              icon="📈"
              title="No lab results yet"
              subtitle="Upload your first blood test to start tracking biomarker progress."
              action="Upload First Test"
              onAction={() => navigate('/upload')}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Progress Summary */}
          {deltas.length > 0 && (
            <>
              <div className="mb-2 text-sm font-semibold text-slate-700">Your Progress</div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8 grid gap-4 sm:grid-cols-3"
              >
                {deltas.map((d, idx) => (
                  <motion.div
                    key={d.key}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    whileHover={{ y: -4, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                    className={`rounded-2xl border p-6 transition-all ${
                      d.pct >= 0
                        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50'
                        : 'border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50'
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{d.label}</p>
                    <motion.p
                      initial={{ scale: 0.8 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: idx * 0.15 + 0.1 }}
                      className={`mt-3 text-3xl font-bold ${d.pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {d.pct >= 0 ? '↑' : '↓'} {Math.abs(d.pct)}%
                    </motion.p>
                    <p className="mt-2 text-xs text-slate-500">
                      {d.start} <span className="mx-1">→</span> {d.end}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </>
          )}

          {/* Chart - Premium Feature */}
          {uploadsWithBiomarkers.length >= 2 ? (
            <FeatureGate
              feature="progress"
              onLocked={handlePaywall}
              fallback={
                <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-8 mb-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-semibold text-blue-900">📊 Advanced Trend Charts</p>
                      <p className="mt-1 text-sm text-blue-700">See detailed biomarker trends across all your uploads</p>
                    </div>
                    <button
                      onClick={handlePaywall}
                      className="ml-4 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition whitespace-nowrap"
                    >
                      Unlock
                    </button>
                  </div>
                </div>
              }
            >
              <div className="mb-8">
                <ProgressChart data={uploadsWithBiomarkers} />
              </div>
            </FeatureGate>
          ) : null}

          {/* Upload Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 mb-8"
          >
            <p className="mb-5 text-lg font-semibold text-slate-900">Test History</p>
            <div className="space-y-4">
              {data.map((upload, index) => (
                <motion.div
                  key={upload.id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="flex items-center gap-4 pb-4 last:pb-0 border-b last:border-b-0"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                    <span className="text-sm font-bold text-emerald-700">#{data.length - index}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{upload.test_date || upload.created_at?.slice(0, 10) || 'Unknown date'}</p>
                    <p className="text-sm text-slate-500">{upload.lab_name || 'Lab name not specified'}</p>
                  </div>
                  {Array.isArray(upload.biomarkers) && upload.biomarkers.length > 0 && (
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {upload.biomarkers.length} markers
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Progress Photo Gallery */}
          <div className="mb-8">
            <ProgressPhotoGallery
              photos={photos}
              onUpload={handlePhotoUpload}
              onDelete={handlePhotoDelete}
            />
          </div>

          {/* Call to Action */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-6 text-center">
            <p className="text-lg font-semibold text-emerald-900">Ready for a Retest?</p>
            <p className="mt-2 text-sm text-emerald-700">Recommended every 90 days to track improvements</p>
            <button onClick={() => navigate('/upload')} className="vtl-button-primary mt-4 px-8">
              Upload New Test
            </button>
          </div>
        </>
      )}
    </div>
  )
}
