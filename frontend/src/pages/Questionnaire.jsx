import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ClipboardList, Route, ShieldAlert, Stethoscope } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import api from '../lib/api.js'

const BODY_SYSTEMS = ['General', 'Neurological', 'Cardiometabolic', 'Hormonal', 'Digestive', 'Musculoskeletal', 'Recovery']
const DURATION_OPTIONS = ['< 1 week', '1-4 weeks', '1-3 months', '3-6 months', '6+ months']

function parseApiError(err, fallback) {
  const detail = err?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

function scoreReadiness({ concern, duration, severity, bodySystem, related, meds }) {
  let score = 20
  if (concern.trim().length >= 6) score += 20
  if (duration) score += 12
  if (severity >= 4) score += 12
  if (bodySystem) score += 10
  if (related.trim().length >= 4) score += 10
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

export default function Questionnaire() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
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
  const [phase, setPhase] = useState('intake')
  const [redFlags, setRedFlags] = useState({
    severeOnset: false,
    fever: false,
    swelling: false,
    numbnessWeakness: false,
    chestBreath: false,
    trauma: false,
    pregnancyContext: false,
  })

  const totalCount = answeredCount + remainingCount
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0
  const readiness = useMemo(
    () => scoreReadiness({ concern, duration, severity, bodySystem, related: relatedSymptoms, meds: medications }),
    [concern, duration, severity, bodySystem, relatedSymptoms, medications]
  )
  const urgency = useMemo(() => urgencyGuidance(redFlags), [redFlags])

  async function loadSession() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/questionnaire/session')
      setNextQuestion(data?.next_question || null)
      setAnsweredCount(Number(data?.answered_count || 0))
      setRemainingCount(Number(data?.remaining_count || 0))
      const sessionContext = data?.session_context || data?.session?.session_metadata || {}
      if (sessionContext?.active_concern) {
        setConcern(sessionContext.active_concern)
      }
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

      if (data?.completed) {
        const completeResp = await api.post('/questionnaire/complete', { mark_onboarding_complete: true })
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['profile'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
          queryClient.invalidateQueries({ queryKey: ['timeline'] }),
          queryClient.invalidateQueries({ queryKey: ['insights'] }),
          queryClient.invalidateQueries({ queryKey: ['health-score'] }),
        ])
        const completedSession = completeResp?.data?.session || {}
        setResults(completedSession)
        toast.success('Symptom check completed')
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to save answer.'))
    } finally {
      setSaving(false)
    }
  }

  function continueToQuestions() {
    if (!concern.trim() || !duration || !bodySystem) {
      toast.error('Please complete concern, duration, and body system before continuing.')
      return
    }
    saveConcernContext({
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
      linkedLabs: [],
    })
    setPhase('questions')
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading symptom check...</div>
  }

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={ct().questionnaire.title}
        subtitle={ct().questionnaire.subtitle}
        helper={ct().questionnaire.helper}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          {phase === 'intake' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">What is the main thing you want to understand or improve?</p>
                <textarea value={concern} onChange={(e) => setConcern(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Example: Leg pain and fatigue for 6 weeks" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-700">Duration
                  <select value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Select duration</option>
                    {DURATION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>

                <label className="text-sm text-slate-700">Body system / area
                  <select value={bodySystem} onChange={(e) => setBodySystem(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Select area</option>
                    {BODY_SYSTEMS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <label className="block text-sm text-slate-700">Severity: {severity}/10
                <input type="range" min={1} max={10} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className="mt-2 w-full" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <textarea value={relatedSymptoms} onChange={(e) => setRelatedSymptoms(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Related symptoms" />
                <textarea value={whatTried} onChange={(e) => setWhatTried(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="What you already tried" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <textarea value={medications} onChange={(e) => setMedications(e.target.value)} rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Current medications" />
                <textarea value={supplements} onChange={(e) => setSupplements(e.target.value)} rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Current supplements" />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900"><ShieldAlert className="h-4 w-4" /> Safety screen</div>
                <div className="grid gap-2 sm:grid-cols-2 text-sm text-amber-900">
                  {Object.entries({
                    severeOnset: 'Sudden severe onset',
                    fever: 'Fever',
                    swelling: 'Swelling',
                    numbnessWeakness: 'Numbness or weakness',
                    chestBreath: 'Chest pain or shortness of breath',
                    trauma: 'Recent trauma',
                    pregnancyContext: 'Pregnancy context',
                  }).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={Boolean(redFlags[key])} onChange={(e) => setRedFlags((prev) => ({ ...prev, [key]: e.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <button onClick={continueToQuestions} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Continue symptom check</button>
            </div>
          )}

          {phase === 'questions' && !results && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold">Smart questions</p>
                <p className="text-xs text-slate-500">Question {answeredCount + 1} of {totalCount || '?'}. {progressPct}% complete.</p>
              </div>

              {nextQuestion ? (
                <>
                  <p className="text-base font-semibold text-slate-900">{nextQuestion.text}</p>
                  <label className="block text-sm text-slate-700">Answer value: {answerValue}/10
                    <input type="range" min={1} max={10} value={answerValue} onChange={(e) => setAnswerValue(Number(e.target.value))} className="mt-2 w-full" />
                  </label>
                  <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Optional context" />
                  <button onClick={submitAnswer} disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Saving...' : 'Next question'}</button>
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">No pending smart questions right now.</div>
              )}
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Symptom Check Output</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold">Possible contributing areas</p><p className="mt-1 text-slate-600">{bodySystem || 'General system imbalance'} and related recovery factors.</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold">What to check next</p><p className="mt-1 text-slate-600">Open Lab Plan for core tests and discussion priorities.</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold">Doctor direction</p><p className="mt-1 text-slate-600">Bring symptom timeline, severity trend, and current meds/supplements.</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold">Urgency guidance</p><p className="mt-1 text-slate-600">{urgency}</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => navigate('/lab-plan')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Open lab plan</button>
                <button onClick={() => navigate('/upload')} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Upload results</button>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Stethoscope className="h-4 w-4 text-emerald-600" /> Active concern</div>
            <p className="text-sm text-slate-700">{concern || 'No concern entered yet'}</p>
            <p className="mt-2 text-xs text-slate-500">Duration: {duration || 'Not set'} | Severity: {severity}/10</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Route className="h-4 w-4 text-emerald-600" /> Lab plan readiness</div>
            <p className="text-2xl font-bold text-emerald-700">{readiness}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${readiness}%` }} /></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><AlertTriangle className="h-4 w-4 text-amber-500" /> Safety context</div>
            <p className="text-sm text-slate-700">{urgency}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardList className="h-4 w-4 text-slate-600" /> What to track this week</div>
            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
              <li>Severity trend of main concern</li>
              <li>Sleep, energy, mood, recovery</li>
              <li>Adherence and side effects</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
