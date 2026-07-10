import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ClipboardList, Pill, Route, ShieldAlert, Stethoscope } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { CoachBadge, CoachButton, CoachCard, CoachChip, CoachInput, CoachProgress, CoachSkeleton, EmptyCoachState, InsightCard } from '../components/coach/CoachUI.jsx'
import api from '../lib/api.js'

const BODY_SYSTEMS = ['General', 'Neurological', 'Cardiometabolic', 'Hormonal', 'Digestive', 'Musculoskeletal', 'Recovery']
const DURATION_OPTIONS = ['< 1 week', '1-4 weeks', '1-3 months', '3-6 months', '6+ months']
const RELATED_SYMPTOMS = ['Fatigue', 'Poor sleep', 'Brain fog', 'Hair shedding', 'Low mood', 'Digestive issues', 'Cravings', 'Low stamina']

const WIZARD_STEPS = [
  { title: 'Main concern', helper: 'Required', why: 'This anchors the analysis around what you actually want to improve.' },
  { title: 'Duration', helper: 'Optional', why: 'Timing helps separate a new issue from a pattern that needs trend review.' },
  { title: 'Related symptoms', helper: 'Choose what fits', why: 'Symptom clusters help prioritize the lab markers worth checking first.' },
  { title: 'Medications & supplements', helper: 'Context', why: 'Some markers and recommendations depend on current medications or supplements.' },
  { title: 'Safety questions', helper: 'Required', why: 'Red flags change the safest next step and may require clinician review.' },
]

function parseApiError(err, fallback) {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (typeof detail?.detail === 'string') return detail.detail
  return fallback
}

function scoreReadiness({ concern, duration, severity, bodySystem, related, meds }) {
  let score = 20
  if (concern.trim().length >= 6) score += 24
  if (duration) score += 10
  if (severity >= 4) score += 10
  if (bodySystem) score += 12
  if (related.trim().length >= 4) score += 12
  if (meds.trim().length >= 3) score += 8
  return Math.max(20, Math.min(98, score))
}

function urgencyGuidance(redFlags) {
  const activeCount = Object.values(redFlags).filter(Boolean).length
  if (activeCount === 0) return 'No urgent red flags reported.'
  if (activeCount <= 2) return 'Some answers suggest timely clinician review is important.'
  return 'Multiple red flags detected. Do not delay medical review.'
}

function saveConcernContext(payload) {
  return api.patch('/questionnaire/session/context', {
    active_concern: payload.concern,
    summary: payload,
  })
}

