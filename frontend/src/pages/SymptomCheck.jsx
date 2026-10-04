import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  FileUp,
  HeartPulse,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react'
import CabinetPageFrame from '../components/dashboard/CabinetPageFrame.jsx'
import ControlledSymptomFallback from './ControlledSymptomFallback.jsx'
import {
  abandonSymptomSession,
  createSymptomSession,
  getCurrentSymptomSession,
  getRootConcernCatalog,
  getSymptomSessionSummary,
  regenerateSymptomLinkedReport,
  skipSymptomSession,
  submitInitialSymptomEvidence,
  submitSymptomAnswers,
} from '../api/symptomCheck.js'
import '../styles/coach-design-system.css'


const WELLBEING_OPTIONS = [
  { id: 'good', label: 'Good — I feel well today' },
  { id: 'mostly_good', label: 'Mostly good — a few minor concerns' },
  { id: 'reduced', label: 'Reduced — something is affecting how I feel' },
  { id: 'poor', label: 'Poor — I feel significantly unwell' },
]

const DURATION_OPTIONS = [
  { id: 'today', label: 'Started today' },
  { id: 'days_2_7', label: '2–7 days' },
  { id: 'weeks_1_4', label: '1–4 weeks' },
  { id: 'months_1_3', label: '1–3 months' },
  { id: 'months_3_plus', label: 'More than 3 months' },
  { id: 'intermittent', label: 'Comes and goes' },
  { id: 'unknown', label: 'Not sure' },
]

const SAFETY_COPY = {
  emergency: {
    title: 'Get emergency help now',
    body: 'Your answers may indicate a serious medical emergency. This symptom check cannot determine the cause.',
    action: 'Call your local emergency number now. Do not drive yourself. If possible, ask someone to stay with you and follow the emergency dispatcher’s instructions.',
    tone: 'critical',
  },
  urgent_24h: {
    title: 'Contact a medical professional within 24 hours',
    body: 'Your answers indicate that prompt medical assessment is appropriate.',
    action: 'Arrange medical care within 24 hours. If symptoms suddenly worsen or you develop an emergency warning sign, call your local emergency number.',
    tone: 'warning',
  },
  clinician_review: {
    title: 'Arrange a medical consultation',
    body: 'A medical professional should review these symptoms.',
    action: 'Schedule a consultation. Seek urgent help sooner if symptoms worsen.',
    tone: 'warning',
  },
  insufficient_data: {
    title: 'We could not complete a safe assessment',
    body: 'This does not mean that nothing is wrong.',
    action: 'Try the symptom check again or contact a medical professional. If symptoms are severe or rapidly worsening, call your local emergency number.',
    tone: 'warning',
  },
  routine: {
    title: 'Monitor how you feel',
    body: 'Your answers did not trigger an urgent next step in this symptom check.',
    action: 'Monitor your symptoms and contact a medical professional if they persist, worsen, or new symptoms appear.',
    tone: 'success',
  },
}

function apiError(error, fallback) {
  const detail = error?.response?.data?.detail
  if (detail && typeof detail === 'object' && typeof detail.detail === 'string') return detail.detail
  if (typeof detail === 'string') return detail
  return fallback
}

