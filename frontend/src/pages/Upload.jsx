import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Building2, CheckCircle2, Route, Sparkles, UserCircle2 } from 'lucide-react'
import HintBanner from '../components/tour/HintBanner.jsx'
import { useTourHints } from '../hooks/useTourHints.js'
import { useSubscription } from '../hooks/useSubscription.js'
import UploadZone from '../components/UploadZone.jsx'
import ManualBiomarkerEntry from '../components/ManualBiomarkerEntry.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import AnalysisProgressIndicator from '../components/AnalysisProgressIndicator.jsx'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaLabUpload } from '../lib/analytics.js'
import toast from 'react-hot-toast'
import { PREMIUM_PRICE_LABEL } from '../lib/pricing.js'
import { useQuestionnaireSession } from '../hooks/useQueries.js'
import { isUkrainianLocale } from '../lib/locale.js'
import '../styles/dashboard2026.css'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

// Canonical support claim: PDF only
const SUPPORTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
}

const UPLOAD_HINTS = [
  '📄 Upload your lab report PDF in the context of an active concern.',
  '🧭 Keep report quality high: clear PDF with marker names, values, units, and ranges.',
  '✅ After upload, open Results & Trends to see priorities and next actions.',
]

const LOADING_MESSAGES = [
  '📤 Uploading your lab report...',
  '🧠 AI is analyzing your biomarkers...',
  '📋 Generating your personalized protocol...',
  '💊 Finalizing supplement recommendations...',
  '✅ Almost ready...',
]

const UPLOAD_COPY = {
  en: {
    hints: UPLOAD_HINTS,
    loadingMessages: LOADING_MESSAGES,
    profileIncomplete: 'Complete profile first',
    uploading: (name, kb) => `Uploading ${name}… (${kb}KB)`,
    analysisComplete: 'Analysis complete!',
    longerWarning: 'This is taking longer than usual. Large PDFs may take 1-2 minutes.',
    validationNoFile: 'No file selected. Please choose a lab report.',
    validationUnsupported: 'Unsupported file type. Please upload a PDF file.',
    validationLarge: 'File is too large. Please upload a file under 20MB.',
    biomarkersNotExtracted: 'Could not detect biomarkers in this report format. Try a clearer full-page PDF with names, values, and ranges visible.',
    formatNotRecognized: 'Lab report format not recognized. Please upload a standard lab PDF.',
    invalidFileType: 'Please upload a valid PDF file.',
    fileTooLarge: 'File too large for processing. Please upload a file under 20MB.',
    tooMany: 'Too many uploads. Please wait and try again later.',
    fallbackError: 'Analysis failed. Please try again.',
    quotaManual: 'You\'ve already entered biomarkers manually. Free plan includes 1 lab analysis (either PDF upload or manual entry). Upgrade to Premium for unlimited analyses, advanced protocols, and health tracking.',
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
  },
  uk: {
    hints: [
      '📄 Завантажте PDF з аналізами в контексті конкретної скарги або цілі.',
      '🧭 Додайте симптоми, щоб аналіз відповідав на реальне питання, а не просто читав бланк.',
      '✅ Після обробки відкрийте результати й динаміку: що важливо зараз і що перевірити повторно.',
    ],
    loadingMessages: [
      '📤 Завантажуємо ваш PDF...',
      '🧠 AI аналізує показники...',
      '📋 Формуємо персональний підсумок...',
      '💊 Уточнюємо пріоритети дій...',
      '✅ Майже готово...',
    ],
    profileIncomplete: 'Спочатку заповніть профіль',
    uploading: (name, kb) => `Завантажуємо ${name}… (${kb}KB)`,
    analysisComplete: 'Аналіз готовий!',
    longerWarning: 'Обробка триває довше, ніж зазвичай. Великі PDF можуть займати 1-2 хвилини.',
    validationNoFile: 'Файл не обрано. Завантажте PDF з аналізами.',
    validationUnsupported: 'Непідтримуваний тип файлу. Завантажте PDF.',
    validationLarge: 'Файл завеликий. Завантажте файл до 20MB.',
    biomarkersNotExtracted: 'Не вдалося розпізнати показники в цьому форматі. Спробуйте чіткіший PDF, де видно назви, значення та референси.',
    formatNotRecognized: 'Формат бланка не розпізнано. Завантажте стандартний PDF з лабораторії.',
    invalidFileType: 'Завантажте коректний PDF-файл.',
    fileTooLarge: 'Файл завеликий для обробки. Завантажте файл до 20MB.',
    tooMany: 'Забагато спроб. Зачекайте і спробуйте ще раз.',
    fallbackError: 'Аналіз не вдався. Спробуйте ще раз.',
    quotaManual: 'Ви вже ввели показники вручну. Безкоштовний план включає 1 аналіз: PDF або ручне введення. Premium відкриває необмежені аналізи, розширені плани та динаміку.',
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

export default function Upload() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isPremium, uploadsRemaining, loading: subLoading } = useSubscription()
  const { show: showHints, dismiss: dismissHints } = useTourHints('upload')
  const [uploadMode, setUploadMode] = useState('pdf') // 'pdf' | 'manual'
  const [labName, setLabName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [profileIncomplete, setProfileIncomplete] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0])
  const [loadingWarning, setLoadingWarning] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
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

      const { data } = await api.post('/analyze/pdf', formData)

      trackFunnelEvent('funnel_first_upload_completed', 'User completed first lab upload analysis', {
        upload_id: data.upload_id,
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
      navigate(`/results/${data.upload_id}`)
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

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-6xl">
        <CabinetPageHeader
          title={copy.pageTitle}
          subtitle={copy.pageSubtitle(activeConcern)}
          helper={copy.pageHelper}
        />

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

        {showHints && (
          <HintBanner hints={copy.hints} onDone={dismissHints} />
        )}

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
              {isUk ? 'Безкоштовний аналіз уже використано. Можна завантажити PDF або ввести вручну, але не обидва варіанти.' : 'Your free biomarker entry was already used. You can upload a PDF OR enter manually, but not both.'}
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
            {isUk ? 'Безкоштовний план: 1 аналіз показників через PDF або ручне введення.' : 'Free plan: 1 biomarker entry allowed (via PDF upload or manual entry).'}
          </div>
        )}

        {uploadMode === 'pdf' ? (
          <>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {isUk ? 'Безпечне завантаження' : 'Secure upload'}</div>
                <p className="text-sm text-slate-500">{isUk ? 'PDF безпечно завантажується й аналізується для структурованого розбору показників.' : 'Your PDF is securely uploaded and analyzed to extract biomarker context.'}</p>
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
                1. {isUk ? 'Завантаження PDF' : 'Upload PDF'}
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
                      <p className="mt-1 text-xs text-rose-700">{isUk ? 'Спробуйте завантажити чіткіший повносторінковий PDF із кабінету лабораторії.' : 'Try uploading a clearer full-page PDF from your lab portal.'}</p>
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
