import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Building2, ShieldCheck, Sparkles, UserCircle2 } from 'lucide-react'
import HintBanner from '../components/tour/HintBanner.jsx'
import { useTourHints } from '../hooks/useTourHints.js'
import { useOCR } from '../hooks/useOCR.js'
import { useSubscription } from '../hooks/useSubscription.js'
import UploadZone from '../components/UploadZone.jsx'
import SymptomSelector from '../components/SymptomSelector.jsx'
import ManualBiomarkerEntry from '../components/ManualBiomarkerEntry.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaLabUpload } from '../lib/analytics.js'
import toast from 'react-hot-toast'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import '../styles/dashboard2026.css'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
const SUPPORTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

const UPLOAD_HINTS = [
  '📄 Upload a PDF or a clear photo of your lab report. Your file is read entirely in your browser — only the extracted text is sent to our servers, not the original file.',
  '💊 Add current symptoms before uploading. The AI uses them to prioritize which biomarkers are most relevant to your situation.',
  '✅ After upload you\'ll see a color-coded biomarker breakdown and a personalized supplement protocol — all generated automatically.',
]

function triggerPaywall(detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail }))
  }
}

// Helper functions for Upload component
function validateFileInput(file) {
  if (!file) return 'No file selected. Please choose a lab report.'
  if (!SUPPORTED_FILE_TYPES.includes(file.type)) return 'Unsupported file type. Please upload PDF, JPG, or PNG.'
  if (file.size > MAX_FILE_SIZE_BYTES) return 'File is too large. Please upload a file under 20MB.'
  return ''
}

async function handleAnalysisError(err) {
function build402ErrorMessage({ errorCode, errorDetail, usedBy }) {
  if (errorCode === 'BIOMARKER_QUOTA_EXCEEDED') {
    if (usedBy === 'manual') {
      return 'You\'ve already entered biomarkers manually. Free plan allows 1 entry via PDF OR manual. Upgrade to Premium for unlimited entries.'
    }
    return errorDetail || 'Your free biomarker entry quota is full. Upgrade to Premium for unlimited entries.'
  }
  return errorDetail || 'Subscription required for this action. Upgrade to Premium.'
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
    if (errorCode === 'LAB_TEXT_TOO_SHORT') {
      return 'Not enough readable text found in the report. Please upload a clearer PDF or photo with full biomarker table visible.'
    }
    if (errorCode === 'BIOMARKERS_NOT_EXTRACTED') {
      return 'Could not detect biomarkers in this report format. Try a clearer full-page PDF or a sharp photo with names, values, and ranges visible.'
    }
    return 'Lab report format not recognized. Please upload a standard lab PDF or clear photo.'
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
  const errorCode = errorData?.code
  const errorDetail = typeof errorData?.detail === 'string' ? errorData.detail : null
  const usedBy = errorData?.used_by

  maybeTriggerPaywall({ status, errorCode, usedBy })
  return resolveAnalysisErrorMessage({ status, errorCode, errorDetail, usedBy })
}

async function sendAnalysisMetadata(uploadId, symptoms) {
  // Generate protocol — non-blocking
  await api.post('/protocol', {
    upload_id: uploadId,
    symptoms,
  }).catch(() => null)

  // Save symptoms record if any
  if (symptoms.length > 0) {
    await api.post('/symptoms', {
      upload_id: uploadId,
      tags: symptoms,
    }).catch(() => null)
  }
}

export default function Upload() {
  const navigate = useNavigate()
  const { processFile, progress, isProcessing } = useOCR()
  const { isPremium, uploadCount, uploadLimit, uploadsRemaining, loading: subLoading, refresh: refreshSub } = useSubscription()
  const { show: showHints, dismiss: dismissHints } = useTourHints('upload')
  const [uploadMode, setUploadMode] = useState('pdf') // 'pdf' | 'manual'
  const [symptoms, setSymptoms] = useState([])
  const [labName, setLabName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [profileIncomplete, setProfileIncomplete] = useState(false)

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

  const isBusy = isProcessing || analyzing
  const [retryCount, setRetryCount] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)

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

    toast(`Extracting text from ${file.name}… (${(file.size / 1024).toFixed(0)}KB)`, { icon: '🔍' })
    let text = ''
    let confidence = null

    try {
      const result = await processFile(file)
      text = result.text
      confidence = result.confidence
    } catch (err) {
      console.error('File processing error:', err)
      const errorMsg = err.message || 'Could not read this file. Please try another clear PDF or image.'
      setErrorMessage(errorMsg)
      toast.error(errorMsg)
      return
    }

    if (!text || text.trim().length < 20) {
      setErrorMessage('Not enough readable text found. Please upload a clearer document.')
      toast.error('Could not read the document. Try a clearer image or PDF.')
      return
    }

    setAnalyzing(true)
    try {
      const { data } = await api.post('/analyze', {
        extracted_text: text,
        lab_name: labName || undefined,
        ocr_confidence: confidence,
        symptoms,
      })

      // Send metadata and protocol generation non-blocking
      await sendAnalysisMetadata(data.upload_id, symptoms)

      trackFunnelEvent('funnel_first_upload_completed', 'User completed first lab upload analysis', {
        upload_id: data.upload_id,
        symptoms_count: symptoms.length,
        has_lab_name: Boolean(labName),
      }, { oncePerSession: true })
      gaLabUpload()

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
    toast.success('Analysis complete!')
    navigate(`/results/${result.upload_id}`)
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
          subtitle="Your file is processed locally first. Only extracted text is sent for analysis."
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
            📄 Upload PDF / Photo
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
                <p className="text-sm text-slate-500">Your file is read in the browser first. Only extracted text continues into the analysis workflow.</p>
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
              <div className={`rounded-xl border px-3 py-2 ${isProcessing ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                1. Read document
              </div>
              <div className={`rounded-xl border px-3 py-2 ${analyzing ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                2. Analyze biomarkers
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
              Tip: upload a clear full-page PDF or a sharp photo in good lighting.
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
              {isProcessing && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="mb-2 text-sm text-emerald-700">Reading document... {progress}%</div>
                  <div className="h-2.5 w-full rounded-full bg-emerald-100">
                    <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  {selectedFileName && <div className="mt-2 truncate text-xs text-emerald-600">{selectedFileName}</div>}
                </div>
              )}

              {analyzing && (
                <div className="mb-4 animate-pulse rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Extracting biomarkers... This usually takes under a minute.
                </div>
              )}

              {errorMessage && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-rose-900">{errorMessage}</p>
                      <p className="mt-1 text-xs text-rose-700">Try uploading a clearer PDF or sharp photo of your full lab report.</p>
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

              {!isProcessing && !analyzing && <UploadZone onFile={handleFile} disabled={isBusy} />}
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