function requestKey() {
  return window.crypto?.randomUUID?.() || `symptom-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function stageFromSession(session) {
  if (!session) return 'start'
  if (session.safety?.interrupt || session.safety?.level === 'emergency') return 'emergency'
  if (session.status === 'unsupported') return 'unsupported'
  if (session.status !== 'active') return 'result'
  if (session.stage === 1) return 'initial'
  return 'adaptive'
}

function StepHeader({ stage }) {
  const active = stage === 'start' ? 1 : stage === 'initial' ? 2 : 3
  const steps = ['Current state', 'Main signals', 'Adaptive detail']
  return (
    <div className="grid gap-3" aria-label={`Step ${active} of 3`}>
      <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        <span>Structured symptom check</span>
        <span>Step {active} of 3</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {steps.map((label, index) => (
          <div key={label} className="grid gap-1.5">
            <span className={`h-2 rounded-full ${index < active ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            <span className={`hidden text-[11px] font-semibold sm:block ${index < active ? 'text-emerald-800' : 'text-slate-400'}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange, options, placeholder, disabled = false }) {
  return (
    <label className="coach-field">
      <span className="coach-field__label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function SafetyPanel({ level, emergency = false }) {
  const copy = SAFETY_COPY[level] || SAFETY_COPY.insufficient_data
  const Icon = emergency ? ShieldAlert : copy.tone === 'success' ? CheckCircle2 : AlertTriangle
  const styles = emergency
    ? 'border-red-300 bg-red-50 text-red-950'
    : copy.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
      : 'border-amber-200 bg-amber-50 text-amber-950'
  return (
    <section
      role={emergency ? 'alert' : 'status'}
      aria-live={emergency ? 'assertive' : 'polite'}
      className={`rounded-[24px] border p-6 sm:p-8 ${styles}`}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/75 shadow-sm">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">{copy.title}</h2>
          <p className="mt-2 leading-7">{copy.body}</p>
          <p className="mt-3 font-bold leading-7">{copy.action}</p>
        </div>
      </div>
    </section>
  )
}

export default function SymptomCheck() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState(null)
  const [stage, setStage] = useState('start')
  const [error, setError] = useState('')
  const [overallWellbeing, setOverallWellbeing] = useState('')
  const [concernId, setConcernId] = useState('')
  const [primaryConceptId, setPrimaryConceptId] = useState('')
  const [secondaryConceptIds, setSecondaryConceptIds] = useState(['', ''])
  const [durationBucket, setDurationBucket] = useState('')
  const [answers, setAnswers] = useState({})
  const [pendingSubmission, setPendingSubmission] = useState(null)
  const [reportUpdate, setReportUpdate] = useState(null)
  const [reportUpdating, setReportUpdating] = useState(false)

  const availableConcerns = useMemo(
    () => catalog.filter((item) => item.available),
    [catalog],
  )
  const initialOptions = session?.initial_options || []
  const question = session?.question || null

  function applySession(nextSession) {
    setSession(nextSession)
    setStage(stageFromSession(nextSession))
    setAnswers({})
    setPendingSubmission(null)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [catalogData, currentData] = await Promise.all([
          getRootConcernCatalog(),
          getCurrentSymptomSession(),
        ])
        if (cancelled) return
        setCatalog(catalogData.items || [])
        applySession(currentData.session || null)
      } catch (loadError) {
        if (cancelled) return
        if (loadError?.response?.status === 404) {
          setStage('unavailable')
        } else {
          setStage('load_error')
          setError(apiError(loadError, 'We could not load Symptom Check. Please try again.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!question?.id) return
    setAnswers({})
    setPendingSubmission(null)
  }, [question?.id])

  async function startSession(event) {
    event.preventDefault()
    if (!overallWellbeing || !concernId) {
      setError('Select both your current wellbeing and the main area you want to highlight.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await createSymptomSession({
        overall_wellbeing: overallWellbeing,
        primary_concern_id: concernId,
      })
      applySession(data.session)
      if (data.session?.status !== 'active') {
        setReportUpdate(data.report_update || null)
        const summaryData = await getSymptomSessionSummary(data.session.id)
        setSummary(summaryData.summary)
      }
    } catch (submitError) {
      setError(apiError(submitError, 'We could not start the symptom check.'))
    } finally {
      setBusy(false)
    }
  }

  async function submitInitial(event) {
    event.preventDefault()
    if (!primaryConceptId || !durationBucket) {
      setError('Select the main signal and how long it has been present.')
      return
    }
    const secondary = secondaryConceptIds.filter(Boolean).filter((id) => id !== primaryConceptId)
    setBusy(true)
    setError('')
    try {
      const data = await submitInitialSymptomEvidence(session.id, {
        primary_concept_id: primaryConceptId,
        secondary_concept_ids: [...new Set(secondary)],
        duration_bucket: durationBucket,
      })
      applySession(data.session)
      if (data.session?.status !== 'active') {
        setReportUpdate(data.report_update || null)
        const summaryData = await getSymptomSessionSummary(data.session.id)
        setSummary(summaryData.summary)
      }
    } catch (submitError) {
      setError(apiError(submitError, 'Your selections were saved, but the next question is not available. Please retry.'))
    } finally {
      setBusy(false)
    }
  }

  async function submitAdaptive(event) {
    event.preventDefault()
    const items = question?.items || []
    if (!items.length || items.some((item) => !answers[item.id])) {
      setError('Choose one controlled answer for every item shown.')
      return
    }
    const payload = {
      question_id: question.id,
      answers: items.map((item) => ({ item_id: item.id, choice_id: answers[item.id] })),
    }
    const serialized = JSON.stringify(payload)
    const idempotencyKey = pendingSubmission?.payload === serialized
      ? pendingSubmission.key
      : requestKey()
    setPendingSubmission({ payload: serialized, key: idempotencyKey })
    setBusy(true)
    setError('')
    try {
      const data = await submitSymptomAnswers(session.id, payload, idempotencyKey)
      applySession(data.session)
      if (data.session?.status !== 'active') {
        setReportUpdate(data.report_update || null)
        const summaryData = await getSymptomSessionSummary(data.session.id)
        setSummary(summaryData.summary)
      }
    } catch (submitError) {
      setError(apiError(submitError, 'We could not safely process this answer. Your progress is saved; retry shortly.'))
    } finally {
      setBusy(false)
    }
  }

  async function skipCheck() {
    setBusy(true)
    setError('')
    try {
      await skipSymptomSession(session.id)
      navigate('/dashboard')
    } catch (skipError) {
      setError(apiError(skipError, 'This check can no longer be skipped.'))
    } finally {
      setBusy(false)
    }
  }

  async function endCheck() {
    setBusy(true)
    setError('')
    try {
      await abandonSymptomSession(session.id)
      setSession(null)
      setStage('start')
      setAnswers({})
      setPrimaryConceptId('')
      setSecondaryConceptIds(['', ''])
      setDurationBucket('')
      setReportUpdate(null)
    } catch (abandonError) {
      setError(apiError(abandonError, 'We could not end this check.'))
    } finally {
      setBusy(false)
    }
  }

  function updateAnswer(itemId, choiceId) {
    setAnswers((current) => ({ ...current, [itemId]: choiceId }))
    setPendingSubmission(null)
  }

  async function updateLatestReport() {
    if (!reportUpdate?.update_available || !reportUpdate?.action?.endpoint) return
    setReportUpdating(true)
    setError('')
    try {
      await regenerateSymptomLinkedReport(reportUpdate.action.endpoint)
      navigate(reportUpdate.action.path || `/results/${reportUpdate.report_upload_id}`)
    } catch (updateError) {
      setError(apiError(updateError, 'We could not update your latest report. Your symptom answers are saved.'))
    } finally {
      setReportUpdating(false)
    }
  }

  if (loading) {
    return (
      <CabinetPageFrame>
        <div className="flex min-h-[420px] items-center justify-center" aria-busy="true">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="sr-only">Loading Symptom Check</span>
        </div>
      </CabinetPageFrame>
    )
  }

  if (stage === 'unavailable') {
    return <ControlledSymptomFallback />
  }

  if (stage === 'load_error') {
    return (
      <CabinetPageFrame>
        <div className="coach-shell mx-auto max-w-3xl">
          <div className="coach-hero grid gap-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><Stethoscope /></span>
            <div>
              <p className="coach-eyebrow">Symptom Check</p>
              <h1 className="coach-title-xl">We could not load Symptom Check</h1>
              <p className="coach-body mt-3">{error || 'Your saved progress is safe. Return to the dashboard or upload existing lab results.'}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="coach-button coach-button--primary coach-button--md" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
              <button className="coach-button coach-button--secondary coach-button--md" onClick={() => navigate('/upload')}>Upload lab results</button>
            </div>
          </div>
        </div>
      </CabinetPageFrame>
    )
  }

  if (stage === 'emergency') {
    return (
      <CabinetPageFrame>
        <div className="coach-shell mx-auto grid max-w-3xl gap-5">
          <SafetyPanel level="emergency" emergency />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
            VITALOOP does not provide emergency care and cannot continue this interview after an emergency warning signal.
          </div>
          <button className="coach-button coach-button--secondary coach-button--md justify-self-start" onClick={() => navigate('/dashboard')}>Return to dashboard</button>
        </div>
      </CabinetPageFrame>
    )
  }

  if (stage === 'unsupported') {
    return (
      <CabinetPageFrame>
        <div className="coach-shell mx-auto max-w-3xl">
          <div className="coach-hero grid gap-5">
            <AlertCircle className="h-10 w-10 text-amber-600" />
            <div>
              <p className="coach-eyebrow">Outside the current controlled flow</p>
              <h1 className="coach-title-xl">This concern is not covered yet</h1>
              <p className="coach-body mt-3">We will not collect free text that the clinical engine cannot use. Contact a qualified medical professional if you need assessment, or continue with existing lab results.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="coach-button coach-button--primary coach-button--md" onClick={() => navigate('/upload')}><FileUp className="h-4 w-4" /> Upload lab results</button>
              <button className="coach-button coach-button--secondary coach-button--md" onClick={() => navigate('/dashboard')}>Dashboard</button>
            </div>
          </div>
        </div>
      </CabinetPageFrame>
    )
  }

  if (stage === 'result') {
    const safetyLevel = summary?.safety?.level || session?.safety?.level || 'insufficient_data'
    return (
      <CabinetPageFrame>
        <div className="coach-shell mx-auto grid max-w-4xl gap-5">
          <SafetyPanel level={safetyLevel} />
          <section className="coach-card grid gap-5 p-6 sm:p-8">
            <div>
              <p className="coach-eyebrow">Assessment saved</p>
              <h1 className="coach-title-lg">Your structured symptom context is ready</h1>
              <p className="coach-body mt-2">Use it as context for your lab results and future comparisons. It is not a diagnosis.</p>
            </div>
            {reportUpdate?.update_available && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
                <h2 className="font-extrabold">Your latest report does not include these answers yet</h2>
                <p className="mt-1 text-sm leading-6">
                  Update it to recalculate explanation priorities and show what changed because of this symptom check.
                </p>
                <button
                  type="button"
                  disabled={reportUpdating}
                  onClick={updateLatestReport}
                  className="coach-button coach-button--primary coach-button--md mt-4"
                >
                  {reportUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {reportUpdating ? 'Updating report…' : 'Update latest report'}
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button className="coach-button coach-button--primary coach-button--md" onClick={() => navigate('/upload')}><FileUp className="h-4 w-4" /> Upload lab results</button>
              <button className="coach-button coach-button--secondary coach-button--md" onClick={() => navigate('/dashboard')}>Dashboard</button>
            </div>
          </section>
        </div>
      </CabinetPageFrame>
    )
  }

  return (
    <CabinetPageFrame>
      <div className="coach-shell mx-auto grid max-w-5xl gap-5">
        <header className="coach-hero grid gap-6">
          <StepHeader stage={stage} />
          <div className="relative z-10 max-w-3xl">
            <p className="coach-eyebrow">Clear inputs, adaptive questions</p>
            <h1 className="coach-title-xl">
              {stage === 'start' && 'Start with how you feel today'}
              {stage === 'initial' && 'Highlight the signals that matter most'}
              {stage === 'adaptive' && 'A few focused follow-up questions'}
            </h1>
            <p className="coach-body mt-3">
              {stage === 'start' && 'Choose from structured options only. Good wellbeing is valid too — this check is not built on the assumption that everyone is unwell.'}
              {stage === 'initial' && 'Select one main signal, up to two related signals, and the closest duration. These IDs are passed to the clinical engine exactly as selected.'}
              {stage === 'adaptive' && 'Your previous answers determine what appears next. No free-text medical fields are used or discarded.'}
            </p>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {stage === 'start' && (
          <form onSubmit={startSession} className="coach-card grid gap-6 p-6 sm:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <SelectField
                label="How do you feel overall today?"
                value={overallWellbeing}
                onChange={setOverallWellbeing}
                options={WELLBEING_OPTIONS}
                placeholder="Select current wellbeing"
              />
              <SelectField
                label="What would you like to highlight?"
                value={concernId}
                onChange={setConcernId}
                options={availableConcerns}
                placeholder="Select one main area"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <p className="max-w-xl text-sm leading-6 text-slate-500">The assessment organizes context and urgency. It does not diagnose a condition.</p>
              <button disabled={busy} className="coach-button coach-button--primary coach-button--md">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartPulse className="h-4 w-4" />}
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        {stage === 'initial' && (
          <form onSubmit={submitInitial} className="coach-card grid gap-6 p-6 sm:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <SelectField
                label="Main signal"
                value={primaryConceptId}
                onChange={(value) => { setPrimaryConceptId(value); setSecondaryConceptIds(['', '']) }}
                options={initialOptions}
                placeholder="Select the main signal"
              />
              <SelectField
                label="How long has it been present?"
                value={durationBucket}
                onChange={setDurationBucket}
                options={DURATION_OPTIONS}
                placeholder="Select the closest duration"
              />
              <SelectField
                label="Related signal (optional)"
                value={secondaryConceptIds[0]}
                onChange={(value) => setSecondaryConceptIds([value, secondaryConceptIds[1]])}
                options={initialOptions.filter((item) => item.id !== primaryConceptId && item.id !== secondaryConceptIds[1])}
                placeholder="Select if relevant"
                disabled={!primaryConceptId}
              />
              <SelectField
                label="Another related signal (optional)"
                value={secondaryConceptIds[1]}
                onChange={(value) => setSecondaryConceptIds([secondaryConceptIds[0], value])}
                options={initialOptions.filter((item) => item.id !== primaryConceptId && item.id !== secondaryConceptIds[0])}
                placeholder="Select if relevant"
                disabled={!primaryConceptId}
              />
            </div>
            {!initialOptions.length && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">No clinically approved options are available for this area yet.</div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button type="button" disabled={busy} onClick={skipCheck} className="coach-button coach-button--ghost coach-button--md">Skip symptom check</button>
              <button disabled={busy || !initialOptions.length} className="coach-button coach-button--primary coach-button--md">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Start adaptive questions <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        {stage === 'adaptive' && (
          <form onSubmit={submitAdaptive} className="coach-card grid gap-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="coach-eyebrow">Question {question?.sequence || session?.stage || ''}</p>
                <h2 className="coach-title-lg">{question?.text || 'Choose the closest answer for each item'}</h2>
              </div>
              {question?.source === 'red_flags' && <span className="coach-badge coach-badge--warning"><ShieldAlert className="h-3.5 w-3.5" /> Safety check</span>}
            </div>
            <div className="grid gap-5">
              {(question?.items || []).map((item) => (
                <SelectField
                  key={item.id}
                  label={item.label}
                  value={answers[item.id] || ''}
                  onChange={(value) => updateAnswer(item.id, value)}
                  options={item.choices || []}
                  placeholder="Select one answer"
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button type="button" disabled={busy} onClick={endCheck} className="coach-button coach-button--ghost coach-button--md"><ChevronLeft className="h-4 w-4" /> End this check</button>
              <button disabled={busy || !(question?.items || []).length} className="coach-button coach-button--primary coach-button--md">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Save and continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        <aside className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/75 p-4 text-sm leading-6 text-slate-600">
          <Stethoscope className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <span>Only the options shown are stored. If your concern is not represented, VITALOOP will say so instead of collecting clinical text the engine cannot use.</span>
        </aside>
      </div>
    </CabinetPageFrame>
  )
}
