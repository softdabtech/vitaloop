import { useNavigate } from 'react-router-dom'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CheckCircle2, Sparkles } from 'lucide-react'
import ProgressChart from '../components/ProgressChart.jsx'
import ProgressPhotoGallery from '../components/ProgressPhotoGallery.jsx'
import EmptyState from '../components/EmptyState.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { useProgress } from '../hooks/useQueries.js'
import { useSubscription } from '../hooks/useSubscription.js'
import api from '../lib/api.js'
import { supabase } from '../lib/supabase.js'
import '../styles/dashboard2026.css'

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function getBiomarkerValue(upload, name) {
  if (!upload || !Array.isArray(upload.biomarkers)) return null
  const marker = upload.biomarkers.find((b) => String(b?.name || '').toLowerCase().includes(name.toLowerCase()))
  return toNumber(marker?.value)
}

function deltaPct(first, last) {
  if (first == null || last == null || first === 0) return null
  const delta = ((last - first) / first) * 100
  return Number.isFinite(delta) ? Math.round(delta) : null
}

function formatMetricValue(value) {
  if (value == null) return '-'
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString('en-US')
  if (Math.abs(value) >= 100) return value.toFixed(1)
  return value.toFixed(2)
}

function shortMetricValue(value) {
  if (value == null) return '-'
  if (Math.abs(value) >= 100) return Math.round(value).toLocaleString('en-US')
  if (Math.abs(value) >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

function buildBiomarkerTrends(uploads) {
  const map = new Map()

  uploads.forEach((upload, uploadIndex) => {
    const uploadLabel = upload.test_date || upload.created_at?.slice(0, 10) || `Upload ${uploadIndex + 1}`
    ;(upload.biomarkers || []).forEach((marker) => {
      const name = String(marker?.name || '').trim()
      const value = toNumber(marker?.value)
      if (!name || value == null) return

      if (!map.has(name)) {
        map.set(name, {
          name,
          unit: marker?.unit || '',
          points: [],
        })
      }

      const entry = map.get(name)
      if (!entry.unit && marker?.unit) {
        entry.unit = marker.unit
      }
      entry.points.push({ value, uploadLabel })
    })
  })

  const trends = []
  map.forEach((entry) => {
    if (!entry.points || entry.points.length < 2) return

    const firstPoint = entry.points[0]
    const lastPoint = entry.points[entry.points.length - 1]
    const pct = deltaPct(firstPoint.value, lastPoint.value)
    if (pct == null) return

    trends.push({
      name: entry.name,
      unit: entry.unit,
      start: firstPoint.value,
      end: lastPoint.value,
      pct,
      direction: pct >= 0 ? 'up' : 'down',
    })
  })

  return trends.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
}

const CORE_MARKERS = [
  {
    key: 'ferritin',
    name: 'Ferritin',
    subtitle: 'Iron Storage',
    defaultUnit: 'ng/mL',
    keywords: ['ferritin', 'iron storage'],
  },
  {
    key: 'vitamin-d',
    name: 'Vitamin D',
    subtitle: 'Immune and Bone Health',
    defaultUnit: 'ng/mL',
    keywords: ['vitamin d', '25-oh', 'd3'],
  },
  {
    key: 'omega-3',
    name: 'Omega-3 Index',
    subtitle: 'Heart and Brain Health',
    defaultUnit: '%',
    keywords: ['omega-3', 'omega 3', 'epa', 'dha'],
  },
  {
    key: 'magnesium',
    name: 'Magnesium',
    subtitle: 'Muscle and Nerve Health',
    defaultUnit: 'mg/dL',
    keywords: ['magnesium'],
  },
]

const PROTOCOL_LIBRARY = {
  ferritin: {
    supplement: 'Iron (Bisglycinate)',
    dose: '25 mg',
    schedule: 'Every other day',
  },
  'vitamin-d': {
    supplement: 'Vitamin D3 + K2',
    dose: '5000 IU + 100 mcg',
    schedule: 'Daily with meal',
  },
  'omega-3': {
    supplement: 'Omega-3 (EPA/DHA)',
    dose: '2000 mg',
    schedule: 'Daily with meal',
  },
  magnesium: {
    supplement: 'Magnesium Glycinate',
    dose: '300 mg',
    schedule: 'Before bed',
  },
  support: {
    supplement: 'Vitamin B Complex',
    dose: '1 capsule',
    schedule: 'Daily with meal',
  },
}

function markerMatch(name, keywords) {
  const normalized = String(name || '').toLowerCase()
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
}

function buildMarkerOverview(uploads, trends) {
  return CORE_MARKERS.map((config) => {
    const points = []
    let latestMarker = null

    uploads.forEach((upload) => {
      const markers = Array.isArray(upload?.biomarkers) ? upload.biomarkers : []
      const marker = markers.find((entry) => markerMatch(entry?.name, config.keywords))
      const value = toNumber(marker?.value)
      if (value == null) return

      points.push(value)
      latestMarker = marker
    })

    const latestValue = points.length ? points[points.length - 1] : null
    const firstValue = points.length ? points[0] : null
    const delta = firstValue != null && latestValue != null ? latestValue - firstValue : null
    const trend = trends.find((entry) => markerMatch(entry.name, config.keywords))
    const inRange =
      latestMarker
      && Number.isFinite(Number(latestMarker.ref_low))
      && Number.isFinite(Number(latestMarker.ref_high))
      && latestValue != null
        ? latestValue >= Number(latestMarker.ref_low) && latestValue <= Number(latestMarker.ref_high)
        : null

    const statusLabel =
      latestValue == null
        ? 'No data'
        : inRange == null
          ? (delta == null || delta >= 0 ? 'Improving' : 'Review')
          : inRange
            ? 'Optimal'
            : 'Needs focus'

    return {
      ...config,
      markerName: latestMarker?.name || config.name,
      unit: latestMarker?.unit || trend?.unit || config.defaultUnit || '',
      points,
      latestValue,
      firstValue,
      delta,
      statusLabel,
      trendPct: trend?.pct ?? null,
    }
  })
}

function buildProtocolRows(overviewCards) {
  const rows = []
  const included = new Set()

  overviewCards
    .slice()
    .sort((a, b) => {
      const scoreA = a.statusLabel === 'Needs focus' ? 0 : a.statusLabel === 'Review' ? 1 : 2
      const scoreB = b.statusLabel === 'Needs focus' ? 0 : b.statusLabel === 'Review' ? 1 : 2
      if (scoreA !== scoreB) return scoreA - scoreB
      return Math.abs(b.trendPct || 0) - Math.abs(a.trendPct || 0)
    })
    .forEach((card) => {
      if (included.has(card.key)) return
      const item = PROTOCOL_LIBRARY[card.key]
      if (!item) return
      rows.push(item)
      included.add(card.key)
    })

  if (!included.has('support')) {
    rows.push(PROTOCOL_LIBRARY.support)
  }

  return rows.slice(0, 5)
}

const TIMING_TO_LABEL = {
  morning: 'Daily in the morning',
  with_breakfast: 'Daily with breakfast',
  before_breakfast: 'Before breakfast',
  with_food: 'Daily with meal',
  with_lunch: 'Daily with lunch',
  afternoon: 'Daily in the afternoon',
  with_dinner: 'Daily with dinner',
  morning_with_food: 'Morning with meal',
  morning_empty: 'Morning on empty stomach',
  between_meals: 'Between meals',
  evening: 'Daily in the evening',
  night: 'Daily at night',
  before_bed: 'Before bed',
  bedtime: 'At bedtime',
}

function normalizeProtocolRow(item) {
  if (!item || typeof item !== 'object') return null

  const supplement = String(item.supplement || item.name || '').trim()
  if (!supplement) return null

  const dose = String(item.dosage || item.dose || '-').trim() || '-'
  const timingRaw = String(item.timing || item.schedule || '').trim()
  const schedule = TIMING_TO_LABEL[timingRaw] || timingRaw.replaceAll('_', ' ') || '-'

  return { supplement, dose, schedule }
}

function isGenericProtocolRow(row) {
  const text = `${row?.supplement || ''} ${row?.dose || ''} ${row?.schedule || ''}`.toLowerCase()
  return ['re-test', 'retest', 'follow up', 'follow-up', 'comprehensive'].some((token) => text.includes(token))
}

function sortProtocolRecommendations(rows) {
  const priorityWeight = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  return [...rows].sort((a, b) => {
    const prA = priorityWeight[String(a?.priority || '').toUpperCase()] ?? 9
    const prB = priorityWeight[String(b?.priority || '').toUpperCase()] ?? 9
    if (prA !== prB) return prA - prB
    return String(a?.supplement || '').localeCompare(String(b?.supplement || ''))
  })
}

function Sparkline({ points = [], color = '#14b8a6' }) {
  if (!Array.isArray(points) || points.length === 0) {
    return (
      <svg viewBox="0 0 100 30" className="h-10 w-full" role="img" aria-label="No trend data">
        <line x1="0" y1="16" x2="100" y2="16" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
      </svg>
    )
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const step = points.length > 1 ? 100 / (points.length - 1) : 0

  const polyline = points
    .map((value, index) => {
      const x = step * index
      const y = 26 - ((value - min) / range) * 20
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 100 30" className="h-10 w-full" role="img" aria-label="Biomarker trend">
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={step * (points.length - 1)}
        cy={26 - ((points[points.length - 1] - min) / range) * 20}
        r="2.8"
        fill={color}
      />
    </svg>
  )
}

function triggerSubscriptionRequiredPaywall() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'SUBSCRIPTION_REQUIRED' } }))
  }
}

