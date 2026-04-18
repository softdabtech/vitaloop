import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Building2, ShieldCheck, Sparkles, UserCircle2 } from 'lucide-react'
import { useOCR } from '../hooks/useOCR.js'
import { useSubscription } from '../hooks/useSubscription.js'
import UploadZone from '../components/UploadZone.jsx'
import SymptomSelector from '../components/SymptomSelector.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaLabUpload } from '../lib/analytics.js'
import toast from 'react-hot-toast'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import '../styles/dashboard2026.css'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
const SUPPORTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default function Upload() {
  const navigate = useNavigate()
  const { processFile, progress, isProcessing } = useOCR()
  const { isPremium, uploadCount, uploadLimit, uploadsRemaining, loading: subLoading, refresh: refreshSub } = useSubscription()
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
    }).catch(() => {})
  }, [])

  const isBusy = isProcessing || analyzing

  function validateFile(file) {
    if (!file) {
      return 'No file selected. Please choose a lab report.'
    }

    if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
      return 'Unsupported file type. Please upload PDF, JPG, or PNG.'
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'File is too large. Please upload a file under 20MB.'
    }

    return ''
  }

  async function handleFile(file) {
    if (isBusy) {
      return
    }

    const validationError = validateFile(file)
    if (validationError) {
      setErrorMessage(validationError)
      toast.error(validationError)
      return
    }

    setErrorMessage('')
    setSelectedFileName(file.name)

    toast('Extracting text from your lab report…', { icon: '🔍' })
    let text = ''
    let confidence = null

    try {
      const result = await processFile(file)
      text = result.text
      confidence = result.confidence
    } catch (err) {
      setErrorMessage('Could not read this file. Please try another clear PDF or image.')
      toast.error('Could not read this file. Please try another clear PDF or image.')
      return
    }

    if (!text || text.trim().length < 20) {
      setErrorMessage('Not enough readable text found. Please upload a clearer document.')
      toast.error('Could not read the document. Try a clearer image or PDF.')
      return
    }

    setAnalyzing(true)
    try {
      // user_id is now derived from JWT on the backend — not sent in body
      const { data } = await api.post('/analyze', {
        extracted_text: text,
        lab_name: labName || undefined,
        ocr_confidence: confidence,
        symptoms,
      })

      // Generate protocol
      await api.post('/protocol', {
        upload_id: data.upload_id,
        symptoms,
      })

      // Save symptoms record
      if (symptoms.length > 0) {
        await api.post('/symptoms', {
          upload_id: data.upload_id,
          tags: symptoms,
        }).catch(() => null) // non-critical
      }

      trackFunnelEvent('funnel_first_upload_completed', 'User completed first lab upload analysis', {
        upload_id: data.upload_id,
        symptoms_count: symptoms.length,
        has_lab_name: Boolean(labName),
      }, { oncePerSession: true })
      gaLabUpload()

      toast.success('Analysis complete!')
      navigate(`/results/${data.upload_id}`)
    } catch (err) {
      const status = err.response?.status
      if (status === 402) {
        // PaywallModal is triggered globally via client.ts — just refresh sub state
        refreshSub()
        return
      }
      const message = err.response?.data?.detail || 'Analysis failed. Please try again.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
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

        {profileIncomplete && (
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

        {!subLoading && !isPremium && (
          <div className={`mb-6 flex items-center justify-between rounded-xl px-4 py-3 text-sm ${uploadsRemaining === 0 ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-amber-200 bg-amber-50 text-amber-700'}`}>
            <span>
              {uploadsRemaining === 0
                ? `Free upload limit reached (${uploadCount}/${uploadLimit}).`
                : `Free plan: ${uploadsRemaining} upload${uploadsRemaining !== 1 ? 's' : ''} remaining.`}
            </span>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('paywall:trigger', { detail: { reason: 'UPLOAD_LIMIT_REACHED' } }))}
              className="ml-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition"
            >
              Upgrade {PREMIUM_PRICE_LABEL}
            </button>
          </div>
        )}

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
              AI is analyzing your results. This usually takes under a minute.
            </div>
          )}

          {!isProcessing && !analyzing && <UploadZone onFile={handleFile} disabled={isBusy} />}
        </div>
      </div>
    </div>
  )
}
