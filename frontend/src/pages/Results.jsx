import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api.js'
import ProtocolCard from '../components/ProtocolCard.jsx'
import Paywall from '../components/Paywall.jsx'
import { useSubscription } from '../hooks/useSubscription.js'
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

const RESULTS_HINTS = [
  '� Your results are color-coded: Green = optimal, Yellow = borderline, Red = needs attention. Focus on red markers first.',
  '🎯 The position indicator shows where your value falls within the reference range. 50% means you\'re right in the middle!',
  '💡 Clinical interpretation provides context for what your results mean for your health.',
  '🔬 Regular testing helps track trends and measure the impact of your health interventions.',
]

export default function Results() {
  const { uploadId } = useParams()
  const navigate = useNavigate()
  const { isActive } = useSubscription()
  const { show: showHints, dismiss: dismissHints } = useTourHints('results')
  const [biomarkers, setBiomarkers] = useState([])
  const [protocol, setProtocol] = useState([])
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

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading…</div>

  const rankedBiomarkers = [...biomarkers].sort((a, b) => scoreStatus(a.status) - scoreStatus(b.status))
  const deficient = biomarkers.filter((b) => b.status === 'DEFICIENT' || b.status === 'ELEVATED')
  const optimal = biomarkers.filter((b) => b.status === 'OPTIMAL').length
  const borderline = biomarkers.filter((b) => b.status === 'BORDERLINE').length
  const topPriority = rankedBiomarkers.find((b) => String(b.status || '').toUpperCase() !== 'OPTIMAL') || rankedBiomarkers[0] || null

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
          <h3 className="text-xl font-bold text-slate-900 mb-4">Health Insights</h3>
          <div className="grid gap-4">
            {deficient.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-rose-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-rose-900 mb-2">Priority Biomarkers Requiring Attention</h4>
                    <p className="text-rose-700 mb-3">
                      These markers are outside the optimal range and may indicate areas needing immediate focus.
                      Consider discussing these results with your healthcare provider.
                    </p>
                    <BiomarkerAlertsDisplay
                      biomarkers={rankedBiomarkers}
                      previousBiomarkers={[]}
                      userPreferences={{}}
                    />
                  </div>
                </div>
              </div>
            )}

            {optimal > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-emerald-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-emerald-900 mb-2">Well-Managed Biomarkers</h4>
                    <p className="text-emerald-700">
                      Great job maintaining these markers within optimal ranges! Continue your current health practices.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {topPriority && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Top priority</div>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Your #1 priority: {topPriority.name} ({formatMetric(topPriority)})
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
              const status = String(b.status || '').toUpperCase()
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
                <div key={b.id} className={`relative overflow-hidden rounded-xl border bg-white p-6 ${meta.border} shadow-sm`}>
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${meta.stripe}`} aria-hidden="true" />

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-slate-900 mb-1">{b.name}</h4>
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
            biomarkers={rankedBiomarkers}
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

          {isActive ? (
            <div className="space-y-4">
              {protocol.map((rec, i) => <ProtocolCard key={i} recommendation={rec} />)}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-8 text-center">
              <div className="max-w-md mx-auto">
                <Activity className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-slate-900 mb-2">Unlock Your Personalized Protocol</h4>
                <p className="text-slate-600 mb-6">
                  Get AI-powered supplement recommendations tailored to your specific biomarker results and health goals.
                </p>
                <Paywall />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
