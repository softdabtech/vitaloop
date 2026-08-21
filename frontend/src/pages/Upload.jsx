import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Building2, CheckCircle2, Route, Sparkles, UserCircle2 } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription.js'
import UploadZone from '../components/UploadZone.jsx'
import ManualBiomarkerEntry from '../components/ManualBiomarkerEntry.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import AnalysisProgressIndicator from '../components/AnalysisProgressIndicator.jsx'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaAnalysisStarted, gaLabUpload } from '../lib/analytics.js'
import { getAttributionEventParams, getAttributionMetadata } from '../lib/attribution.js'
import toast from 'react-hot-toast'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import { useQuestionnaireSession } from '../hooks/useQueries.js'
import { isUkrainianLocale } from '../lib/locale.js'
import { CoachBadge, CoachCard, CoachProgress } from '../components/coach/CoachUI.jsx'
import '../styles/dashboard2026.css'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

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
    profileRequiredTitle: 'Complete health profile before analysis',
    profileRequiredBody: 'Age, sex, height, and weight are required before lab analysis. This helps VITALOOP distinguish pediatric and adult reference context and avoid unsafe recommendations.',
    profileRequiredUploadError: 'Complete age, sex, height, and weight before uploading lab results.',
    profileChecking: 'Checking health profile…',
    profileRequiredCta: 'Complete profile',
    missingFieldsPrefix: 'Missing',
    missingFields: {
      age: 'age',
      sex: 'sex',
      height_cm: 'height',
      weight_kg: 'weight',
    },
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
    timeout: 'Analysis is taking longer than expected. Please wait a moment and open Lab Results before retrying.',
    inProgress: 'This file is still being processed. Please wait a moment and open Lab Results.',
    fallbackError: 'Analysis failed. Please try again.',
    quotaManual: 'You\'ve already entered biomarkers manually. Free plan includes 1 lab analysis (file upload or manual entry). Upgrade to Premium for unlimited analyses, advanced protocols, and health tracking.',
    quotaUpload: 'You\'ve reached your free analysis limit (1 per month). Upgrade to Premium for unlimited lab uploads, AI-generated protocols, and personalized health insights.',
    uploadLimit: 'You\'ve reached your free analysis limit. Upgrade to Premium for unlimited lab uploads and advanced health tracking.',
    premiumRequired: 'Premium required for this feature. Upgrade to unlock unlimited analyses and personalized protocols.',
    pageTitle: 'Upload Results',
    pageSubtitle: (concern) => concern ? `Upload results for: ${concern}` : 'Upload results in context of a symptom check and lab plan.',
    pageHelper: 'This upload helps answer your active concern and improves protocol decisions.',
    concernTitle: 'Concern linkage',
    concernEmpty: 'No active concern found. Start Symptom Check first for better context.',
    concernActive: (concern) => `Active concern: ${concern}`,
    answerTitle: 'This upload will help answer',
    answerBody: 'What biomarkers currently support or contradict your symptom hypothesis.',
    nextTitle: 'Next step clarity',
    nextBody: 'After analysis, open Results & Trends to prioritize markers and retest plan.',
    reviewTitle: 'Review uncertain markers',
    reviewBody: 'Some extracted values need a quick check before VITALOOP uses them in the final report.',
    reviewQuality: (score, decision) => `Input quality: ${score}% · ${decision === 'confirm' ? 'confirmation required' : 'review required'}`,
    reviewReasonTitle: 'Why this review is needed',
    reviewConfirm: 'Confirm and rebuild report',
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
    profileRequiredTitle: 'Спочатку заповніть профіль здоровʼя',
    profileRequiredBody: 'Перед аналізом потрібні вік, стать, зріст і вага. Для дитячих аналізів це критично: VITALOOP має відрізнити дитячий і дорослий контекст референсів та не давати випадкові рекомендації.',
    profileRequiredUploadError: 'Перед завантаженням аналізів заповніть вік, стать, зріст і вагу.',
    profileChecking: 'Перевіряємо профіль здоровʼя…',
    profileRequiredCta: 'Заповнити профіль',
    missingFieldsPrefix: 'Не заповнено',
    missingFields: {
      age: 'вік',
      sex: 'стать',
      height_cm: 'зріст',
      weight_kg: 'вага',
    },
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
    timeout: 'Аналіз триває довше, ніж очікувалось. Зачекайте трохи й відкрийте список результатів перед повторною спробою.',
    inProgress: 'Цей файл ще обробляється. Зачекайте трохи й відкрийте список результатів.',
    fallbackError: 'Аналіз не вдався. Спробуйте ще раз.',
    quotaManual: 'Ви вже ввели показники вручну. Безкоштовний план включає 1 аналіз: файл або ручне введення. Premium відкриває необмежені аналізи, розширені плани та динаміку.',
    quotaUpload: 'Ви досягли ліміту безкоштовного аналізу. Premium відкриває необмежені завантаження, AI-плани та персональні підсумки.',
    uploadLimit: 'Ви досягли ліміту безкоштовного аналізу. Premium відкриває необмежені завантаження та динаміку.',
    premiumRequired: 'Для цієї функції потрібен Premium.',
    pageTitle: 'Завантажити аналізи',
    pageSubtitle: (concern) => concern ? `Завантаження для: ${concern}` : 'Завантажте результати в контексті симптомів і плану аналізів.',
    pageHelper: 'Це допоможе повʼязати показники з вашою скаргою і пріоритетами.',
    concernTitle: 'Звʼязок зі скаргою',
    concernEmpty: 'Активної скарги немає. Почніть із перевірки симптомів для кращого контексту.',
    concernActive: (concern) => `Активна скарга: ${concern}`,
    answerTitle: 'Це завантаження допоможе зрозуміти',
    answerBody: 'Які показники підтримують або спростовують вашу поточну гіпотезу щодо симптомів.',
    nextTitle: 'Наступний крок',
    nextBody: 'Після аналізу відкрийте результати й динаміку, щоб побачити пріоритети та план повторної перевірки.',
    reviewTitle: 'Перевірте непевні показники',
    reviewBody: 'Деякі значення потребують швидкої перевірки перед тим, як VITALOOP використає їх у фінальному звіті.',
    reviewQuality: (score, decision) => `Якість розпізнавання: ${score}% · ${decision === 'confirm' ? 'потрібно підтвердити' : 'потрібен перегляд'}`,
    reviewReasonTitle: 'Чому потрібна перевірка',
    reviewConfirm: 'Підтвердити й оновити звіт',
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
  if (!status && errorCode === 'ECONNABORTED') {
    return copy.timeout
  }

  if (status === 409 && errorCode === 'ANALYZE_IN_PROGRESS') {
    return copy.inProgress
  }

  if (status === 402) {
    return build402ErrorMessage({ errorCode, errorDetail, usedBy, copy })
  }

  if (status === 422) {
    if (errorCode === 'PROFILE_CONTEXT_REQUIRED') {
      return errorDetail || copy.profileRequiredUploadError
    }
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
  const errorCode = innerError?.code || errorData?.code || err.code
  const errorDetail = typeof innerError?.detail === 'string' ? innerError.detail : typeof errorData?.detail === 'string' ? errorData.detail : null
  const usedBy = innerError?.used_by || errorData?.used_by

  maybeTriggerPaywall({ status, errorCode, usedBy })
  return resolveAnalysisErrorMessage({ status, errorCode, errorDetail, usedBy, copy })
}

