import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, FileText, Keyboard, UserCircle2 } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription.js'
import UploadZone from '../components/UploadZone.jsx'
import ManualBiomarkerEntry from '../components/ManualBiomarkerEntry.jsx'
import AnalysisProgressIndicator from '../components/AnalysisProgressIndicator.jsx'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaLabUpload, gaLabUploadStarted } from '../lib/analytics.js'
import toast from 'react-hot-toast'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import { useQuestionnaireSession } from '../hooks/useQueries.js'
import { isUkrainianLocale } from '../lib/locale.js'
import { CoachAlert, CoachBadge, CoachButton, CoachCard, CoachProgress, CoachSegmentedControl } from '../components/coach/CoachUI.jsx'
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

const UPLOAD_COPY = {
  en: {
    profileIncomplete: 'Complete profile first',
    uploading: (name, kb) => `Uploading ${name}… (${kb}KB)`,
    analysisComplete: 'Analysis complete!',
    analysisReplayed: 'Your existing report is ready.',
    analysisFollowupPending: 'Your report is saved. Some follow-up items are still being completed.',
    analysisPartial: 'Your report was saved, but follow-up processing needs attention. You can review the confirmed results.',
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
    quotaUpload: 'You\'ve reached your free analysis limit (1 free upload). Upgrade to Premium for unlimited lab uploads, AI-generated protocols, and personalized health insights.',
    uploadLimit: 'You\'ve reached your free analysis limit. Upgrade to Premium for unlimited lab uploads and advanced health tracking.',
    premiumRequired: 'Premium required for this feature. Upgrade to unlock unlimited analyses and personalized protocols.',
    errorTitleLimit: 'Free limit reached',
    errorTitleExtraction: 'Could not read this file',
    errorTitleFile: 'File not accepted',
    errorTitleBusy: 'Too many attempts',
    errorTitleGeneric: 'Analysis failed',
    hintClearerFile: 'Try a clearer, full-page file from your lab portal with names, values, and ranges visible.',
    hintChooseDifferent: 'Choose a different file below to continue.',
    hintTryAgainLater: 'If this keeps happening, try again in a moment or contact support.',
    retryAction: (count) => `Retry (${count}/3)`,
    upgradeAction: 'Upgrade',
    tryManualInstead: 'Or enter values manually instead',
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
    reviewHigh: 'high confidence',
    reviewName: 'Marker',
    reviewValue: 'Value',
    reviewUnit: 'Unit',
    reviewDone: 'Markers confirmed',
  },
  uk: {
    profileIncomplete: 'Спочатку заповніть профіль',
    uploading: (name, kb) => `Завантажуємо ${name}… (${kb}KB)`,
    analysisComplete: 'Аналіз готовий!',
    analysisReplayed: 'Ваш попередньо збережений звіт готовий.',
    analysisFollowupPending: 'Звіт збережено. Частина наступних кроків ще виконується.',
    analysisPartial: 'Звіт збережено, але подальша обробка потребує уваги. Можна переглянути підтверджені результати.',
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
    errorTitleLimit: 'Безкоштовний ліміт вичерпано',
    errorTitleExtraction: 'Не вдалося прочитати файл',
    errorTitleFile: 'Файл не прийнято',
    errorTitleBusy: 'Забагато спроб',
    errorTitleGeneric: 'Аналіз не вдався',
    hintClearerFile: 'Спробуйте чіткіший повносторінковий файл із кабінету лабораторії, де видно назви, значення та референси.',
    hintChooseDifferent: 'Оберіть інший файл нижче, щоб продовжити.',
    hintTryAgainLater: 'Якщо це повторюється, спробуйте пізніше або зверніться в підтримку.',
    retryAction: (count) => `Спробувати ще раз (${count}/3)`,
    upgradeAction: 'Оновити',
    tryManualInstead: 'Або введіть показники вручну',
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
    reviewHigh: 'висока впевненість',
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

// Error "actions" this page can offer, kept small on purpose:
// - RETRY: the same file/request may succeed on a second try (transient
//   failure, rate limit, format hiccup)
// - UPGRADE: a hard, non-transient block — retrying the same file will
//   always fail the same way, so offer the paywall action instead
// - CHOOSE_DIFFERENT: the file itself won't work no matter how many times
//   it's retried (wrong type, too large) — point at the dropzone instead
const ERROR_ACTION = { RETRY: 'retry', UPGRADE: 'upgrade', CHOOSE_DIFFERENT: 'choose_different' }

// Maps a raw error (or a client-side validation string) into a small,
// human-readable display object: {title, message, hint, action}. Keeps
// technical status/error codes out of what the user sees — they only ever
// drive which of the three actions/hints above gets shown.
function describeAnalysisError({ status, errorCode, errorDetail, usedBy }, copy = UPLOAD_COPY.en) {
  if (status === 402) {
    return {
      title: copy.errorTitleLimit,
      message: build402ErrorMessage({ errorCode, errorDetail, usedBy, copy }),
      hint: '',
      action: ERROR_ACTION.UPGRADE,
    }
  }

  if (status === 422) {
    return {
      title: copy.errorTitleExtraction,
      message: errorCode === 'BIOMARKERS_NOT_EXTRACTED' ? copy.biomarkersNotExtracted : copy.formatNotRecognized,
      hint: copy.hintClearerFile,
      action: ERROR_ACTION.RETRY,
      offerManualEntry: true,
    }
  }

  if (status === 400 && errorCode === 'INVALID_FILE_TYPE') {
    return { title: copy.errorTitleFile, message: copy.invalidFileType, hint: copy.hintChooseDifferent, action: ERROR_ACTION.CHOOSE_DIFFERENT }
  }

  if (status === 413) {
    return { title: copy.errorTitleFile, message: copy.fileTooLarge, hint: copy.hintChooseDifferent, action: ERROR_ACTION.CHOOSE_DIFFERENT }
  }

  if (status === 429) {
    return { title: copy.errorTitleBusy, message: copy.tooMany, hint: '', action: ERROR_ACTION.RETRY }
  }

  return {
    title: copy.errorTitleGeneric,
    message: errorDetail || copy.fallbackError,
    hint: copy.hintTryAgainLater,
    action: ERROR_ACTION.RETRY,
  }
}

// Client-side validation never reaches the server, so it always means "this
// exact file won't work" — never worth retrying as-is.
function describeValidationError(message, copy = UPLOAD_COPY.en) {
  return { title: copy.errorTitleFile, message, hint: copy.hintChooseDifferent, action: ERROR_ACTION.CHOOSE_DIFFERENT }
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
  return describeAnalysisError({ status, errorCode, errorDetail, usedBy }, copy)
}

function resolveUploadId(data) {
  const value = data?.upload_id || data?.uploadId || data?.id
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

// The backend can confirm a report while derived follow-up work is pending.
// Keep this small and data-only so every upload path makes the same navigation
// decision without exposing server error codes to the patient.
export function classifyAnalysisResponse(data) {
  const status = typeof data?.analysis_status === 'string' ? data.analysis_status : 'completed'
  const hasConfirmedReport = Boolean(data?.report_version?.id)
  if (status === 'needs_confirmation') return { kind: 'needs_confirmation', canNavigate: false }
  if (status === 'failed') return { kind: 'failed', canNavigate: false }
  if (status === 'partial' || data?.post_persistence_status === 'partial') {
    return { kind: 'partial', canNavigate: hasConfirmedReport }
  }
  if (data?.finalization_replay) return { kind: 'replay', canNavigate: true }
  if (data?.downstream_status && data.downstream_status !== 'completed') {
    return { kind: 'followup_pending', canNavigate: true }
  }
  return { kind: 'completed', canNavigate: true }
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
  const [labName, setLabName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [errorInfo, setErrorInfo] = useState(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [profileIncomplete, setProfileIncomplete] = useState(false)
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

    setElapsedSeconds(0)

    // Timer for elapsed seconds
    const elapsedTimer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)

    const longerWarningTimer = setTimeout(() => setLoadingWarning(copy.longerWarning), 60000)

    return () => {
      clearInterval(elapsedTimer)
      clearTimeout(longerWarningTimer)
    }
  }, [analyzing, copy])

  async function handleFile(file) {
    if (isBusy) return

    const validationError = validateFileInput(file, copy)
    if (validationError) {
      setErrorInfo(describeValidationError(validationError, copy))
      toast.error(validationError)
      return
    }

    setErrorInfo(null)
    setSelectedFileName(file.name)
    setSelectedFile(file)
    setRetryCount(0)

    toast(copy.uploading(file.name, (file.size / 1024).toFixed(0)), { icon: '📄' })

    setAnalyzing(true)
    gaLabUploadStarted('file')
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

      const outcome = classifyAnalysisResponse(data)
      if (outcome.kind === 'failed') {
        const info = describeAnalysisError({ status: 500, copy }, copy)
        setErrorInfo(info)
        toast.error(info.message)
        return
      }

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
      if (outcome.kind === 'needs_confirmation') {
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
          // The candidate-review request failed; the report is not confirmed,
          // so never present an empty result as a completed analysis.
        }
        const info = describeAnalysisError({ status: 500, copy }, copy)
        setErrorInfo(info)
        toast.error(info.message)
        return
      }

      if (!outcome.canNavigate) {
        const info = describeAnalysisError({ status: 500, copy }, copy)
        setErrorInfo(info)
        toast.error(info.message)
        return
      }

      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['lab-results-list'] }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
        queryClient.invalidateQueries({ queryKey: ['health-score'] }),
      ])

      if (outcome.kind === 'partial') {
        toast(copy.analysisPartial, { icon: '⚠️' })
      } else if (outcome.kind === 'replay') {
        toast(copy.analysisReplayed, { icon: '↻' })
      } else if (outcome.kind === 'followup_pending') {
        toast(copy.analysisFollowupPending, { icon: '⏳' })
      } else {
        toast.success(copy.analysisComplete)
      }
      navigate(`/results/${uploadId}`)
    } catch (err) {
      const info = handleAnalysisError(err, copy)
      setErrorInfo(info)
      toast.error(info.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleRetry() {
    if (!selectedFile || retryCount >= 3) return
    setRetryCount(prev => prev + 1)
    setErrorInfo(null)
    await handleFile(selectedFile)
  }

  function handleUploadZoneError(message) {
    setErrorInfo(describeValidationError(message, copy))
    toast.error(message)
  }

  const handleAnalyzeManual = (result) => {
    const outcome = classifyAnalysisResponse(result)
    if (outcome.kind === 'failed' || outcome.kind === 'needs_confirmation' || !outcome.canNavigate) {
      const info = describeAnalysisError({ status: 500, copy }, copy)
      setErrorInfo(info)
      toast.error(info.message)
      return
    }
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
      if (outcome.kind === 'partial') {
        toast(copy.analysisPartial, { icon: '⚠️' })
      } else if (outcome.kind === 'replay') {
        toast(copy.analysisReplayed, { icon: '↻' })
      } else if (outcome.kind === 'followup_pending') {
        toast(copy.analysisFollowupPending, { icon: '⏳' })
      } else {
        toast.success(copy.analysisComplete)
      }
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
      const info = handleAnalysisError(err, copy)
      setErrorInfo(info)
      toast.error(info.message)
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
              <h1 className="coach-title-xl">{copy.pageTitle}</h1>
              <p className="coach-body mt-1 text-sm">{copy.pageSubtitle(activeConcern)}</p>
              <p className="mt-1 text-xs text-[color:var(--vtl-color-ink-secondary)]">{copy.pageHelper}</p>
            </div>
            <CoachBadge tone={analyzing ? 'warning' : candidateReview ? 'primary' : 'neutral'}>
              {analyzing ? (isUk ? 'AI аналізує' : 'AI analysis') : candidateReview ? (isUk ? 'Перевірка' : 'Review') : (isUk ? 'Готово до завантаження' : 'Ready')}
            </CoachBadge>
          </div>

          <div className="mb-3">
            <p className="coach-eyebrow">{isUk ? 'Процес' : 'Upload flow'}</p>
            <h2 className="coach-title-lg">{isUk ? 'Від файлу до зрозумілого результату' : 'From file to clear results'}</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: isUk ? 'Завантаження' : 'Upload', body: isUk ? 'PDF, фото або ручне введення.' : 'PDF, images, or manual entry.', active: !analyzing && !candidateReview },
              { label: isUk ? 'AI-аналіз' : 'AI Analysis', body: isUk ? 'Показники, референси, контекст.' : 'Markers, ranges, context.', active: analyzing },
              { label: isUk ? 'Результати' : 'Results', body: isUk ? 'Підсумок, план, повторна перевірка.' : 'Summary, plan, retest timing.', active: Boolean(candidateReview) },
            ].map((item, index) => (
              <CoachCard key={item.label} tone={item.active ? 'soft' : 'default'} className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${item.active ? 'bg-[var(--vtl-action-primary-bg)] text-[var(--vtl-action-primary-fg)]' : 'bg-[var(--vtl-color-canvas)] text-[var(--vtl-color-ink-secondary)]'}`}>{index + 1}</span>
                  <p className="font-extrabold text-[color:var(--vtl-color-ink)]">{item.label}</p>
                </div>
                <p className="text-sm leading-6 text-[color:var(--vtl-color-ink-secondary)]">{item.body}</p>
              </CoachCard>
            ))}
          </div>
          {analyzing && <div className="mt-4"><CoachProgress value={66} label={isUk ? 'Обробка' : 'Processing'} tone="primary" /></div>}
        </CoachCard>

        {!activeConcern && (
          <CoachAlert className="mb-6" action={<CoachButton size="sm" onClick={() => navigate('/questionnaire')}>{isUk ? 'Почати з симптомів' : 'Start symptom check'}</CoachButton>}>
            <span>{isUk ? 'Найкраще працює шлях від симптомів: спочатку скарга, потім аналізи.' : 'Symptom-first path works best: start with a concern, then upload results.'}</span>
          </CoachAlert>
        )}

        <CoachSegmentedControl
          className="mb-6 max-w-xl"
          label={isUk ? 'Спосіб введення результатів' : 'Result entry method'}
          value={uploadMode}
          onChange={setUploadMode}
          options={[
            { value: 'pdf', label: isUk ? 'Завантажити файл' : 'Upload lab report', icon: FileText },
            { value: 'manual', label: isUk ? 'Ввести вручну' : 'Enter manually', icon: Keyboard },
          ]}
        />

        {uploadMode === 'pdf' && profileIncomplete && (
          <CoachAlert className="mb-6" icon={UserCircle2} action={<CoachButton size="sm" onClick={() => navigate('/onboarding')}>{isUk ? 'Заповнити профіль' : 'Complete profile'}</CoachButton>}>
            <div>
              <p className="font-semibold">{isUk ? 'Профіль здоровʼя не заповнений' : 'Your health profile is incomplete'}</p>
              <p className="mt-0.5 text-[color:var(--vtl-color-ink-secondary)]">
                {isUk
                  ? 'Профіль із віком, вагою, цілями та ліками допомагає зробити аналіз точнішим. Ви можете завантажити файл зараз, але профіль краще заповнити.'
                  : 'A complete profile (height, weight, goals, medications) helps the AI and nutritionist give you more accurate, personalized analysis. You can still upload, but completing your profile first is recommended.'}
              </p>
            </div>
          </CoachAlert>
        )}

        {!subLoading && !isPremium && uploadsRemaining === 0 && (
          <CoachAlert tone="critical" className="mb-6" action={<CoachButton size="sm" onClick={() => triggerPaywall({ reason: 'BIOMARKER_QUOTA_EXCEEDED' })}>{isUk ? 'Оновити' : 'Upgrade'} {PREMIUM_PRICE_LABEL}</CoachButton>}>
            <span>
              {isUk
                ? 'Ви вже використали свій 1 безкоштовний звіт (файл або ручне введення). Premium відкриває необмежені аналізи.'
                : 'You\'ve already used your 1 free report (file upload or manual entry). Upgrade to Premium for unlimited analyses.'}
            </span>
          </CoachAlert>
        )}

        {!subLoading && !isPremium && uploadsRemaining > 0 && (
          <CoachAlert tone="warning" className="mb-6">
            {isUk ? 'Безкоштовний план: 1 аналіз показників через файл або ручне введення.' : 'Free plan: 1 biomarker entry allowed (via file upload or manual entry).'}
          </CoachAlert>
        )}

        {uploadMode === 'pdf' ? (
          <>
            {candidateReview && (
              <CoachCard tone="attention" className="mb-6 p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="coach-title-lg">{copy.reviewTitle}</h2>
                    <p className="mt-1 text-sm text-[color:var(--vtl-color-ink-secondary)]">{copy.reviewBody}</p>
                  </div>
                  <CoachButton variant="secondary" size="sm" onClick={() => navigate(`/results/${candidateReview.uploadId}`)}>{copy.reviewSkip}</CoachButton>
                </div>

                <div className="space-y-3">
                  {candidateReview.candidates.map(candidate => (
                    <CoachCard key={candidate.id} className="p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <CoachBadge tone="warning">
                          {candidate.confidence_label === 'high'
                            ? copy.reviewHigh
                            : candidate.confidence_label === 'medium'
                              ? copy.reviewMedium
                              : copy.reviewLow}
                        </CoachBadge>
                        <div className="flex gap-2">
                          <CoachButton
                            type="button"
                            onClick={() => updateReviewCandidate(candidate.id, { decision: 'confirmed' })}
                            size="sm"
                            variant={candidate.decision !== 'rejected' ? 'primary' : 'secondary'}
                          >
                            {copy.reviewKeep}
                          </CoachButton>
                          <CoachButton
                            type="button"
                            onClick={() => updateReviewCandidate(candidate.id, { decision: 'rejected' })}
                            size="sm"
                            variant="secondary"
                            aria-pressed={candidate.decision === 'rejected'}
                          >
                            {copy.reviewReject}
                          </CoachButton>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="coach-field text-xs">
                          {copy.reviewName}
                          <input
                            value={candidate.raw_name}
                            disabled={candidate.decision === 'rejected'}
                            onChange={(event) => updateReviewCandidate(candidate.id, { raw_name: event.target.value })}
                            className="coach-input mt-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </label>
                        <label className="coach-field text-xs">
                          {copy.reviewValue}
                          <input
                            value={candidate.raw_value}
                            disabled={candidate.decision === 'rejected'}
                            onChange={(event) => updateReviewCandidate(candidate.id, { raw_value: event.target.value })}
                            className="coach-input mt-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </label>
                        <label className="coach-field text-xs">
                          {copy.reviewUnit}
                          <input
                            value={candidate.raw_unit}
                            disabled={candidate.decision === 'rejected'}
                            onChange={(event) => updateReviewCandidate(candidate.id, { raw_unit: event.target.value })}
                            className="coach-input mt-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </label>
                      </div>
                    </CoachCard>
                  ))}
                </div>

                <CoachButton type="button" onClick={confirmCandidateReview} disabled={confirmingCandidates} className="mt-4 w-full sm:w-auto">
                  {confirmingCandidates ? (isUk ? 'Оновлюємо…' : 'Updating…') : copy.reviewConfirm}
                </CoachButton>
              </CoachCard>
            )}

            <div className="mt-6">
              {analyzing && (
                <div className="mb-6">
                  <AnalysisProgressIndicator analyzing={analyzing} elapsedSeconds={elapsedSeconds} />
                  {loadingWarning && (
                    <CoachAlert tone="warning" className="mt-4">{loadingWarning}</CoachAlert>
                  )}
                </div>
              )}

              {errorInfo && (
                <CoachAlert tone="critical" icon={AlertCircle} className="mb-4">
                      <p className="text-sm font-bold">{errorInfo.title}</p>
                      <p className="mt-0.5 text-sm">{errorInfo.message}</p>
                      {errorInfo.hint && <p className="mt-1 text-xs">{errorInfo.hint}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {errorInfo.action === 'retry' && retryCount < 3 && selectedFile && (
                          <CoachButton
                            onClick={handleRetry}
                            disabled={isBusy}
                            size="sm"
                          >
                            {copy.retryAction(retryCount)}
                          </CoachButton>
                        )}
                        {errorInfo.action === 'upgrade' && (
                          <CoachButton
                            onClick={() => triggerPaywall({ reason: 'SUBSCRIPTION_REQUIRED' })}
                            size="sm"
                          >
                            {copy.upgradeAction} {PREMIUM_PRICE_LABEL}
                          </CoachButton>
                        )}
                        {errorInfo.offerManualEntry && (
                          <button
                            onClick={() => setUploadMode('manual')}
                            className="coach-link-button text-xs"
                          >
                            {copy.tryManualInstead}
                          </button>
                        )}
                      </div>
                </CoachAlert>
              )}

              {!analyzing && <UploadZone onFile={handleFile} onError={handleUploadZoneError} disabled={isBusy} />}
            </div>
          </>
        ) : (
          // Manual Entry Mode
          <ManualBiomarkerEntry onAnalyze={handleAnalyzeManual} onLoading={handleLoadingManual} onSwitchToUpload={() => setUploadMode('pdf')} />
        )}
      </div>
    </div>
  )
}
