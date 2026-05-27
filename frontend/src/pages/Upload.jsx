import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Building2, ShieldCheck, Sparkles, UserCircle2 } from 'lucide-react'
import HintBanner from '../components/tour/HintBanner.jsx'
import { useTourHints } from '../hooks/useTourHints.js'
import { useSubscription } from '../hooks/useSubscription.js'
import UploadZone from '../components/UploadZone.jsx'
import SymptomSelector from '../components/SymptomSelector.jsx'
import ManualBiomarkerEntry from '../components/ManualBiomarkerEntry.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import AnalysisProgressIndicator from '../components/AnalysisProgressIndicator.jsx'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaLabUpload } from '../lib/analytics.js'
import toast from 'react-hot-toast'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import '../styles/dashboard2026.css'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

// Support all file formats: PDF, images, and tables
const SUPPORTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/bmp': ['.bmp'],
  'image/webp': ['.webp'],
  'image/tiff': ['.tiff', '.tif'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
}

const UPLOAD_HINTS = [
  '📄 Upload your lab report PDF. It is sent directly to our secure AI analysis pipeline for full-report interpretation.',
  '💊 Add current symptoms before uploading. The AI uses them to prioritize which biomarkers are most relevant to your situation.',
  '✅ After upload you\'ll see a color-coded biomarker breakdown and a personalized supplement protocol — all generated automatically.',
]

const LOADING_MESSAGES = [
  '📤 Uploading your lab report...',
  '🧠 AI is analyzing your biomarkers...',
  '📋 Generating your personalized protocol...',
  '💊 Finalizing supplement recommendations...',
  '✅ Almost ready...',
]

function triggerPaywall(detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail }))
  }
}

// Helper functions for Upload component
function validateFileInput(file) {
  if (!file) return 'No file selected. Please choose a lab report.'

  // Check if file type is supported
  const filename = (file.name || '').toLowerCase()
  const supportedExtensions = new Set()

  Object.values(SUPPORTED_FILE_TYPES).forEach(exts => {
    exts.forEach(ext => supportedExtensions.add(ext))
  })

  const hasValidExtension = Array.from(supportedExtensions).some(ext => filename.endsWith(ext))

  if (!hasValidExtension && !Object.keys(SUPPORTED_FILE_TYPES).includes(file.type)) {
    return 'Unsupported file type. Please upload PDF, image (PNG, JPG, GIF), or spreadsheet (XLSX, CSV).'
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'File is too large. Please upload a file under 20MB.'
  }

  return ''
}

function build402ErrorMessage({ errorCode, errorDetail, usedBy }) {
  if (errorCode === 'BIOMARKER_QUOTA_EXCEEDED') {
    if (usedBy === 'manual') {
      return 'You\'ve already entered biomarkers manually. Free plan includes 1 lab analysis (either PDF upload or manual entry). Upgrade to Premium for unlimited analyses, advanced protocols, and health tracking.'
    }
    return errorDetail || 'You\'ve reached your free analysis limit (1 per month). Upgrade to Premium for unlimited lab uploads, AI-generated protocols, and personalized health insights.'
  }
  if (errorCode === 'UPLOAD_LIMIT_REACHED') {
    return 'You\'ve reached your free analysis limit. Upgrade to Premium for unlimited lab uploads and advanced health tracking.'
  }
  return errorDetail || 'Premium required for this feature. Upgrade to unlock unlimited analyses and personalized protocols.'
}

function maybeTriggerPaywall({ status, errorCode, usedBy }) {
  if (status !== 402) return
  if (errorCode === 'BIOMARKER_QUOTA_EXCEEDED') {
    triggerPaywall({ reason: 'BIOMARKER_QUOTA_EXCEEDED', used_by: usedBy })
    return
  }
  triggerPaywall({ reason: 'SUBSCRIPTION_REQUIRED' })
}

function resolveAnalysisErrorMessage({ status, errorCode, errorDetail, usedBy }) {
  if (status === 402) {
    return build402ErrorMessage({ errorCode, errorDetail, usedBy })
  }

  if (status === 422) {
    if (errorCode === 'BIOMARKERS_NOT_EXTRACTED') {
      return 'Could not detect biomarkers in this report format. Try a clearer full-page PDF with names, values, and ranges visible.'
    }
    return 'Lab report format not recognized. Please upload a standard lab PDF.'
  }

  if (status === 400 && errorCode === 'INVALID_FILE_TYPE') {
    return 'Please upload a valid PDF file.'
  }

  if (status === 413) {
    return 'File too large for processing. Please upload a file under 20MB.'
  }

  if (status === 429) {
    return 'Too many uploads. Please wait and try again later.'
  }

  return errorDetail || 'Analysis failed. Please try again.'
}