function resolveUploadId(data) {
  const value = data?.upload_id || data?.uploadId || data?.id
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

async function buildFileIdempotencyKey(file, labName = '') {
  const encoder = new TextEncoder()
  const metadata = `${file.name || 'file'}:${file.size || 0}:${file.lastModified || 0}:${labName || ''}`
  try {
    if (window.crypto?.subtle) {
      const fileHash = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const metadataHash = await window.crypto.subtle.digest('SHA-256', encoder.encode(metadata))
      const toHex = (buffer) => Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('')
      return `lab-file:${toHex(fileHash).slice(0, 48)}:${toHex(metadataHash).slice(0, 16)}`
    }
  } catch {
    // Fall through to a deterministic metadata key when browser hashing is unavailable.
  }
  const safeMetadata = metadata.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 96)
  return `lab-file:${safeMetadata}`
}

function getMissingAnalysisProfileFields(profile = {}) {
  return ['age', 'sex', 'height_cm', 'weight_kg'].filter(field => {
    const value = profile[field]
    return value === undefined || value === null || String(value).trim() === ''
  })
}

function formatMissingProfileFields(fields, copy) {
  return fields.map(field => copy.missingFields[field] || field).join(', ')
}

export default function Upload() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isPremium, uploadsRemaining, loading: subLoading } = useSubscription()
  const [uploadMode, setUploadMode] = useState('pdf') // 'pdf' | 'manual'
  const [labName, setLabName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [profileChecking, setProfileChecking] = useState(true)
  const [profileIncomplete, setProfileIncomplete] = useState(false)
  const [missingProfileFields, setMissingProfileFields] = useState([])
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
    let active = true
    Promise.allSettled([
      api.get('/profile'),
      api.get('/auth/onboarding/state'),
    ]).then(([profileResult, onboardingResult]) => {
      if (!active) return

      const profileData = profileResult.status === 'fulfilled' ? profileResult.value?.data || {} : {}
      const profile = profileData.profile || profileData
      const missing = getMissingAnalysisProfileFields(profile)
      const checklist = onboardingResult.status === 'fulfilled' ? onboardingResult.value?.data?.checklist || {} : {}
      const onboardingComplete = onboardingResult.status === 'fulfilled' && onboardingResult.value?.data?.completed === true
      const basicsMissing = !onboardingComplete && !checklist.profile_basics

      setMissingProfileFields(missing)
      setProfileIncomplete(missing.length > 0 || basicsMissing)
      setProfileChecking(false)

      if (profileResult.status === 'rejected') {
        console.error('Failed to load profile:', profileResult.reason)
      }
      if (onboardingResult.status === 'rejected') {
        console.error('Failed to load onboarding state:', onboardingResult.reason)
      }
    }).catch(() => {
      if (!active) return
      setProfileChecking(false)
      setProfileIncomplete(true)
    })

    return () => {
      active = false
    }
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

  async function handleFile(file, options = {}) {
    if (isBusy) return

    if (profileChecking || profileIncomplete) {
      const missing = missingProfileFields.length ? ` ${copy.missingFieldsPrefix}: ${formatMissingProfileFields(missingProfileFields, copy)}.` : ''
      const message = profileChecking ? copy.profileChecking : `${copy.profileRequiredUploadError}${missing}`
      setErrorMessage(message)
      toast.error(message)
      return
    }

    const validationError = validateFileInput(file, copy)
    if (validationError) {
      setErrorMessage(validationError)
      toast.error(validationError)
      return
    }

    setErrorMessage('')
    setSelectedFileName(file.name)
    setSelectedFile(file)
    if (!options.isRetry) {
      setRetryCount(0)
    }

    toast(copy.uploading(file.name, (file.size / 1024).toFixed(0)), { icon: '📄' })

    setAnalyzing(true)
    try {
      const analysisStartedMetadata = {
        source: 'file_upload',
        file_type: String(file.type || '').slice(0, 80) || 'unknown',
        file_size_kb: Math.round(file.size / 1024),
        has_lab_name: Boolean(labName),
        is_retry: Boolean(options.isRetry),
        ...getAttributionMetadata(),
      }
      trackFunnelEvent('funnel_analysis_started', 'User started lab analysis', analysisStartedMetadata, { oncePerSession: true })
      gaAnalysisStarted({
        source: 'file_upload',
        file_type: analysisStartedMetadata.file_type,
        is_retry: Boolean(options.isRetry),
        ...getAttributionEventParams(),
      })

      const formData = new FormData()
      formData.append('file', file)
      if (labName) {
        formData.append('lab_name', labName)
      }

      const { data } = await api.post('/analyze/pdf', formData, {
        timeout: 150_000,
        headers: {
          'X-Idempotency-Key': await buildFileIdempotencyKey(file, labName),
        },
      })

      const uploadId = resolveUploadId(data)
      if (!uploadId) {
        throw new Error(copy.fallbackError)
      }

      trackFunnelEvent('funnel_first_upload_completed', 'User completed first lab upload analysis', {
        upload_id: uploadId,
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

      toast.success(copy.analysisComplete)
      const candidatesResponse = await api.get(`/analyze/${uploadId}/candidates`).catch(() => null)
      const candidates = candidatesResponse?.data?.candidates || []
      const qualityGate = candidatesResponse?.data?.analysis_input_quality_gate || data.analysis_input_quality_gate || data.final_analysis?.analysis_input_quality_gate || null
      const gateRequiresConfirmation = Boolean(candidatesResponse?.data?.requires_confirmation || qualityGate?.requires_confirmation)
      const reviewCandidates = candidates.filter(candidate => candidate.requires_confirmation || candidate.confidence_label === 'low')
      if ((gateRequiresConfirmation || reviewCandidates.length > 0) && candidates.length > 0) {
        setCandidateReview({
          uploadId,
          qualityGate,
          candidates: (reviewCandidates.length ? reviewCandidates : candidates).map(candidate => ({
            ...candidate,
            decision: 'confirmed',
            raw_name: candidate.raw_name || '',
            raw_value: candidate.raw_value ?? candidate.parsed_value ?? '',
            raw_unit: candidate.raw_unit || '',
          })),
        })
        return
      }
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
    await handleFile(selectedFile, { isRetry: true })
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
        <CabinetPageHeader
          title={copy.pageTitle}
          subtitle={copy.pageSubtitle(activeConcern)}
          helper={copy.pageHelper}
        />

        <CoachCard className="mb-6 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="coach-eyebrow">{isUk ? 'Процес' : 'Upload flow'}</p>
              <h2 className="text-xl font-extrabold text-slate-950">{isUk ? 'Від файлу до зрозумілого результату' : 'From file to clear results'}</h2>
            </div>
            <CoachBadge tone={analyzing ? 'warning' : candidateReview ? 'primary' : 'neutral'}>
              {analyzing ? (isUk ? 'AI аналізує' : 'AI analysis') : candidateReview ? (isUk ? 'Перевірка' : 'Review') : (isUk ? 'Готово до завантаження' : 'Ready')}
            </CoachBadge>
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

        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Route className="h-4 w-4 text-emerald-600" /> {copy.concernTitle}</div>
            <p className="text-sm text-slate-500">{activeConcern ? copy.concernActive(activeConcern) : copy.concernEmpty}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {copy.answerTitle}</div>
            <p className="text-sm text-slate-500">{isUk ? 'Ключове питання: які маркери потребують уваги в першу чергу.' : 'Core question: which markers need attention first.'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Sparkles className="h-4 w-4 text-emerald-600" /> {copy.nextTitle}</div>
            <p className="text-sm text-slate-500">{isUk ? 'Далі: пріоритети, безпечні наступні кроки і план повторної перевірки.' : 'Then: priorities, safer next steps, and retest direction.'}</p>
          </div>
        </div>

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
              <p className="font-semibold text-blue-800">{copy.profileRequiredTitle}</p>
              <p className="mt-0.5 text-blue-700">
                {copy.profileRequiredBody}
              </p>
              {missingProfileFields.length > 0 && (
                <p className="mt-1 text-xs font-semibold text-blue-800">
                  {copy.missingFieldsPrefix}: {formatMissingProfileFields(missingProfileFields, copy)}.
                </p>
              )}
            </div>
            <button
              onClick={() => navigate('/onboarding')}
              className="ml-1 shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              {copy.profileRequiredCta}
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
	                    {candidateReview.qualityGate && (
	                      <p className="mt-2 inline-flex rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-900">
	                        {copy.reviewQuality(Math.round((candidateReview.qualityGate.score || 0) * 100), candidateReview.qualityGate.decision)}
	                      </p>
	                    )}
	                    {candidateReview.qualityGate && (
	                      <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">
	                        <p className="font-black uppercase tracking-wide">{copy.reviewReasonTitle}</p>
	                        <ul className="mt-1 space-y-1">
	                          {[...(candidateReview.qualityGate.blockers || []), ...(candidateReview.qualityGate.warnings || [])].slice(0, 4).map((item, index) => (
	                            <li key={`${item.key || 'reason'}-${index}`} className="flex gap-2">
	                              <span aria-hidden="true">•</span>
	                              <span>{item.message || item.key || (isUk ? 'Потрібна ручна перевірка даних.' : 'Manual data review is needed.')}</span>
	                            </li>
	                          ))}
	                        </ul>
	                      </div>
	                    )}
		                  </div>
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

            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {isUk ? 'Безпечне завантаження' : 'Secure upload'}</div>
                <p className="text-sm text-slate-500">{isUk ? 'Файл безпечно завантажується й аналізується для структурованого розбору показників.' : 'Your file is securely uploaded and analyzed to extract biomarker context.'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Sparkles className="h-4 w-4 text-emerald-600" /> {isUk ? 'Що буде далі' : 'What unlocks next'}</div>
                <p className="text-sm text-slate-500">{isUk ? 'Пріоритетні показники, звʼязок із симптомами, план дій і напрямок повторної перевірки.' : 'Priority markers, symptom-linked interpretation, protocol updates, and retest direction.'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><AlertCircle className="h-4 w-4 text-amber-500" /> {isUk ? 'Найкраще розпізнавання' : 'Best results'}</div>
                <p className="text-sm text-slate-500">{isUk ? 'Використовуйте чіткий повносторінковий PDF, де видно назви, значення, одиниці та референси.' : 'Use a clear full-page PDF where marker names, values, units, and ranges are readable.'}</p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className={`rounded-xl border px-3 py-2 ${analyzing ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                1. {isUk ? 'Завантаження файлу' : 'Upload file'}
              </div>
              <div className={`rounded-xl border px-3 py-2 ${analyzing ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                2. {isUk ? 'AI-аналіз' : 'AI analysis'}
              </div>
              <div className={`rounded-xl border px-3 py-2 ${!isBusy && selectedFileName ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                3. {isUk ? 'Відкрити результати' : 'Open results'}
              </div>
            </div>

            {errorMessage && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium text-slate-700">{isUk ? 'Назва лабораторії / клініки (необовʼязково)' : 'Lab / Clinic name (optional)'}</label>
              <input
                value={labName}
                disabled={isBusy}
                onChange={(e) => setLabName(e.target.value)}
                placeholder={isUk ? 'Сінево, Діла, інша...' : 'Quest, LabCorp, Other...'}
                className="vtl-focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 disabled:cursor-not-allowed disabled:opacity-60 focus:border-emerald-400 focus:outline-none"
              />
              <p className="mt-2 flex items-start gap-2 text-xs text-slate-500">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>{isUk ? '* Якщо лабораторії ще немає в базі, це нормально. Ви все одно можете завантажити PDF.' : '* If your clinic or lab is not recognized yet, it is still fine. Our lab database is still growing and more providers will be added soon.'}</span>
              </p>
            </div>

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

              {!analyzing && <UploadZone onFile={handleFile} onError={handleUploadZoneError} disabled={isBusy || profileChecking || profileIncomplete} />}
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
