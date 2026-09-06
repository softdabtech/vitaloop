import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, UserCircle2 } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription.js'
import UploadZone from '../components/UploadZone.jsx'
import ManualBiomarkerEntry from '../components/ManualBiomarkerEntry.jsx'
import AnalysisProgressIndicator from '../components/AnalysisProgressIndicator.jsx'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaLabUpload } from '../lib/analytics.js'
import toast from 'react-hot-toast'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import { useQuestionnaireSession } from '../hooks/useQueries.js'
import { isUkrainianLocale } from '../lib/locale.js'
import { CoachBadge, CoachCard, CoachProgress } from '../components/coach/CoachUI.jsx'
import '../styles/dashboard2026.css'
// coach-shell/coach-card/etc. have no built-in styles of their own — every
// rule lives in this stylesheet. Vite code-splits CSS per lazy route chunk,
// so each page using CoachUI must import it directly or it renders as
// unstyled browser-default HTML, not a build error.
import '../styles/coach-design-system.css'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
const ANALYSIS_UPLOAD_TIMEOUT_MS = 180000

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

const LOADING_MESSAGES = [
  '📤 Uploading your lab report...',
  '🧠 AI is analyzing your biomarkers...',
  '📋 Generating your personalized protocol...',
  '💊 Finalizing supplement recommendations...',
  '✅ Almost ready...',
]