function NumericScale({ value, onChange }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between text-sm font-bold text-slate-700">
        <span>Intensity</span>
        <span>{value}/10</span>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onChange(num)}
            className={`min-h-12 rounded-2xl border text-sm font-extrabold transition ${
              value === num
                ? 'border-teal-500 bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Questionnaire() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [nextQuestion, setNextQuestion] = useState(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [remainingCount, setRemainingCount] = useState(0)
  const [results, setResults] = useState(null)

  const [concern, setConcern] = useState('')
  const [duration, setDuration] = useState('')
  const [severity, setSeverity] = useState(5)
  const [bodySystem, setBodySystem] = useState('')
  const [relatedSymptoms, setRelatedSymptoms] = useState('')
  const [medications, setMedications] = useState('')
  const [supplements, setSupplements] = useState('')
  const [whatTried, setWhatTried] = useState('')
  const [answerValue, setAnswerValue] = useState(5)
  const [answerText, setAnswerText] = useState('')
  const [redFlags, setRedFlags] = useState({
    severeOnset: false,
    fever: false,
    swelling: false,
    numbnessWeakness: false,
    chestBreath: false,
    trauma: false,
    pregnancyContext: false,
  })

  const readiness = useMemo(
    () => scoreReadiness({ concern, duration, severity, bodySystem, related: relatedSymptoms, meds: medications }),
    [concern, duration, severity, bodySystem, relatedSymptoms, medications]
  )
  const urgency = useMemo(() => urgencyGuidance(redFlags), [redFlags])
  const progress = Math.round(((step + 1) / WIZARD_STEPS.length) * 100)
  const selectedRelated = relatedSymptoms.split(',').map((item) => item.trim()).filter(Boolean)

  async function loadSession() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/questionnaire/session')
      setNextQuestion(data?.next_question || null)
      setAnsweredCount(Number(data?.answered_count || 0))
      setRemainingCount(Number(data?.remaining_count || 0))
      const sessionContext = data?.session_context || data?.session?.session_metadata || {}
      if (sessionContext?.active_concern) setConcern(sessionContext.active_concern)
      if (sessionContext?.summary) {
        const summary = sessionContext.summary || {}
        setDuration(summary.duration || '')
        setSeverity(Number(summary.severity || 5))
        setBodySystem(summary.bodySystem || summary.body_system || '')
        setRelatedSymptoms(summary.relatedSymptoms || summary.related_symptoms || '')
        setMedications(summary.medications || '')
        setSupplements(summary.supplements || '')
        setWhatTried(summary.whatTried || summary.what_tried || '')
        setRedFlags((prev) => ({ ...prev, ...(summary.redFlags || summary.red_flags || {}) }))
      }
    } catch (err) {
      setError(parseApiError(err, 'Failed to load symptom check.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSession()
  }, [])

  function toggleRelated(label) {
    const next = selectedRelated.includes(label)
      ? selectedRelated.filter((item) => item !== label)
      : [...selectedRelated, label]
    setRelatedSymptoms(next.join(', '))
  }

  function canContinue() {
    if (step === 0) return concern.trim().length >= 3
    return true
  }

  async function saveWizardContext() {
    await saveConcernContext({
      concern,
      duration,
      severity,
      bodySystem,
      relatedSymptoms,
      medications,
      supplements,
      whatTried,
      readiness,
      urgency,
      redFlags,
      linkedLabs: [],
    })
    await queryClient.invalidateQueries({ queryKey: ['questionnaire-session'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
  }

  async function handleNext() {
    if (!canContinue()) {
      toast.error('Add your main concern before continuing.')
      return
    }
    if (step < WIZARD_STEPS.length - 1) {
      setStep((prev) => prev + 1)
      return
    }
    setSaving(true)
    try {
      await saveWizardContext()
      toast.success('Symptom context saved')
      if (nextQuestion?.id) {
        setStep(WIZARD_STEPS.length)
      } else {
        navigate('/lab-plan')
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to save symptom context.'))
    } finally {
      setSaving(false)
    }
  }

  async function submitAnswer() {
    if (!nextQuestion?.id) return
    setSaving(true)
    try {
      const { data } = await api.post('/questionnaire/answer', {
        question_id: nextQuestion.id,
        answer_value: Number(answerValue),
        answer_text: answerText || null,
      })
      setNextQuestion(data?.next_question || null)
      setAnsweredCount(Number(data?.answered_count || answeredCount))
      setRemainingCount(Number(data?.remaining_count || remainingCount))
      setAnswerValue(5)
      setAnswerText('')

      if (data?.completed || !data?.next_question) {
        const completeResp = await api.post('/questionnaire/complete', { mark_onboarding_complete: true })
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['profile'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
          queryClient.invalidateQueries({ queryKey: ['timeline'] }),
          queryClient.invalidateQueries({ queryKey: ['insights'] }),
          queryClient.invalidateQueries({ queryKey: ['health-score'] }),
        ])
        setResults(completeResp?.data?.session || {})
        toast.success('Symptom check completed')
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to save answer.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="coach-shell"><CoachSkeleton rows={4} /></div>
  if (error) {
    return (
      <div className="coach-shell">
        <EmptyCoachState title="Symptom check is unavailable" body={error} actionLabel="Try again" onAction={loadSession} />
      </div>
    )
  }

  return (
    <div className="coach-shell coach-grid">
      <section className="coach-hero">
        <p className="coach-eyebrow">Symptom-first intake</p>
        <h1 className="coach-title-xl">Tell VITALOOP what feels off.</h1>
        <p className="coach-body mt-4 max-w-2xl">Low barrier first, precise context next. We use this to connect symptoms, labs, safety context, and your next step.</p>
      </section>

      <div className="coach-grid coach-grid--2">
        <CoachCard className="p-5 sm:p-6">
          {step < WIZARD_STEPS.length && (
            <>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CoachBadge tone="primary">Step {step + 1} of {WIZARD_STEPS.length}</CoachBadge>
                  <h2 className="coach-title-lg mt-3">{WIZARD_STEPS[step].title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{WIZARD_STEPS[step].helper}</p>
                </div>
                <div className="w-full sm:w-56">
                  <CoachProgress value={progress} label="Progress" />
                </div>
              </div>

              {step === 0 && (
                <div className="grid gap-5">
                  <CoachInput label="What is the main thing you want to understand or improve?" helper="Example: fatigue and hair shedding for the last 2 months.">
                    <textarea value={concern} onChange={(e) => setConcern(e.target.value)} placeholder="Describe the main concern" />
                  </CoachInput>
                  <NumericScale value={severity} onChange={setSeverity} />
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-5">
                  <CoachInput label="How long has this been going on?" helper="Optional, but useful for deciding if we should look at trends.">
                    <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                      <option value="">Select duration</option>
                      {DURATION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </CoachInput>
                  <CoachInput label="Body system or area" helper="Choose the closest fit.">
                    <select value={bodySystem} onChange={(e) => setBodySystem(e.target.value)}>
                      <option value="">Select area</option>
                      {BODY_SYSTEMS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </CoachInput>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-5">
                  <div className="flex flex-wrap gap-2">
                    {RELATED_SYMPTOMS.map((label) => (
                      <CoachChip key={label} active={selectedRelated.includes(label)} onClick={() => toggleRelated(label)}>
                        {label}
                      </CoachChip>
                    ))}
                  </div>
                  <CoachInput label="Anything else?" helper="Optional free text for symptoms not listed above.">
                    <textarea value={whatTried} onChange={(e) => setWhatTried(e.target.value)} placeholder="What changed recently? What did you already try?" />
                  </CoachInput>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <CoachInput label="Current medications" helper="Include dose if you know it.">
                    <textarea value={medications} onChange={(e) => setMedications(e.target.value)} placeholder="Example: metformin, levothyroxine, antihistamines" />
                  </CoachInput>
                  <CoachInput label="Current supplements" helper="This helps avoid unsafe recommendations.">
                    <textarea value={supplements} onChange={(e) => setSupplements(e.target.value)} placeholder="Example: vitamin D, iron, magnesium" />
                  </CoachInput>
                </div>
              )}

              {step === 4 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries({
                    severeOnset: 'Sudden severe onset',
                    fever: 'Fever',
                    swelling: 'Swelling',
                    numbnessWeakness: 'Numbness or weakness',
                    chestBreath: 'Chest pain or shortness of breath',
                    trauma: 'Recent trauma',
                    pregnancyContext: 'Pregnancy context',
                  }).map(([key, label]) => (
                    <label key={key} className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                      <input type="checkbox" checked={Boolean(redFlags[key])} onChange={(e) => setRedFlags((prev) => ({ ...prev, [key]: e.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
              )}

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <CoachButton variant="secondary" icon={ChevronLeft} disabled={step === 0 || saving} onClick={() => setStep((prev) => Math.max(0, prev - 1))}>
                  Back
                </CoachButton>
                <CoachButton onClick={handleNext} disabled={saving} trailingIcon={ArrowRight}>
                  {step === WIZARD_STEPS.length - 1 ? (saving ? 'Saving...' : 'Save and continue') : 'Continue'}
                </CoachButton>
              </div>
            </>
          )}

          {step >= WIZARD_STEPS.length && !results && (
            <div className="grid gap-5">
              <CoachBadge tone="primary">Smart follow-up</CoachBadge>
              {nextQuestion ? (
                <>
                  <h2 className="coach-title-lg">{nextQuestion.text}</h2>
                  <NumericScale value={answerValue} onChange={setAnswerValue} />
                  <CoachInput label="Optional context">
                    <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Add detail if it helps." />
                  </CoachInput>
                  <CoachButton onClick={submitAnswer} disabled={saving}>{saving ? 'Saving...' : 'Next question'}</CoachButton>
                </>
              ) : (
                <EmptyCoachState title="Your symptom context is ready" body="Open your lab plan to see what is worth checking first." actionLabel="Open lab plan" onAction={() => navigate('/lab-plan')} />
              )}
            </div>
          )}

          {results && (
            <EmptyCoachState
              icon={CheckCircle2}
              title="Symptom check completed"
              body="Your answers are saved. Next, review the lab plan or upload existing results."
              actionLabel="Open lab plan"
              onAction={() => navigate('/lab-plan')}
            />
          )}
        </CoachCard>

        <aside className="coach-grid">
          <InsightCard
            icon={InfoIcon}
            title="Why we ask this"
            body={step < WIZARD_STEPS.length ? WIZARD_STEPS[step].why : 'Smart follow-up questions help reduce generic advice.'}
          />
          <InsightCard
            icon={Route}
            title="Lab plan readiness"
            body={`Current readiness: ${readiness}%. More context means a more focused lab plan.`}
            actionLabel="Open lab plan"
            onAction={() => navigate('/lab-plan')}
          />
          <InsightCard
            icon={AlertTriangle}
            tone={Object.values(redFlags).some(Boolean) ? 'warning' : 'success'}
            title="Safety context"
            body={urgency}
          />
          <CoachCard className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-teal-600" />
              <h3 className="text-lg font-extrabold text-slate-950">What to track this week</h3>
            </div>
            <ul className="space-y-2 text-sm leading-6 text-slate-600">
              <li>Severity trend of the main concern</li>
              <li>Sleep, energy, mood, and recovery</li>
              <li>Medication, supplement, or food changes</li>
            </ul>
          </CoachCard>
        </aside>
      </div>
    </div>
  )
}

function InfoIcon(props) {
  return <Stethoscope {...props} />
}
