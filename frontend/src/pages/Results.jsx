import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api.js'
import ProtocolCard from '../components/ProtocolCard.jsx'
import FeatureGate from '../components/FeatureGate.jsx'
import HintBanner from '../components/tour/HintBanner.jsx'
import { useTourHints } from '../hooks/useTourHints.js'
import BiomarkerAlertsDisplay from '../components/BiomarkerAlertsDisplay.jsx'
import HealthTipsDisplay from '../components/HealthTipsDisplay.jsx'
import { ArrowLeft, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info, Activity } from 'lucide-react'

const STATUS_META = {
  DEFICIENT: { rank: 0, border: 'border-rose-300', stripe: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700', text: 'text-rose-700' },
  ELEVATED: { rank: 1, border: 'border-orange-300', stripe: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700', text: 'text-orange-700' },
  BORDERLINE: { rank: 2, border: 'border-amber-300', stripe: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700', text: 'text-amber-700' },
  OPTIMAL: { rank: 3, border: 'border-emerald-300', stripe: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700' },
}

const BIOMARKER_NAME_TRANSLATIONS = [
  [/^Ретикулоцити\s*\(%\)$/i, 'Reticulocytes (%)'],
  [/^Ретикулоцити\s*\(Г\/л\)$/i, 'Reticulocytes (G/L)'],
  [/^Ретикулоцити$/i, 'Reticulocytes'],
  [/^Незрілі ретикулоцити$/i, 'Immature Reticulocytes'],
  [/^Зрілі ретикулоцити\s*\(%\)$/i, 'Mature Reticulocytes (%)'],
  [/^Зрілі ретикулоцити\s*\(Т\/л\)$/i, 'Mature Reticulocytes (T/L)'],
  [/^Зрілі ретикулоцити$/i, 'Mature Reticulocytes'],
  [/^Середній об['’]єм ретикулоцита$/i, 'Mean Reticulocyte Volume'],
  [/^Середній об['’]єм сферичних клітин$/i, 'Mean Spherized Cell Volume'],
  [/^Ширина розподілення ретикулоцитів по об['’]єму$/i, 'Reticulocyte Volume Distribution Width'],
]

function toEnglishBiomarkerName(name) {
  const raw = String(name || '').trim()
  for (const [pattern, translated] of BIOMARKER_NAME_TRANSLATIONS) {
    if (pattern.test(raw)) return translated
  }
  return raw
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

function normalizeBiomarkerStatus(biomarker) {
  const raw = String(biomarker?.status || '').trim().toUpperCase()
  const mapped = {
    OPTIMAL: 'OPTIMAL',
    NORMAL: 'OPTIMAL',
    N: 'OPTIMAL',
    BORDERLINE: 'BORDERLINE',
    'LOW NORMAL': 'BORDERLINE',
    'HIGH NORMAL': 'BORDERLINE',
    LOW: 'DEFICIENT',
    L: 'DEFICIENT',
    DEFICIENT: 'DEFICIENT',
    HIGH: 'ELEVATED',
    H: 'ELEVATED',
    ELEVATED: 'ELEVATED',
    CRITICAL: 'ELEVATED',
  }
  if (mapped[raw]) return mapped[raw]

  const low = Number(biomarker?.ref_low)
  const high = Number(biomarker?.ref_high)
  const value = Number(biomarker?.value)
  if (Number.isFinite(low) && Number.isFinite(high) && Number.isFinite(value) && high > low) {
    if (value < low) return 'DEFICIENT'
    if (value > high) return 'ELEVATED'
    const band = high - low
    const lowerWarn = low + band * 0.15
    const upperWarn = high - band * 0.15
    if (value <= lowerWarn || value >= upperWarn) return 'BORDERLINE'
    return 'OPTIMAL'
  }

  return 'BORDERLINE'
}

const RESULTS_HINTS = [
  '� Your results are color-coded: Green = optimal, Yellow = borderline, Red = needs attention. Focus on red markers first.',
  '🎯 The position indicator shows where your value falls within the reference range. 50% means you\'re right in the middle!',
  '💡 Clinical interpretation provides context for what your results mean for your health.',
  '🔬 Regular testing helps track trends and measure the impact of your health interventions.',
]

export default function Results() {
  const { uploadId } = useParams()
  const navigate = useNavigate()
  const { show: showHints, dismiss: dismissHints } = useTourHints('results')
  const [biomarkers, setBiomarkers] = useState([])
  const [protocol, setProtocol] = useState([])
  const [medicalAnalysis, setMedicalAnalysis] = useState(null)
  const [medicalAnalysisLoading, setMedicalAnalysisLoading] = useState(false)
  const [medicalAnalysisError, setMedicalAnalysisError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/results/${uploadId}`)
        setBiomarkers(data.biomarkers ?? [])
        setProtocol(data.protocol ?? [])
      } catch (e) {
        setBiomarkers([])
        setProtocol([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [uploadId])

  const normalizedBiomarkers = biomarkers.map((b) => {
    const normalizedStatus = normalizeBiomarkerStatus(b)
    return {
      ...b,
      name_en: toEnglishBiomarkerName(b?.name),
      status_normalized: normalizedStatus,
    }
  })

  useEffect(() => {
    if (!biomarkers.length) {
      setMedicalAnalysis(null)
      setMedicalAnalysisError('')
      return
    }

    let active = true

    async function runMedicalMicroserviceAnalysis() {
      setMedicalAnalysisLoading(true)
      setMedicalAnalysisError('')

      try {
        const lines = normalizedBiomarkers.map((b) => {
          const low = b?.ref_low != null ? String(b.ref_low) : ''
          const high = b?.ref_high != null ? String(b.ref_high) : ''
          const rangePart = low && high ? ` (${low}-${high})` : ''
          const unitPart = b?.unit ? ` ${b.unit}` : ''
          return `${b?.name_en || 'Unknown'}: ${b?.value ?? '--'}${unitPart}${rangePart}`
        })

        const formData = new FormData()
        formData.append('text', lines.join('\n'))

        const response = await fetch('/api/v1/analyze/text', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Medical analysis failed: ${response.status}`)
        }

        const payload = await response.json()
        if (active) {
          setMedicalAnalysis(payload)
        }
      } catch (err) {
        if (active) {
          setMedicalAnalysis(null)
          setMedicalAnalysisError('Medical microservice analysis is temporarily unavailable.')
        }
      } finally {
        if (active) {
          setMedicalAnalysisLoading(false)
        }
      }
    }

    runMedicalMicroserviceAnalysis()

    return () => {
      active = false
    }
  }, [biomarkers, normalizedBiomarkers])

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading…</div>

  const rankedBiomarkers = [...normalizedBiomarkers].sort((a, b) => scoreStatus(a.status_normalized) - scoreStatus(b.status_normalized))
  const deficient = normalizedBiomarkers.filter((b) => {
    const status = b.status_normalized
    return status === 'DEFICIENT' || status === 'ELEVATED'
  })
  const optimal = normalizedBiomarkers.filter((b) => b.status_normalized === 'OPTIMAL').length
  const borderline = normalizedBiomarkers.filter((b) => b.status_normalized === 'BORDERLINE').length
  const topPriority = rankedBiomarkers.find((b) => b.status_normalized !== 'OPTIMAL') || rankedBiomarkers[0] || null
  const hasActionable = deficient.length + borderline > 0

  async function exportResultsAsPDF() {
    const node = document.querySelector('.vtl-page')
    if (!node) return

    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).jsPDF

      const canvas = await html2canvas(node, { scale: 2 })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight)
      pdf.save('lab-results.pdf')
    } catch (err) {
      console.error('Failed to export PDF', err)
    }
  }

  async function exportResultsAsPNG() {
    const node = document.querySelector('.vtl-page')
    if (!node) return

    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(node, { scale: 2 })
      const link = document.createElement('a')
      link.download = 'lab-results.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Failed to export PNG', err)
    }
  }

  return (
    <div className="vtl-page min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/lab-results')}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lab Results
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Lab Results Analysis</h1>
          <p className="text-slate-600">Detailed breakdown of your biomarkers with personalized insights</p>
        </div>

        {showHints && (
          <HintBanner hints={RESULTS_HINTS} onDone={dismissHints} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="vtl-light-card p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-6 w-6 text-emerald-600 mr-2" />
              <div className="text-2xl font-bold text-emerald-600">{optimal}</div>
            </div>
            <div className="text-sm font-medium text-slate-900 mb-1">Optimal</div>
            <div className="text-xs text-slate-500">Within healthy range</div>
          </div>
          <div className="vtl-light-card p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <Info className="h-6 w-6 text-amber-600 mr-2" />
              <div className="text-2xl font-bold text-amber-600">{borderline}</div>
            </div>
            <div className="text-sm font-medium text-slate-900 mb-1">Borderline</div>
            <div className="text-xs text-slate-500">Monitor closely</div>
          </div>
          <div className="vtl-light-card p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-rose-600 mr-2" />
              <div className="text-2xl font-bold text-rose-600">{deficient.length}</div>
            </div>
            <div className="text-sm font-medium text-slate-900 mb-1">Needs Attention</div>
            <div className="text-xs text-slate-500">Requires action</div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Results Table</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Biomarker</th>
                  <th className="px-4 py-3 text-left font-semibold">Value</th>
                  <th className="px-4 py-3 text-left font-semibold">Unit</th>
                  <th className="px-4 py-3 text-left font-semibold">Reference Range</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rankedBiomarkers.map((b, idx) => (
                  <tr key={b.id || `${b.name}-${idx}`} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-900">{b.name_en || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.value ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.unit || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.ref_low != null && b.ref_high != null ? `${b.ref_low} - ${b.ref_high}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.status_normalized}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Medical Microservice Analysis</h3>
          {medicalAnalysisLoading && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Running medical analysis...
            </div>
          )}

          {!medicalAnalysisLoading && medicalAnalysisError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {medicalAnalysisError}
            </div>
          )}

          {!medicalAnalysisLoading && medicalAnalysis && (
            <div className="space-y-4">
              {!!(medicalAnalysis.biomarkers || []).length ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Biomarker</th>
                        <th className="px-4 py-3 text-left font-semibold">Value</th>
                        <th className="px-4 py-3 text-left font-semibold">Unit</th>
                        <th className="px-4 py-3 text-left font-semibold">Category</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(medicalAnalysis.biomarkers || []).map((item, idx) => (
                        <tr key={`${item.key || item.name || 'm'}-${idx}`} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-900">{item.name || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{item.value ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{item.unit || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{item.category || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{item.status || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  No additional microservice interpretation is available for this panel yet.
                </div>
              )}

              {!!(medicalAnalysis.recommendations || []).length && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <h4 className="mb-1 text-base font-semibold text-slate-900">Microservice Recommendations</h4>
                  <p className="mb-3 text-sm text-slate-600">
                    These suggestions come from the separate medical microservice and are supplemental to the biomarker interpretation below.
                  </p>
                  <ul className="list-disc pl-5 text-base text-slate-800">
                    {(medicalAnalysis.recommendations || []).map((r, idx) => (
                      <li key={`rec-${idx}`}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Health Insights</h3>
          <div className="grid gap-4">
            {hasActionable ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-rose-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-rose-900 mb-2">What Needs Action Now</h4>
                    <p className="text-rose-700 mb-3">
                      Prioritize these biomarkers first, then re-test to confirm movement toward range.
                    </p>
                    <ul className="space-y-2 text-sm text-rose-900">
                      {rankedBiomarkers
                        .filter((b) => b.status_normalized !== 'OPTIMAL')
                        .slice(0, 5)
                        .map((b, idx) => (
                          <li key={`${b.id || b.name_en}-${idx}`} className="rounded-lg bg-white/70 px-3 py-2 border border-rose-100">
                            <span className="font-semibold">{b.name_en}</span>
                            <span className="mx-2">•</span>
                            <span>{b.value} {b.unit}</span>
                            <span className="mx-2">•</span>
                            <span className="uppercase">{b.status_normalized}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-emerald-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-emerald-900 mb-2">Current Panel Looks Stable</h4>
                    <p className="text-emerald-700">
                      Most biomarkers are in range. Keep your current routine and monitor trends over time.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h4 className="font-semibold text-slate-900 mb-2">How to use this section</h4>
              <p className="text-sm text-slate-600 mb-3">
                Health Insights is a triage layer. It does not replace diagnosis and should be interpreted with your clinician.
              </p>
              <BiomarkerAlertsDisplay
                biomarkers={rankedBiomarkers}
                previousBiomarkers={[]}
                userPreferences={{}}
              />
            </div>
          </div>
        </div>

        {topPriority && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Top priority</div>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Your #1 priority: {topPriority.name_en} ({formatMetric(topPriority)})
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

        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Biomarker Analysis</h3>
          <div className="grid gap-4">
            {rankedBiomarkers.map((b) => {
              const status = b.status_normalized
              const meta = STATUS_META[status] || STATUS_META.BORDERLINE
              const rangeLabel = b.ref_low != null && b.ref_high != null ? `${b.ref_low}-${b.ref_high} ${b.unit || ''}`.trim() : 'No reference range'
              const bar = computeRangePercent(b)
              const value = Number(b.value)
              const low = Number(b.ref_low)
              const high = Number(b.ref_high)

              // Determine trend icon and interpretation
              let trendIcon = <Minus className="h-4 w-4 text-slate-400" />
              let trendText = "Within range"
              let trendColor = "text-slate-600"

              if (value < low) {
                trendIcon = <TrendingDown className="h-4 w-4 text-blue-600" />
                trendText = "Below normal range"
                trendColor = "text-blue-600"
              } else if (value > high) {
                trendIcon = <TrendingUp className="h-4 w-4 text-rose-600" />
                trendText = "Above normal range"
                trendColor = "text-rose-600"
              }

              return (
                <div key={b.id || `${b.name_en}-${b.value}`} className={`relative overflow-hidden rounded-xl border bg-white p-6 ${meta.border} shadow-sm`}>
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${meta.stripe}`} aria-hidden="true" />

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-slate-900 mb-1">{b.name_en}</h4>
                      <div className="flex items-center gap-2 mb-2">
                        {trendIcon}
                        <span className={`text-sm font-medium ${trendColor}`}>{trendText}</span>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${meta.badge}`}>{status}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-slate-900 mb-1">
                        {b.value}
                        <span className="text-lg font-medium text-slate-500 ml-1">{b.unit}</span>
                      </div>
                      <div className="text-sm text-slate-600">Your Value</div>
                    </div>

                    <div className="text-center">
                      <div className="text-3xl font-bold text-slate-700 mb-1">{rangeLabel}</div>
                      <div className="text-sm text-slate-600">Reference Range</div>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Activity className="h-5 w-5 text-slate-600 mr-2" />
                        <span className="text-3xl font-bold text-slate-700">
                          {bar.toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">Range Position</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-slate-600 mb-2">
                      <span>{b.ref_low || 'Min'}</span>
                      <span>{b.ref_high || 'Max'}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 relative">
                      <div className={`h-full rounded-full ${meta.stripe}`} style={{ width: `${Math.min(bar, 100)}%` }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-1 h-1 bg-slate-900 rounded-full" style={{ left: `${Math.min(bar, 100)}%`, transform: 'translateX(-50%)' }} />
                      </div>
                    </div>
                  </div>

                  {b.interpretation && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-slate-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h5 className="font-medium text-slate-900 mb-1">Clinical Interpretation</h5>
                          <p className="text-sm text-slate-700">{b.interpretation}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <button
            onClick={exportResultsAsPDF}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-900 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            Export as PDF
          </button>
          <button
            onClick={exportResultsAsPNG}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-900 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            Export as PNG
          </button>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Health Optimization Tips</h3>
          <HealthTipsDisplay
            biomarkers={rankedBiomarkers.map((b) => ({ ...b, name: b.name_en, status: b.status_normalized }))}
            userContext={{
              age: 30,
              lifestyle: 'active',
              goals: ['improve energy', 'optimize recovery'],
              protocol_adherence: 'high'
            }}
          />
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Personalized Supplement Protocol</h3>
              <p className="text-slate-600 mt-1">AI-generated recommendations based on your biomarker results</p>
            </div>
            <button
              onClick={() => navigate(`/protocol/${uploadId}`)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
            >
              View Full Protocol →
            </button>
          </div>

          <FeatureGate
            feature="basic_protocol"
            onLocked={() => window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'SUBSCRIPTION_REQUIRED' } }))}
            fallback={
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-8 text-center">
                <div className="max-w-md mx-auto">
                  <Activity className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-slate-900 mb-2">Unlock Your Personalized Protocol</h4>
                  <p className="text-slate-600 mb-6">
                    Get AI-powered supplement recommendations tailored to your specific biomarker results and health goals.
                  </p>
                </div>
              </div>
            }
          >
            {protocol.length > 0 ? (
              <div className="space-y-4">
                {protocol.map((rec, i) => <ProtocolCard key={i} recommendation={rec} />)}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h4 className="text-base font-semibold text-slate-900 mb-1">Protocol is not generated yet</h4>
                <p className="text-sm text-slate-600 mb-4">
                  This section shows personalized supplement actions after protocol generation. It is empty for this upload right now.
                </p>
                <button
                  onClick={() => navigate(`/protocol/${uploadId}`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  Generate / Open Protocol
                </button>
              </div>
            )}
          </FeatureGate>
        </div>
      </div>
    </div>
  )
}