const UPLOAD_COPY = {
  en: {
    loadingMessages: LOADING_MESSAGES,
    profileIncomplete: 'Complete profile first',
    uploading: (name, kb) => `Uploading ${name}… (${kb}KB)`,
    analysisComplete: 'Analysis complete!',
    longerWarning: 'This is taking longer than usual. Large files may take 1-2 minutes.',
    validationNoFile: 'No file selected. Please choose a lab report.',
    validationUnsupported: 'Unsupported file type. Please upload a PDF, image, XLS/XLSX, or CSV file.',
    validationLarge: 'File is too large. Please upload a file under 20MB.',
    biomarkersNotExtracted: 'Could not detect biomarkers in this report format. Try a clearer full-page file with names, values, and ranges visible.',
    formatNotRecognized: 'Lab report format not recognized. Please upload a standard lab report file.',
    invalidFileType: 'Please upload a valid PDF, image, XLS/XLSX, or CSV file.',
    fileTooLarge: 'File too large for processing. Please upload a file under 20MB.',
    tooMany: 'Too many uploads. Please wait and try again later.',
    fallbackError: 'Analysis failed. Please try again.',
    quotaManual: 'You\'ve already entered biomarkers manually. Free plan includes 1 lab analysis (file upload or manual entry). Upgrade to Premium for unlimited analyses, advanced protocols, and health tracking.',
    quotaUpload: 'You\'ve reached your free analysis limit (1 per month). Upgrade to Premium for unlimited lab uploads, AI-generated protocols, and personalized health insights.',
    uploadLimit: 'You\'ve reached your free analysis limit. Upgrade to Premium for unlimited lab uploads and advanced health tracking.',
    premiumRequired: 'Premium required for this feature. Upgrade to unlock unlimited analyses and personalized protocols.',
    pageTitle: 'Upload Results',
    pageSubtitle: (concern) => concern ? `Upload results for: ${concern}` : 'Upload results in context of a symptom check and lab plan.',
    pageHelper: 'This upload helps answer your active concern and improves protocol decisions.',
    reviewTitle: 'Review uncertain markers',
    reviewBody: 'Some extracted values need a quick check before VITALOOP uses them in the final report.',
    reviewConfirm: 'Confirm and rebuild report',
    reviewSkip: 'Open report without changes',
    reviewReject: 'Reject',
    reviewKeep: 'Use',
    reviewLow: 'low confidence',
    reviewMedium: 'medium confidence',
    reviewName: 'Marker',
    reviewValue: 'Value',
    reviewUnit: 'Unit',
    reviewDone: 'Markers confirmed',
  },
  uk: {
    loadingMessages: [
      '📤 Завантажуємо ваш файл...',
      '🧠 AI аналізує показники...',
      '📋 Формуємо персональний підсумок...',
      '💊 Уточнюємо пріоритети дій...',
      '✅ Майже готово...',
    ],
    profileIncomplete: 'Спочатку заповніть профіль',
    uploading: (name, kb) => `Завантажуємо ${name}… (${kb}KB)`,
    analysisComplete: 'Аналіз готовий!',
    longerWarning: 'Обробка триває довше, ніж зазвичай. Великі файли можуть займати 1-2 хвилини.',
    validationNoFile: 'Файл не обрано. Завантажте файл з аналізами.',
    validationUnsupported: 'Непідтримуваний тип файлу. Завантажте PDF, зображення, XLS/XLSX або CSV.',
    validationLarge: 'Файл завеликий. Завантажте файл до 20MB.',
    biomarkersNotExtracted: 'Не вдалося розпізнати показники в цьому форматі. Спробуйте чіткіший файл, де видно назви, значення та референси.',
    formatNotRecognized: 'Формат бланка не розпізнано. Завантажте стандартний файл з лабораторії.',
    invalidFileType: 'Завантажте коректний PDF, зображення, XLS/XLSX або CSV.',
    fileTooLarge: 'Файл завеликий для обробки. Завантажте файл до 20MB.',
    tooMany: 'Забагато спроб. Зачекайте і спробуйте ще раз.',
    fallbackError: 'Аналіз не вдався. Спробуйте ще раз.',
    quotaManual: 'Ви вже ввели показники вручну. Безкоштовний план включає 1 аналіз: файл або ручне введення. Premium відкриває необмежені аналізи, розширені плани та динаміку.',
    quotaUpload: 'Ви досягли ліміту безкоштовного аналізу. Premium відкриває необмежені завантаження, AI-плани та персональні підсумки.',
    uploadLimit: 'Ви досягли ліміту безкоштовного аналізу. Premium відкриває необмежені завантаження та динаміку.',
    premiumRequired: 'Для цієї функції потрібен Premium.',
    pageTitle: 'Завантажити аналізи',
    pageSubtitle: (concern) => concern ? `Завантаження для: ${concern}` : 'Завантажте результати в контексті симптомів і плану аналізів.',
    pageHelper: 'Це допоможе повʼязати показники з вашою скаргою і пріоритетами.',
    reviewTitle: 'Перевірте непевні показники',
    reviewBody: 'Деякі значення потребують швидкої перевірки перед тим, як VITALOOP використає їх у фінальному звіті.',
    reviewConfirm: 'Підтвердити й оновити звіт',
    reviewSkip: 'Відкрити звіт без змін',
    reviewReject: 'Відхилити',
    reviewKeep: 'Використати',
    reviewLow: 'низька впевненість',
    reviewMedium: 'середня впевненість',
    reviewName: 'Показник',
    reviewValue: 'Значення',
    reviewUnit: 'Одиниця',
    reviewDone: 'Показники підтверджено',
  },
}

function triggerPaywall(detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paywall:trigger', { detail }))
  }
}

// Helper functions for Upload component
function validateFileInput(file, copy = UPLOAD_COPY.en) {
  if (!file) return copy.validationNoFile

  // Check if file type is supported
  const filename = (file.name || '').toLowerCase()
  const supportedExtensions = new Set()

  Object.values(SUPPORTED_FILE_TYPES).forEach(exts => {
    exts.forEach(ext => supportedExtensions.add(ext))
  })

  const hasValidExtension = Array.from(supportedExtensions).some(ext => filename.endsWith(ext))

  if (!hasValidExtension && !Object.keys(SUPPORTED_FILE_TYPES).includes(file.type)) {
    return copy.validationUnsupported
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return copy.validationLarge
  }

  return ''
}

