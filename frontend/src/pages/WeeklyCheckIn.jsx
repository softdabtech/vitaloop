import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import { gaCheckInSubmit } from '../lib/analytics.js'

const CONCERN_STATUS = ['better', 'same', 'worse']
const ADHERENCE = ['high', 'medium', 'low']

function getConcern() {
  if (typeof window === 'undefined') return 'your active concern'
  return window.localStorage.getItem('symptom-check-active-concern') || 'your active concern'
}

function scoreFromStatus(value) {
  if (value === 'better') return 8
  if (value === 'same') return 5
  return 3
}

function scoreFromAdherence(value) {
  if (value === 'high') return 5
  if (value === 'medium') return 3
  return 1
}

export default function WeeklyCheckIn() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const concern = getConcern()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const [concernStatus, setConcernStatus] = useState('same')
  const [symptomSeverity, setSymptomSeverity] = useState(5)
  const [sleep, setSleep] = useState(5)
  const [energy, setEnergy] = useState(5)
  const [mood, setMood] = useState(5)
  const [digestion, setDigestion] = useState(5)
  const [recovery, setRecovery] = useState(5)
  const [adherence, setAdherence] = useState('medium')
  const [sideEffects, setSideEffects] = useState('')
  const [newSymptoms, setNewSymptoms] = useState('')
  const [redFlags, setRedFlags] = useState('')

  const totalSteps = 7
  const progress = Math.round((step / totalSteps) * 100)

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(concernStatus)
    if (step === 2) return true
    if (step === 3) return true
    if (step === 4) return Boolean(adherence)
    return true
  }, [step, concernStatus, adherence])

  async function submit() {
    if (!user?.id || submitting) return
    setSubmitting(true)

    const now = new Date()
    const payload = {
      user_id: user.id,
      week_start: now.toISOString().slice(0, 10),
      energy_score: energy,
      mood_score: mood,
      sleep_quality: sleep,
      protocol_adherence: scoreFromAdherence(adherence),
      symptom_changes: `Concern status: ${concernStatus}; Severity: ${symptomSeverity}/10; Digestion: ${digestion}/10; Recovery: ${recovery}/10`,
      new_complaints: `${newSymptoms}${redFlags ? ` | Red flags: ${redFlags}` : ''}`,
      notes: `Concern: ${concern}; Side effects: ${sideEffects || 'none'}; Adherence: ${adherence}; Check-in matrix generated.`,
    }

    try {
      await api.post('/checkins', payload)
      gaCheckInSubmit()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['health-score'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
      ])
      setDone(true)
      setTimeout(() => navigate('/dashboard'), 1000)
    } catch {
      toast.error('Failed to save check-in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title="Check-in"
        subtitle={`Track whether protocol is working for: ${concern}`}
        helper="Symptom severity + adherence + side effects + red flags -> next weekly adjustment."
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        {!done ? (
          <>
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Step {step} of {totalSteps}</span>
                <span>{progress}% complete</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">1. Active concern status</h3>
                <p className="text-sm text-slate-600">Compared with last week, is {concern} better, same, or worse?</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {CONCERN_STATUS.map((item) => (
                    <button key={item} onClick={() => setConcernStatus(item)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${concernStatus === item ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">2. Symptom severity</h3>
                <p className="text-sm text-slate-600">How intense is your active concern now?</p>
                <label className="text-sm text-slate-700">Severity: {symptomSeverity}/10
                  <input type="range" min={1} max={10} value={symptomSeverity} onChange={(e) => setSymptomSeverity(Number(e.target.value))} className="mt-2 w-full" />
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">3. Sleep, energy, mood, digestion, recovery</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Sleep', sleep, setSleep],
                    ['Energy', energy, setEnergy],
                    ['Mood', mood, setMood],
                    ['Digestion', digestion, setDigestion],
                    ['Recovery', recovery, setRecovery],
                  ].map(([label, value, setter]) => (
                    <label key={label} className="text-sm text-slate-700">{label}: {value}/10
                      <input type="range" min={1} max={10} value={value} onChange={(e) => setter(Number(e.target.value))} className="mt-1 w-full" />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">4. Protocol adherence</h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  {ADHERENCE.map((item) => (
                    <button key={item} onClick={() => setAdherence(item)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${adherence === item ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">5. Side effects</h3>
                <textarea value={sideEffects} onChange={(e) => setSideEffects(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Any side effects or tolerance issues" />
              </div>
            )}

            {step === 6 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">6. New symptoms and red flags</h3>
                <textarea value={newSymptoms} onChange={(e) => setNewSymptoms(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="New symptoms" />
                <textarea value={redFlags} onChange={(e) => setRedFlags(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Any urgent signs to discuss quickly" />
              </div>
            )}

            {step === 7 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">7. Next adjustment preview</h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {concernStatus === 'better' ? 'Continue current plan and verify with retest timing.' : concernStatus === 'same' ? 'Consider protocol adjustment and prioritize unresolved markers.' : 'Escalate review with clinician and reassess safety context promptly.'}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || submitting} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Back</button>
              {step < totalSteps ? (
                <button onClick={() => canContinue && setStep((s) => Math.min(totalSteps, s + 1))} disabled={!canContinue || submitting} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Next</button>
              ) : (
                <button onClick={submit} disabled={submitting} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Complete check-in'}</button>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-emerald-800">Check-in saved. Redirecting to Today...</div>
        )}
      </section>
    </div>
  )
}
