import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useAuth } from '../hooks/useAuth.js'
import { useQuestionnaireSession } from '../hooks/useQueries.js'
import api from '../lib/api.js'
import { gaCheckInSubmit } from '../lib/analytics.js'
import { CoachButton, CoachCard, CoachProgress } from '../components/coach/CoachUI.jsx'
import { isUkrainianLocale } from '../lib/locale.js'
// coach-shell/coach-card/etc. have no built-in styles of their own — every
// rule lives in this stylesheet. Vite code-splits CSS per lazy route chunk,
// so each page using CoachUI must import it directly or it renders as
// unstyled browser-default HTML, not a build error.
import '../styles/coach-design-system.css'

const CONCERN_STATUS = ['better', 'same', 'worse']
const ADHERENCE = ['high', 'medium', 'low']

const CHECKIN_COPY = {
  en: {
    stepOf: (step, total) => `Step ${step} of ${total}`,
    percentComplete: (pct) => `${pct}% complete`,
    step1Title: '1. Active concern status',
    step1Body: (concern) => `Compared with last week, is ${concern} better, same, or worse?`,
    statusLabels: { better: 'Better', same: 'Same', worse: 'Worse' },
    step2Title: '2. Symptom severity',
    step2Body: 'How intense is your active concern now?',
    severity: (v) => `Severity: ${v}/10`,
    step3Title: '3. Sleep, energy, mood, digestion, recovery',
    metricLabels: { Sleep: 'Sleep', Energy: 'Energy', Mood: 'Mood', Digestion: 'Digestion', Recovery: 'Recovery' },
    step4Title: '4. Protocol adherence',
    adherenceLabels: { high: 'High', medium: 'Medium', low: 'Low' },
    step5Title: '5. Side effects',
    step5Placeholder: 'Any side effects or tolerance issues',
    step6Title: '6. New symptoms and red flags',
    newSymptomsPlaceholder: 'New symptoms',
    redFlagsPlaceholder: 'Any urgent signs to discuss quickly',
    step7Title: '7. Next adjustment preview',
    previewBetter: 'Continue current plan and verify with retest timing.',
    previewSame: 'Consider protocol adjustment and prioritize unresolved markers.',
    previewWorse: 'Escalate review with clinician and reassess safety context promptly.',
    back: 'Back',
    next: 'Next',
    saving: 'Saving...',
    complete: 'Complete check-in',
    saveFailed: 'Failed to save check-in. Please try again.',
    done: 'Check-in saved. Redirecting to Today...',
    subtitle: (concern) => `Track whether protocol is working for: ${concern}`,
    defaultConcern: 'your active concern',
  },
  uk: {
    stepOf: (step, total) => `Крок ${step} з ${total}`,
    percentComplete: (pct) => `Готово на ${pct}%`,
    step1Title: '1. Статус головної скарги',
    step1Body: (concern) => `Порівняно з минулим тижнем, «${concern}» стало краще, так само чи гірше?`,
    statusLabels: { better: 'Краще', same: 'Так само', worse: 'Гірше' },
    step2Title: '2. Інтенсивність симптому',
    step2Body: 'Наскільки інтенсивна ваша головна скарга зараз?',
    severity: (v) => `Інтенсивність: ${v}/10`,
    step3Title: '3. Сон, енергія, настрій, травлення, відновлення',
    metricLabels: { Sleep: 'Сон', Energy: 'Енергія', Mood: 'Настрій', Digestion: 'Травлення', Recovery: 'Відновлення' },
    step4Title: '4. Дотримання протоколу',
    adherenceLabels: { high: 'Високе', medium: 'Середнє', low: 'Низьке' },
    step5Title: '5. Побічні ефекти',
    step5Placeholder: 'Будь-які побічні ефекти або проблеми з переносимістю',
    step6Title: '6. Нові симптоми та тривожні ознаки',
    newSymptomsPlaceholder: 'Нові симптоми',
    redFlagsPlaceholder: 'Будь-які термінові ознаки для швидкого обговорення',
    step7Title: '7. Попередній перегляд наступного кроку',
    previewBetter: 'Продовжуйте поточний план і перевірте терміни повторного аналізу.',
    previewSame: 'Розгляньте коригування протоколу та зосередьтеся на невирішених показниках.',
    previewWorse: 'Терміново зверніться до лікаря та переоцініть контекст безпеки.',
    back: 'Назад',
    next: 'Далі',
    saving: 'Зберігаємо...',
    complete: 'Завершити чек-ін',
    saveFailed: 'Не вдалося зберегти чек-ін. Спробуйте ще раз.',
    done: 'Чек-ін збережено. Переходимо до головної...',
    subtitle: (concern) => `Відстежуйте, чи працює протокол для: ${concern}`,
    defaultConcern: 'вашої головної скарги',
  },
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
  const isUk = isUkrainianLocale()
  const copy = isUk ? CHECKIN_COPY.uk : CHECKIN_COPY.en
  const { data: questionnaireSession } = useQuestionnaireSession()
  const sessionContext = questionnaireSession?.session_context || questionnaireSession?.session?.session_metadata || {}
  const concern = sessionContext?.active_concern || copy.defaultConcern

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
      toast.error(copy.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="coach-shell">
      <CabinetPageHeader
        title={ct().checkin.title}
        subtitle={copy.subtitle(concern)}
        helper={ct().checkin.helper}
      />

      <CoachCard className="p-5 sm:p-6">
        {!done ? (
          <>
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>{copy.stepOf(step, totalSteps)}</span>
                <span>{copy.percentComplete(progress)}</span>
              </div>
              <CoachProgress value={progress} />
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">{copy.step1Title}</h3>
                <p className="text-sm text-slate-600">{copy.step1Body(concern)}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {CONCERN_STATUS.map((item) => (
                    <button key={item} onClick={() => setConcernStatus(item)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${concernStatus === item ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                      {copy.statusLabels[item]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">{copy.step2Title}</h3>
                <p className="text-sm text-slate-600">{copy.step2Body}</p>
                <label className="text-sm text-slate-700">{copy.severity(symptomSeverity)}
                  <input type="range" min={1} max={10} value={symptomSeverity} onChange={(e) => setSymptomSeverity(Number(e.target.value))} className="mt-2 w-full" />
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">{copy.step3Title}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Sleep', sleep, setSleep],
                    ['Energy', energy, setEnergy],
                    ['Mood', mood, setMood],
                    ['Digestion', digestion, setDigestion],
                    ['Recovery', recovery, setRecovery],
                  ].map(([labelKey, value, setter]) => (
                    <label key={labelKey} className="text-sm text-slate-700">{copy.metricLabels[labelKey]}: {value}/10
                      <input type="range" min={1} max={10} value={value} onChange={(e) => setter(Number(e.target.value))} className="mt-1 w-full" />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">{copy.step4Title}</h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  {ADHERENCE.map((item) => (
                    <button key={item} onClick={() => setAdherence(item)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${adherence === item ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                      {copy.adherenceLabels[item]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">{copy.step5Title}</h3>
                <textarea value={sideEffects} onChange={(e) => setSideEffects(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={copy.step5Placeholder} />
              </div>
            )}

            {step === 6 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">{copy.step6Title}</h3>
                <textarea value={newSymptoms} onChange={(e) => setNewSymptoms(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={copy.newSymptomsPlaceholder} />
                <textarea value={redFlags} onChange={(e) => setRedFlags(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={copy.redFlagsPlaceholder} />
              </div>
            )}

            {step === 7 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-900">{copy.step7Title}</h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {concernStatus === 'better' ? copy.previewBetter : concernStatus === 'same' ? copy.previewSame : copy.previewWorse}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <CoachButton variant="secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || submitting}>{copy.back}</CoachButton>
              {step < totalSteps ? (
                <CoachButton onClick={() => canContinue && setStep((s) => Math.min(totalSteps, s + 1))} disabled={!canContinue || submitting}>{copy.next}</CoachButton>
              ) : (
                <CoachButton onClick={submit} disabled={submitting}>{submitting ? copy.saving : copy.complete}</CoachButton>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-emerald-800">{copy.done}</div>
        )}
      </CoachCard>
    </div>
  )
}