function build402ErrorMessage({ errorCode, errorDetail, usedBy, copy = UPLOAD_COPY.en }) {
  if (errorCode === 'BIOMARKER_QUOTA_EXCEEDED') {
    if (usedBy === 'manual') {
      return copy.quotaManual
    }
    return errorDetail || copy.quotaUpload
  }
  if (errorCode === 'UPLOAD_LIMIT_REACHED') {
    return copy.uploadLimit
  }
  return errorDetail || copy.premiumRequired
}

function maybeTriggerPaywall({ status, errorCode, usedBy }) {
  if (status !== 402) return
  if (errorCode === 'BIOMARKER_QUOTA_EXCEEDED') {
    triggerPaywall({ reason: 'BIOMARKER_QUOTA_EXCEEDED', used_by: usedBy })
    return
  }
  triggerPaywall({ reason: 'SUBSCRIPTION_REQUIRED' })
}

function resolveAnalysisErrorMessage({ status, errorCode, errorDetail, usedBy, copy = UPLOAD_COPY.en }) {
  if (status === 402) {
    return build402ErrorMessage({ errorCode, errorDetail, usedBy, copy })
  }

  if (status === 422) {
    if (errorCode === 'BIOMARKERS_NOT_EXTRACTED') {
      return copy.biomarkersNotExtracted
    }
    return copy.formatNotRecognized
  }

  if (status === 400 && errorCode === 'INVALID_FILE_TYPE') {
    return copy.invalidFileType
  }

  if (status === 413) {
    return copy.fileTooLarge
  }

  if (status === 429) {
    return copy.tooMany
  }

  return errorDetail || copy.fallbackError
}

function handleAnalysisError(err, copy = UPLOAD_COPY.en) {
  const errorData = err.response?.data || {}
  const status = err.response?.status

  // Handle nested error structure: detail contains {detail, code, used_by}
  const innerError = typeof errorData?.detail === 'object' ? errorData.detail : errorData
  const errorCode = innerError?.code || errorData?.code
  const errorDetail = typeof innerError?.detail === 'string' ? innerError.detail : typeof errorData?.detail === 'string' ? errorData.detail : null
  const usedBy = innerError?.used_by || errorData?.used_by

  maybeTriggerPaywall({ status, errorCode, usedBy })
  return resolveAnalysisErrorMessage({ status, errorCode, errorDetail, usedBy, copy })
}