function handleAnalysisError(err) {
  const errorData = err.response?.data || {}
  const status = err.response?.status

  // Handle nested error structure: detail contains {detail, code, used_by}
  const innerError = typeof errorData?.detail === 'object' ? errorData.detail : errorData
  const errorCode = innerError?.code || errorData?.code
  const errorDetail = typeof innerError?.detail === 'string' ? innerError.detail : typeof errorData?.detail === 'string' ? errorData.detail : null
  const usedBy = innerError?.used_by || errorData?.used_by

  maybeTriggerPaywall({ status, errorCode, usedBy })
  return resolveAnalysisErrorMessage({ status, errorCode, errorDetail, usedBy })
}

export default function Upload() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isPremium, uploadsRemaining, loading: subLoading } = useSubscription()
  const { show: showHints, dismiss: dismissHints } = useTourHints('upload')
  const [uploadMode, setUploadMode] = useState('pdf') // 'pdf' | 'manual'
  const [symptoms, setSymptoms] = useState([])
  const [labName, setLabName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [profileIncomplete, setProfileIncomplete] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0])
  const [loadingWarning, setLoadingWarning] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    api.get('/auth/onboarding/state').then(r => {
      const checklist = r.data?.checklist || {}
      const isComplete = r.data?.completed === true
      if (!isComplete && !checklist.profile_basics) {
        setProfileIncomplete(true)
      }
    }).catch((err) => {
      console.error('Failed to load onboarding state:', err)
      // Continue without blocking - onboarding check is optional
    })
  }, [])

  const isBusy = analyzing
  const [retryCount, setRetryCount] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)

  useEffect(() => {
    if (!analyzing) {
      setLoadingWarning('')
      setElapsedSeconds(0)
      return
    }

    setLoadingMessage(LOADING_MESSAGES[0])
    setElapsedSeconds(0)

    // Timer for elapsed seconds
    const elapsedTimer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)

    const timers = [
      setTimeout(() => setLoadingMessage(LOADING_MESSAGES[1]), 3000),
      setTimeout(() => setLoadingMessage(LOADING_MESSAGES[2]), 15000),
      setTimeout(() => setLoadingMessage(LOADING_MESSAGES[3]), 25000),
      setTimeout(() => setLoadingMessage(LOADING_MESSAGES[4]), 35000),
      setTimeout(() => setLoadingWarning('This is taking longer than usual. Large PDFs may take 1-2 minutes.'), 60000),
    ]

    return () => {
      clearInterval(elapsedTimer)
      timers.forEach(clearTimeout)
    }
  }, [analyzing])

  async function handleFile(file) {
    if (isBusy) return

    const validationError = validateFileInput(file)
    if (validationError) {
      setErrorMessage(validationError)
      toast.error(validationError)
      return
    }

    setErrorMessage('')
    setSelectedFileName(file.name)
    setSelectedFile(file)
    setRetryCount(0)

    toast(`Uploading ${file.name}… (${(file.size / 1024).toFixed(0)}KB)`, { icon: '📄' })

    setAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (labName) {
        formData.append('lab_name', labName)
      }
      symptoms.forEach((symptom) => formData.append('symptoms', symptom))

      const { data } = await api.post('/analyze/pdf', formData)

      trackFunnelEvent('funnel_first_upload_completed', 'User completed first lab upload analysis', {
        upload_id: data.upload_id,
        symptoms_count: symptoms.length,
        has_lab_name: Boolean(labName),
      }, { oncePerSession: true })
      gaLabUpload()

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['lab-results-list'] }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
        queryClient.invalidateQueries({ queryKey: ['health-score'] }),
      ])

      toast.success('Analysis complete!')
      navigate(`/results/${data.upload_id}`)
    } catch (err) {
      const message = handleAnalysisError(err)
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleRetry() {
    if (!selectedFile || retryCount >= 3) return
    setRetryCount(prev => prev + 1)
    setErrorMessage('')
    await handleFile(selectedFile)
  }

  const handleAnalyzeManual = (result) => {
    // Same behavior as PDF upload - navigate to results with analysis
    trackFunnelEvent('funnel_first_upload_completed', 'User completed first manual biomarker entry', {
      upload_id: result.upload_id,
      biomarker_count: result.biomarkers?.length || 0,
      source: 'manual',
    }, { oncePerSession: true })
    gaLabUpload()
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['lab-results-list'] }),
      queryClient.invalidateQueries({ queryKey: ['progress'] }),
      queryClient.invalidateQueries({ queryKey: ['timeline'] }),
      queryClient.invalidateQueries({ queryKey: ['insights'] }),
      queryClient.invalidateQueries({ queryKey: ['health-score'] }),
    ]).finally(() => {
      toast.success('Analysis complete!')
      navigate(`/results/${result.upload_id}`)
    })
  }

  const handleLoadingManual = (isLoading) => {
    // Optional: could synchronize loading state if needed
    if (isLoading) {
      setAnalyzing(true)
    } else {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-6xl">
        <CabinetPageHeader
          title="Upload Lab Results"
          subtitle="Your file is processed locally first. Only analysis-ready values are sent for analysis."
          helper="Upload report -> add optional symptoms -> open biomarkers and generated protocol."
        />

        {/* Tab Switcher */}
        <div className="mb-6 flex gap-3 border-b border-slate-200">
          <button
            onClick={() => setUploadMode('pdf')}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${
              uploadMode === 'pdf'
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            📄 Upload Lab Report
          </button>
          <button
            onClick={() => setUploadMode('manual')}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${
              uploadMode === 'manual'
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ✋ Enter Manually
          </button>
        </div>

        {showHints && (
          <HintBanner hints={UPLOAD_HINTS} onDone={dismissHints} />
        )}

        {uploadMode === 'pdf' && profileIncomplete && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-sm">
            <UserCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div className="flex-1">
              <p className="font-semibold text-blue-800">Your health profile is incomplete</p>
              <p className="mt-0.5 text-blue-700">A complete profile (height, weight, goals, medications) helps the AI and nutritionist give you more accurate, personalized analysis. You can still upload, but completing your profile first is recommended.</p>
            </div>
            <button
              onClick={() => navigate('/onboarding')}
              className="ml-1 shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              Complete profile
            </button>
          </div>
        )}

        {uploadMode === 'pdf' && !subLoading && !isPremium && uploadsRemaining === 0 && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>
              Your free biomarker entry was already used. You can upload a PDF OR enter manually, but not both.
            </span>
            <button
              onClick={() => triggerPaywall({ reason: 'BIOMARKER_QUOTA_EXCEEDED' })}
              className="ml-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition"
            >
              Upgrade {PREMIUM_PRICE_LABEL}
            </button>
          </div>
        )}

        {uploadMode === 'pdf' && !subLoading && !isPremium && uploadsRemaining > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Free plan: 1 biomarker entry allowed (via PDF upload or manual entry).
          </div>
        )}

        {uploadMode === 'pdf' ? (
          <>
            <div className="mb-6 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Private first</div>
                <p className="text-sm text-slate-500">Your PDF goes through secure AI analysis for full-report interpretation and structured recommendations.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Sparkles className="h-4 w-4 text-emerald-600" /> What unlocks next</div>
                <p className="text-sm text-slate-500">One upload should open biomarkers, protocol, trends, and clearer assignments instead of a dead-end result page.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><AlertCircle className="h-4 w-4 text-amber-500" /> Best results</div>
                <p className="text-sm text-slate-500">Use a full-page PDF or a sharp photo where marker names, values, ranges, and units are clearly visible.</p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className={`rounded-xl border px-3 py-2 ${analyzing ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                1. Upload PDF
              </div>
              <div className={`rounded-xl border px-3 py-2 ${analyzing ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                2. AI analysis
              </div>
              <div className={`rounded-xl border px-3 py-2 ${!isBusy && selectedFileName ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                3. Open results
              </div>
            </div>

            {errorMessage && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              Tip: upload a clear full-page PDF from your lab portal, a high-quality photo, or a spreadsheet with results for best accuracy.
            </div>

            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium text-slate-700">Lab / Clinic name (optional)</label>
              <input
                value={labName}
                disabled={isBusy}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="Quest, LabCorp, Other..."
                className="vtl-focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 disabled:cursor-not-allowed disabled:opacity-60 focus:border-emerald-400 focus:outline-none"
              />
              <p className="mt-2 flex items-start gap-2 text-xs text-slate-500">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>* If your clinic or lab is not recognized yet, it is still fine. Our lab database is still growing and more providers will be added soon.</span>
              </p>
            </div>

            <SymptomSelector selected={symptoms} onChange={setSymptoms} />

            <div className="mt-6">
              {analyzing && (
                <div className="mb-6">
                  <AnalysisProgressIndicator analyzing={analyzing} elapsedSeconds={elapsedSeconds} />
                  {loadingWarning && (
                    <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                      {loadingWarning}
                    </div>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-rose-900">{errorMessage}</p>
                      <p className="mt-1 text-xs text-rose-700">Try uploading a clearer full-page PDF from your lab portal.</p>
                      {retryCount < 3 && selectedFile && (
                        <button
                          onClick={handleRetry}
                          disabled={isBusy}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition"
                        >
                          ↻ Retry ({retryCount}/3)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!analyzing && <UploadZone onFile={handleFile} disabled={isBusy} />}
            </div>
          </>
        ) : (
          // Manual Entry Mode
          <ManualBiomarkerEntry onAnalyze={handleAnalyzeManual} onLoading={handleLoadingManual} />
        )}
      </div>
    </div>
  )
}