async function executePhotoAction(action, onPaywall) {
  try {
    return await action()
  } catch (error) {
    if (error.response?.status === 402) {
      onPaywall()
      return null
    }
    throw error
  }
}

export default function Progress() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data = [], isLoading, isError, error, refetch } = useProgress()
  const { isActive: hasPremium, loading: subscriptionLoading, refresh: refreshSubscription } = useSubscription()
  const [photos, setPhotos] = useState([])
  const [protocolRowsFromDb, setProtocolRowsFromDb] = useState([])

  const uploadsWithBiomarkers = data.filter((upload) => Array.isArray(upload?.biomarkers) && upload.biomarkers.length > 0)
  const chronologicalUploads = useMemo(
    () => [...uploadsWithBiomarkers].sort((a, b) => {
      const aTime = new Date(a?.test_date || a?.created_at || 0).getTime()
      const bTime = new Date(b?.test_date || b?.created_at || 0).getTime()
      return aTime - bTime
    }),
    [uploadsWithBiomarkers]
  )
  const biomarkerTrends = useMemo(
    () => buildBiomarkerTrends(chronologicalUploads),
    [chronologicalUploads]
  )
  const improving = biomarkerTrends.filter((item) => item.pct > 0).slice(0, 6)
  const worsening = biomarkerTrends.filter((item) => item.pct < 0).slice(0, 6)
  const topMovement = biomarkerTrends.slice(0, 6)
  const overviewCards = useMemo(
    () => buildMarkerOverview(chronologicalUploads, biomarkerTrends),
    [chronologicalUploads, biomarkerTrends]
  )
  const fallbackProtocolRows = useMemo(
    () => buildProtocolRows(overviewCards),
    [overviewCards]
  )
  const latestUpload = chronologicalUploads[chronologicalUploads.length - 1] || null
  const latestUploadId = latestUpload?.id
  const latestMarkers = latestUpload?.biomarkers?.length || 0
  const momentumScore = biomarkerTrends.length
    ? Math.round((improving.length / biomarkerTrends.length) * 100)
    : 0

  useEffect(() => {
    let canceled = false

    async function loadLatestProtocol() {
      if (!latestUploadId) {
        if (!canceled) setProtocolRowsFromDb([])
        return
      }

      try {
        const { data: protocolRow, error: protocolError } = await supabase
          .from('protocols')
          .select('recommendations')
          .eq('upload_id', latestUploadId)
          .single()

        if (protocolError) {
          if (!canceled) setProtocolRowsFromDb([])
          return
        }

        const sourceRows = Array.isArray(protocolRow?.recommendations)
          ? protocolRow.recommendations
          : []
        const normalized = sortProtocolRecommendations(sourceRows)
          .map(normalizeProtocolRow)
          .filter(Boolean)
          .slice(0, 5)

        if (!canceled) {
          setProtocolRowsFromDb(normalized)
        }
      } catch {
        if (!canceled) setProtocolRowsFromDb([])
      }
    }

    loadLatestProtocol()

    return () => {
      canceled = true
    }
  }, [latestUploadId])

  const shouldUseDbProtocol = protocolRowsFromDb.length >= 3 && !protocolRowsFromDb.every(isGenericProtocolRow)
  const protocolRows = shouldUseDbProtocol ? protocolRowsFromDb : fallbackProtocolRows

  const handlePaywall = useCallback(() => {
    triggerSubscriptionRequiredPaywall()
  }, [])

  const handlePhotoUpload = async (formData) => {
    try {
      const response = await executePhotoAction(() => api.post('/progress/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }), handlePaywall)
      if (!response) {
        return
      }
      setPhotos((prev) => [...prev, response.data])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ])
    } catch (error) {
      console.error('Photo upload failed:', error)
      throw error
    }
  }

  const handlePhotoDelete = async (photoId) => {
    try {
      const deleted = await executePhotoAction(() => api.delete(`/progress/photos/${photoId}`), handlePaywall)
      if (!deleted) {
        return
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ])
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

  if (isError) {
    const isPaywallError = error?.response?.status === 402
    const shouldShowPremiumLock = isPaywallError && !subscriptionLoading && !hasPremium

    if (shouldShowPremiumLock) {
      return (
        <div className="mx-auto w-full max-w-6xl">
          <CabinetPageHeader
            title="Progress Tracker"
            subtitle="See how your biomarkers are changing over time. Upload multiple tests to track your improvements."
          />
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-8 text-center">
            <p className="text-lg font-semibold text-blue-900">📊 Advanced Trend Charts</p>
            <p className="mt-2 text-sm text-blue-700">Progress analytics is available on Premium plan.</p>
            <button
              onClick={handlePaywall}
              className="mt-4 rounded-lg bg-blue-600 hover:bg-blue-700 px-6 py-2 text-sm font-semibold text-white transition"
            >
              Unlock Premium
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="mx-auto w-full max-w-6xl">
        <CabinetPageHeader
          title="Progress Tracker"
          subtitle="See how your biomarkers are changing over time. Upload multiple tests to track your improvements."
        />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-lg font-semibold text-rose-900">Unable to load progress data</p>
          <p className="mt-2 text-sm text-rose-700">Please try again in a few seconds.</p>
          <button
            onClick={async () => {
              await refreshSubscription()
              await refetch()
            }}
            className="mt-4 rounded-lg bg-rose-600 hover:bg-rose-700 px-6 py-2 text-sm font-semibold text-white transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <CabinetPageHeader
        title="Progress Tracker"
        subtitle="Your main health momentum view: trends, biggest changes, and what to retest next."
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
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Biomarker Overview</h3>
                <p className="mt-1 text-sm text-slate-500">Track what matters. Optimize your health.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-teal-100 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700">
                <Sparkles className="h-4 w-4" />
                <div>
                  <p>AI Analysis</p>
                  <p className="text-xs font-medium text-teal-600">Updated today</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {overviewCards.map((card) => {
                const isGood = card.statusLabel === 'Optimal' || card.statusLabel === 'Improving'
                const isNoData = card.statusLabel === 'No data'
                return (
                  <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xl font-semibold text-slate-900">{card.name}</p>
                    <p className="text-sm text-slate-500">{card.subtitle}</p>
                    <p className="mt-4 text-5xl font-bold leading-none text-slate-900">{shortMetricValue(card.latestValue)}</p>
                    <p className="mt-1 text-sm font-medium text-slate-600">{card.unit || 'value'}</p>
                    <div className="mt-3">
                      <Sparkline points={card.points} color={isNoData ? '#94a3b8' : isGood ? '#14b8a6' : '#f59e0b'} />
                    </div>
                    <p className={`mt-3 text-sm font-semibold ${isNoData ? 'text-slate-500' : isGood ? 'text-teal-700' : 'text-amber-700'}`}>
                      {card.latestValue == null
                        ? 'Add more uploads to unlock trend'
                        : card.delta == null
                        ? 'No historical delta yet'
                        : `${card.delta >= 0 ? '↑' : '↓'} ${shortMetricValue(Math.abs(card.delta))} from ${shortMetricValue(card.firstValue)}`}
                    </p>
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isNoData ? 'bg-slate-100 text-slate-600' : isGood ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
                      {card.statusLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            <h3 className="text-2xl font-bold text-slate-900">Your Personalized Protocol</h3>
            <p className="mt-1 text-sm text-slate-500">AI-designed based on your labs, goals and health data.</p>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="hidden grid-cols-[minmax(0,1fr)_140px_160px] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                  <span>Supplement</span>
                  <span>Dose</span>
                  <span>Timing</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {protocolRows.map((row) => (
                    <div key={row.supplement} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_140px_160px] sm:items-center">
                      <p className="font-semibold text-slate-900">{row.supplement}</p>
                      <p className="text-sm text-slate-600">{row.dose}</p>
                      <p className="text-sm text-slate-600">{row.schedule}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
                <p className="text-lg font-semibold text-slate-900">Why these?</p>
                <ul className="mt-3 space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    Targets your lowest biomarkers first
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    Supports your energy, recovery and focus goals
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    Aligned with biomarker trends and reference ranges
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    Safe and practical dosage cadence
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lab uploads</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest markers</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{latestMarkers}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compared biomarkers</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{biomarkerTrends.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Momentum score</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{momentumScore}%</p>
            </div>
          </div>

          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Top improvements</p>
              <p className="mt-1 text-xs text-slate-500">Largest positive shifts between first and latest upload.</p>
              <div className="mt-4 space-y-3">
                {improving.length > 0 ? improving.map((item) => (
                  <div key={item.name} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm font-bold text-emerald-700">+{item.pct}%</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {formatMetricValue(item.start)} → {formatMetricValue(item.end)}{item.unit ? ` ${item.unit}` : ''}
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-emerald-100">
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(Math.abs(item.pct), 100)}%` }} />
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">Not enough comparable biomarker data yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Needs attention</p>
              <p className="mt-1 text-xs text-slate-500">Markers with negative movement that may need protocol adjustment.</p>
              <div className="mt-4 space-y-3">
                {worsening.length > 0 ? worsening.map((item) => (
                  <div key={item.name} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm font-bold text-amber-700">{item.pct}%</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {formatMetricValue(item.start)} → {formatMetricValue(item.end)}{item.unit ? ` ${item.unit}` : ''}
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-amber-100">
                      <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${Math.min(Math.abs(item.pct), 100)}%` }} />
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No negative trends detected in comparable biomarkers.</p>
                )}
              </div>
            </div>
          </div>

          {topMovement.length > 0 && (
            <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Biggest biomarker movements</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {topMovement.map((item) => (
                  <div key={item.name} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.name}</p>
                    <p className={`mt-1 text-lg font-bold ${item.direction === 'up' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {item.direction === 'up' ? '↑' : '↓'} {Math.abs(item.pct)}%
                    </p>
                    <p className="text-xs text-slate-600">
                      {formatMetricValue(item.start)} → {formatMetricValue(item.end)}{item.unit ? ` ${item.unit}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadsWithBiomarkers.length >= 2 ? (
            <div className="mb-8">
              <ProgressChart data={uploadsWithBiomarkers} />
            </div>
          ) : (
            <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
              Upload at least 2 tests to unlock timeline chart comparisons.
            </div>
          )}

          {/* Upload Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 mb-8"
          >
            <p className="mb-1 text-lg font-semibold text-slate-900">Retest Timeline</p>
            <p className="mb-5 text-sm text-slate-500">Chronological history of your uploads to keep retest cadence visible.</p>
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