function resolveUploadId(data) {
  const value = data?.upload_id || data?.uploadId || data?.id
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

export default function Upload() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isPremium, uploadsRemaining, loading: subLoading } = useSubscription()
  const [uploadMode, setUploadMode] = useState('pdf') // 'pdf' | 'manual'
  // The "Lab / Clinic name" input that set this was removed from the page.
  // labName now always stays '', so the `if (labName)` guards below are a
  // permanent no-op (harmless — lab_name was always optional) rather than
  // dead code that would error. Left in place instead of ripped out in case
  // the field comes back; setLabName is intentionally unused now.
  const [labName, setLabName] = useState('') // eslint-disable-line no-unused-vars
  const [analyzing, setAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [profileIncomplete, setProfileIncomplete] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0])
  const [loadingWarning, setLoadingWarning] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [candidateReview, setCandidateReview] = useState(null)
  const [confirmingCandidates, setConfirmingCandidates] = useState(false)
  const isUk = isUkrainianLocale()
  const copy = isUk ? UPLOAD_COPY.uk : UPLOAD_COPY.en

  const { data: questionnaireSession } = useQuestionnaireSession()
  const sessionContext = questionnaireSession?.session_context || questionnaireSession?.session?.session_metadata || {}
  const activeConcern = sessionContext?.active_concern || ''

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

    setLoadingMessage(copy.loadingMessages[0])
    setElapsedSeconds(0)

    // Timer for elapsed seconds
    const elapsedTimer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)

    const timers = [
      setTimeout(() => setLoadingMessage(copy.loadingMessages[1]), 3000),
      setTimeout(() => setLoadingMessage(copy.loadingMessages[2]), 15000),
      setTimeout(() => setLoadingMessage(copy.loadingMessages[3]), 25000),
      setTimeout(() => setLoadingMessage(copy.loadingMessages[4]), 35000),
      setTimeout(() => setLoadingWarning(copy.longerWarning), 60000),
    ]

    return () => {
      clearInterval(elapsedTimer)
      timers.forEach(clearTimeout)
    }
  }, [analyzing, copy])

  async function handleFile(file) {
    if (isBusy) return

    const validationError = validateFileInput(file, copy)
    if (validationError) {
      setErrorMessage(validationError)
      toast.error(validationError)
      return
    }

    setErrorMessage('')
    setSelectedFileName(file.name)
    setSelectedFile(file)
    setRetryCount(0)

    toast(copy.uploading(file.name, (file.size / 1024).toFixed(0)), { icon: '📄' })

    setAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (labName) {
        formData.append('lab_name', labName)
      }

      const { data } = await api.post('/analyze/pdf', formData, { timeout: ANALYSIS_UPLOAD_TIMEOUT_MS })

      const uploadId = resolveUploadId(data)
      if (!uploadId) {
        throw new Error(copy.fallbackError)
      }

      trackFunnelEvent('funnel_first_upload_completed', 'User completed first lab upload analysis', {
        upload_id: uploadId,
        has_lab_name: Boolean(labName),
      }, { oncePerSession: true })
      gaLabUpload()

      // Quality Gate completion (cabinet reconciliation): a decision other
      // than auto_continue means run_lab_analysis_pipeline took its early
      // needs_confirmation return — no canonical biomarkers were persisted
      // (Stage 2B's chokepoint), so navigating straight to /results/{uploadId}
      // here was a dead end (empty "no processed biomarkers yet" state with
      // no way back into confirmation). Reuses the EXISTING, already-tested
      // backend contract unchanged: GET /{upload_id}/candidates +
      // POST /{upload_id}/confirm-candidates (Stage 2B) — no new endpoint, no
      // gate semantics change. Populates the review UI that already existed
      // in this file but nothing ever triggered.
      if (data.analysis_status && data.analysis_status !== 'completed') {
        try {
          const { data: reviewData } = await api.get(`/analyze/${uploadId}/candidates`)
          const candidates = Array.isArray(reviewData?.candidates) ? reviewData.candidates : []
          if (candidates.length) {
            setCandidateReview({ uploadId, candidates })
            setAnalyzing(false)
            return
          }
        } catch (reviewErr) {
          console.error('Failed to load candidates for review:', reviewErr)
          // Fall through to the results navigation below — the empty state
          // there still degrades safely (no biomarkers yet), and the user is
          // not stuck with no feedback at all.
        }
      }

      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['lab-results-list'] }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
        queryClient.invalidateQueries({ queryKey: ['health-score'] }),
      ])

      toast.success(copy.analysisComplete)
      navigate(`/results/${uploadId}`)
    } catch (err) {
      const message = handleAnalysisError(err, copy)
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

  function handleUploadZoneError(message) {
    setErrorMessage(message)
    toast.error(message)
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
      toast.success(copy.analysisComplete)
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

  function updateReviewCandidate(candidateId, patch) {
    setCandidateReview(prev => {
      if (!prev) return prev
      return {
        ...prev,
        candidates: prev.candidates.map(candidate => (
          candidate.id === candidateId ? { ...candidate, ...patch } : candidate
        )),
      }
    })
  }

  async function confirmCandidateReview() {
    if (!candidateReview || confirmingCandidates) return
    setConfirmingCandidates(true)
    try {
      const decisions = candidateReview.candidates.map(candidate => ({
        id: candidate.id,
        status: candidate.decision === 'rejected' ? 'rejected' : 'corrected',
        corrections: {
          raw_name: candidate.raw_name,
          raw_value: candidate.raw_value,
          raw_unit: candidate.raw_unit,
          parsed_value: Number(String(candidate.raw_value).replace(',', '.')),
        },
      }))
      await api.post(`/analyze/${candidateReview.uploadId}/confirm-candidates`, { candidates: decisions })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['lab-results-list'] }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
        queryClient.invalidateQueries({ queryKey: ['health-score'] }),
      ])
      toast.success(copy.reviewDone)
      navigate(`/results/${candidateReview.uploadId}`)
    } catch (err) {
      const message = handleAnalysisError(err, copy)
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setConfirmingCandidates(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-6xl">
        {/* Was two separate cards (a CabinetPageHeader + a CoachCard right below
            it) — merged into one, per explicit request, since stacking a page
            title and a second "flow" heading right under it read as two
            competing headers. Typography is now consistent between the two
            headings: same weight (font-bold, not extrabold) and same text
            color (slate-900), just different sizes so the hierarchy (page
            title > section heading) is still clear. */}
        <CoachCard className="mb-6 p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{copy.pageTitle}</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{copy.pageSubtitle(activeConcern)}</p>
              <p className="mt-1 text-xs text-slate-400">{copy.pageHelper}</p>
            </div>
            <CoachBadge tone={analyzing ? 'warning' : candidateReview ? 'primary' : 'neutral'}>
              {analyzing ? (isUk ? 'AI аналізує' : 'AI analysis') : candidateReview ? (isUk ? 'Перевірка' : 'Review') : (isUk ? 'Готово до завантаження' : 'Ready')}
            </CoachBadge>
          </div>

          <div className="mb-3">
            <p className="coach-eyebrow">{isUk ? 'Процес' : 'Upload flow'}</p>
            <h2 className="text-base font-bold text-slate-900">{isUk ? 'Від файлу до зрозумілого результату' : 'From file to clear results'}</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: isUk ? 'Завантаження' : 'Upload', body: isUk ? 'PDF, фото або ручне введення.' : 'PDF, images, or manual entry.', active: !analyzing && !candidateReview },
              { label: isUk ? 'AI-аналіз' : 'AI Analysis', body: isUk ? 'Показники, референси, контекст.' : 'Markers, ranges, context.', active: analyzing },
              { label: isUk ? 'Результати' : 'Results', body: isUk ? 'Підсумок, план, повторна перевірка.' : 'Summary, plan, retest timing.', active: Boolean(candidateReview) },
            ].map((item, index) => (
              <div key={item.label} className={`rounded-2xl border p-4 ${item.active ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${item.active ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
                  <p className="font-extrabold text-slate-950">{item.label}</p>
                </div>
                <p className="text-sm leading-6 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
          {analyzing && <div className="mt-4"><CoachProgress value={66} label={isUk ? 'Обробка' : 'Processing'} tone="primary" /></div>}
        </CoachCard>

        {!activeConcern && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span>{isUk ? 'Найкраще працює шлях від симптомів: спочатку скарга, потім аналізи.' : 'Symptom-first path works best: start with a concern, then upload results.'}</span>
            <button
              onClick={() => navigate('/questionnaire')}
              className="ml-4 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              {isUk ? 'Почати з симптомів' : 'Start symptom check'}
            </button>
          </div>
        )}

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
            📄 {isUk ? 'Завантажити PDF' : 'Upload Lab Report'}
          </button>
          <button
            onClick={() => setUploadMode('manual')}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${
              uploadMode === 'manual'
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ✋ {isUk ? 'Ввести вручну' : 'Enter Manually'}
          </button>
        </div>

        {uploadMode === 'pdf' && profileIncomplete && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-sm">
            <UserCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div className="flex-1">
              <p className="font-semibold text-blue-800">{isUk ? 'Профіль здоровʼя не заповнений' : 'Your health profile is incomplete'}</p>
              <p className="mt-0.5 text-blue-700">
                {isUk
                  ? 'Профіль із віком, вагою, цілями та ліками допомагає зробити аналіз точнішим. Ви можете завантажити файл зараз, але профіль краще заповнити.'
                  : 'A complete profile (height, weight, goals, medications) helps the AI and nutritionist give you more accurate, personalized analysis. You can still upload, but completing your profile first is recommended.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/onboarding')}
              className="ml-1 shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              {isUk ? 'Заповнити профіль' : 'Complete profile'}
            </button>
          </div>
        )}

        {uploadMode === 'pdf' && !subLoading && !isPremium && uploadsRemaining === 0 && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>
              {isUk ? 'Безкоштовний аналіз уже використано. Можна завантажити файл або ввести вручну, але не обидва варіанти.' : 'Your free biomarker entry was already used. You can upload a file OR enter manually, but not both.'}
            </span>
            <button
              onClick={() => triggerPaywall({ reason: 'BIOMARKER_QUOTA_EXCEEDED' })}
              className="ml-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition"
            >
              {isUk ? 'Оновити' : 'Upgrade'} {PREMIUM_PRICE_LABEL}
            </button>
          </div>
        )}

        {uploadMode === 'pdf' && !subLoading && !isPremium && uploadsRemaining > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {isUk ? 'Безкоштовний план: 1 аналіз показників через файл або ручне введення.' : 'Free plan: 1 biomarker entry allowed (via file upload or manual entry).'}
          </div>
        )}

        {uploadMode === 'pdf' ? (
          <>
            {candidateReview && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{copy.reviewTitle}</h2>
                    <p className="mt-1 text-sm text-amber-800">{copy.reviewBody}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/results/${candidateReview.uploadId}`)}
                    className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-amber-100"
                  >
                    {copy.reviewSkip}
                  </button>
                </div>

                <div className="space-y-3">
                  {candidateReview.candidates.map(candidate => (
                    <div key={candidate.id} className="rounded-xl border border-amber-200 bg-white p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          {candidate.confidence_label === 'medium' ? copy.reviewMedium : copy.reviewLow}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateReviewCandidate(candidate.id, { decision: 'confirmed' })}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              candidate.decision !== 'rejected'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {copy.reviewKeep}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateReviewCandidate(candidate.id, { decision: 'rejected' })}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              candidate.decision === 'rejected'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {copy.reviewReject}
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="text-xs font-semibold text-slate-600">
                          {copy.reviewName}
                          <input
                            value={candidate.raw_name}
                            disabled={candidate.decision === 'rejected'}
                            onChange={(event) => updateReviewCandidate(candidate.id, { raw_name: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          {copy.reviewValue}
                          <input
                            value={candidate.raw_value}
                            disabled={candidate.decision === 'rejected'}
                            onChange={(event) => updateReviewCandidate(candidate.id, { raw_value: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          {copy.reviewUnit}
                          <input
                            value={candidate.raw_unit}
                            disabled={candidate.decision === 'rejected'}
                            onChange={(event) => updateReviewCandidate(candidate.id, { raw_unit: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={confirmCandidateReview}
                  disabled={confirmingCandidates}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {confirmingCandidates ? (isUk ? 'Оновлюємо…' : 'Updating…') : copy.reviewConfirm}
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                {errorMessage}
              </div>
            )}

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
                      <p className="mt-1 text-xs text-rose-700">{isUk ? 'Спробуйте завантажити чіткіший повносторінковий файл із кабінету лабораторії.' : 'Try uploading a clearer full-page file from your lab portal.'}</p>
                      {retryCount < 3 && selectedFile && (
                        <button
                          onClick={handleRetry}
                          disabled={isBusy}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition"
                        >
                          ↻ {isUk ? 'Спробувати ще раз' : 'Retry'} ({retryCount}/3)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!analyzing && <UploadZone onFile={handleFile} onError={handleUploadZoneError} disabled={isBusy} />}
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
