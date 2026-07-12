import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ClipboardList, Pill, Route, ShieldAlert, Stethoscope } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { CoachBadge, CoachButton, CoachCard, CoachChip, CoachInput, CoachProgress, CoachSkeleton, EmptyCoachState, InsightCard } from '../components/coach/CoachUI.jsx'
import api from '../lib/api.js'
import { isUkrainianLocale } from '../lib/locale.js'

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

const UK = {
  bodySystems: {
    General: 'Загальні',
    Neurological: 'Неврологічні',
    Cardiometabolic: 'Кардіометаболічні',
    Hormonal: 'Гормональні',
    Digestive: 'Травлення',
    Musculoskeletal: 'Мʼязи та суглоби',
    Recovery: 'Відновлення',
  },
  durations: {
    '< 1 week': 'менше 1 тижня',
    '1-4 weeks': '1-4 тижні',
    '1-3 months': '1-3 місяці',
    '3-6 months': '3-6 місяців',
    '6+ months': '6+ місяців',
  },
  symptoms: {
    Fatigue: 'Втома',
    'Poor sleep': 'Поганий сон',
    'Brain fog': 'Туман у голові',
    'Hair shedding': 'Випадіння волосся',
    'Low mood': 'Знижений настрій',
    'Digestive issues': 'Проблеми травлення',
    Cravings: 'Тяга до їжі',
    'Low stamina': 'Низька витривалість',
  },
  steps: [
    { title: 'Головний запит', helper: 'Обовʼязково', why: 'Це привʼязує аналіз до того, що ви реально хочете покращити.' },
    { title: 'Тривалість', helper: 'Необовʼязково', why: 'Час допомагає відрізнити нову проблему від патерну, який треба дивитися в динаміці.' },
    { title: 'Повʼязані симптоми', helper: 'Оберіть те, що підходить', why: 'Кластери симптомів допомагають пріоритезувати маркери, які варто перевірити першими.' },
    { title: 'Ліки та добавки', helper: 'Контекст', why: 'Деякі маркери й рекомендації залежать від поточних ліків або добавок.' },
    { title: 'Питання безпеки', helper: 'Обовʼязково', why: 'Червоні прапорці змінюють найбезпечніший наступний крок і можуть вимагати консультації лікаря.' },
  ],
  redFlags: {
    severeOnset: 'Раптовий сильний початок',
    fever: 'Температура',
    swelling: 'Набряк',
    numbnessWeakness: 'Оніміння або слабкість',
    chestBreath: 'Біль у грудях або задишка',
    trauma: 'Нещодавня травма',
    pregnancyContext: 'Контекст вагітності',
  },
}

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

function urgencyGuidance(redFlags, isUk = false) {
  const activeCount = Object.values(redFlags).filter(Boolean).length
  if (activeCount === 0) return isUk ? 'Термінових червоних прапорців не зазначено.' : 'No urgent red flags reported.'
  if (activeCount <= 2) return isUk ? 'Деякі відповіді вказують, що своєчасний огляд лікаря важливий.' : 'Some answers suggest timely clinician review is important.'
  return isUk ? 'Виявлено кілька червоних прапорців. Не відкладайте медичний огляд.' : 'Multiple red flags detected. Do not delay medical review.'
}

function saveConcernContext(payload) {
  return api.patch('/questionnaire/session/context', {
    active_concern: payload.concern,
    summary: payload,
  })
}

function NumericScale({ value, onChange, isUk = false }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between text-sm font-bold text-slate-700">
        <span>{isUk ? 'Інтенсивність' : 'Intensity'}</span>
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
  const isUk = isUkrainianLocale()
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
  const urgency = useMemo(() => urgencyGuidance(redFlags, isUk), [redFlags, isUk])
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
      setError(parseApiError(err, isUk ? 'Не вдалося завантажити перевірку симптомів.' : 'Failed to load symptom check.'))
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
      toast.error(isUk ? 'Додайте головний запит перед продовженням.' : 'Add your main concern before continuing.')
      return
    }
    if (step < WIZARD_STEPS.length - 1) {
      setStep((prev) => prev + 1)
      return
    }
    setSaving(true)
    try {
      await saveWizardContext()
      toast.success(isUk ? 'Контекст симптомів збережено' : 'Symptom context saved')
      if (nextQuestion?.id) {
        setStep(WIZARD_STEPS.length)
      } else {
        navigate('/lab-plan')
      }
    } catch (err) {
      toast.error(parseApiError(err, isUk ? 'Не вдалося зберегти контекст симптомів.' : 'Failed to save symptom context.'))
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
        toast.success(isUk ? 'Перевірку симптомів завершено' : 'Symptom check completed')
      }
    } catch (err) {
      toast.error(parseApiError(err, isUk ? 'Не вдалося зберегти відповідь.' : 'Failed to save answer.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="coach-shell"><CoachSkeleton rows={4} /></div>
  if (error) {
    return (
      <div className="coach-shell">
        <EmptyCoachState title={isUk ? 'Перевірка симптомів недоступна' : 'Symptom check is unavailable'} body={error} actionLabel={isUk ? 'Спробувати ще раз' : 'Try again'} onAction={loadSession} />
      </div>
    )
  }

  return (
    <div className="coach-shell coach-grid">
      <section className="coach-hero">
        <p className="coach-eyebrow">{isUk ? 'Симптоми спочатку' : 'Symptom-first intake'}</p>
        <h1 className="coach-title-xl">{isUk ? 'Розкажіть VITALOOP, що відчувається не так.' : 'Tell VITALOOP what feels off.'}</h1>
        <p className="coach-body mt-4 max-w-2xl">{isUk ? 'Спочатку простий вхід, потім точний контекст. Ми використовуємо це, щоб повʼязати симптоми, аналізи, безпеку й наступний крок.' : 'Low barrier first, precise context next. We use this to connect symptoms, labs, safety context, and your next step.'}</p>
      </section>

      <div className="coach-grid coach-grid--2">
        <CoachCard className="p-5 sm:p-6">
          {step < WIZARD_STEPS.length && (
            <>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CoachBadge tone="primary">{isUk ? `Крок ${step + 1} з ${WIZARD_STEPS.length}` : `Step ${step + 1} of ${WIZARD_STEPS.length}`}</CoachBadge>
                  <h2 className="coach-title-lg mt-3">{isUk ? UK.steps[step].title : WIZARD_STEPS[step].title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{isUk ? UK.steps[step].helper : WIZARD_STEPS[step].helper}</p>
                </div>
                <div className="w-full sm:w-56">
                  <CoachProgress value={progress} label={isUk ? 'Прогрес' : 'Progress'} />
                </div>
              </div>

              {step === 0 && (
                <div className="grid gap-5">
                  <CoachInput label={isUk ? 'Що головне ви хочете зрозуміти або покращити?' : 'What is the main thing you want to understand or improve?'} helper={isUk ? 'Приклад: втома та випадіння волосся останні 2 місяці.' : 'Example: fatigue and hair shedding for the last 2 months.'}>
                    <textarea value={concern} onChange={(e) => setConcern(e.target.value)} placeholder={isUk ? 'Опишіть головний запит' : 'Describe the main concern'} />
                  </CoachInput>
                  <NumericScale value={severity} onChange={setSeverity} isUk={isUk} />
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-5">
                  <CoachInput label={isUk ? 'Як довго це триває?' : 'How long has this been going on?'} helper={isUk ? 'Необовʼязково, але корисно для рішення, чи дивитися динаміку.' : 'Optional, but useful for deciding if we should look at trends.'}>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                      <option value="">{isUk ? 'Оберіть тривалість' : 'Select duration'}</option>
                      {DURATION_OPTIONS.map((item) => <option key={item} value={item}>{isUk ? (UK.durations[item] || item) : item}</option>)}
                    </select>
                  </CoachInput>
                  <CoachInput label={isUk ? 'Система або зона тіла' : 'Body system or area'} helper={isUk ? 'Оберіть найближчий варіант.' : 'Choose the closest fit.'}>
                    <select value={bodySystem} onChange={(e) => setBodySystem(e.target.value)}>
                      <option value="">{isUk ? 'Оберіть зону' : 'Select area'}</option>
                      {BODY_SYSTEMS.map((item) => <option key={item} value={item}>{isUk ? (UK.bodySystems[item] || item) : item}</option>)}
                    </select>
                  </CoachInput>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-5">
                  <div className="flex flex-wrap gap-2">
                    {RELATED_SYMPTOMS.map((label) => (
                      <CoachChip key={label} active={selectedRelated.includes(label)} onClick={() => toggleRelated(label)}>
                        {isUk ? (UK.symptoms[label] || label) : label}
                      </CoachChip>
                    ))}
                  </div>
                  <CoachInput label={isUk ? 'Щось ще?' : 'Anything else?'} helper={isUk ? 'Необовʼязковий текст для симптомів, яких немає вище.' : 'Optional free text for symptoms not listed above.'}>
                    <textarea value={whatTried} onChange={(e) => setWhatTried(e.target.value)} placeholder={isUk ? 'Що змінилося нещодавно? Що ви вже пробували?' : 'What changed recently? What did you already try?'} />
                  </CoachInput>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <CoachInput label={isUk ? 'Поточні ліки' : 'Current medications'} helper={isUk ? 'Вкажіть дозу, якщо знаєте.' : 'Include dose if you know it.'}>
                    <textarea value={medications} onChange={(e) => setMedications(e.target.value)} placeholder={isUk ? 'Приклад: метформін, левотироксин, антигістамінні' : 'Example: metformin, levothyroxine, antihistamines'} />
                  </CoachInput>
                  <CoachInput label={isUk ? 'Поточні добавки' : 'Current supplements'} helper={isUk ? 'Це допомагає уникати небезпечних рекомендацій.' : 'This helps avoid unsafe recommendations.'}>
                    <textarea value={supplements} onChange={(e) => setSupplements(e.target.value)} placeholder={isUk ? 'Приклад: вітамін D, залізо, магній' : 'Example: vitamin D, iron, magnesium'} />
                  </CoachInput>
                </div>
              )}

              {step === 4 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries({
                    severeOnset: isUk ? UK.redFlags.severeOnset : 'Sudden severe onset',
                    fever: isUk ? UK.redFlags.fever : 'Fever',
                    swelling: isUk ? UK.redFlags.swelling : 'Swelling',
                    numbnessWeakness: isUk ? UK.redFlags.numbnessWeakness : 'Numbness or weakness',
                    chestBreath: isUk ? UK.redFlags.chestBreath : 'Chest pain or shortness of breath',
                    trauma: isUk ? UK.redFlags.trauma : 'Recent trauma',
                    pregnancyContext: isUk ? UK.redFlags.pregnancyContext : 'Pregnancy context',
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
                  {isUk ? 'Назад' : 'Back'}
                </CoachButton>
                <CoachButton onClick={handleNext} disabled={saving} trailingIcon={ArrowRight}>
                  {step === WIZARD_STEPS.length - 1 ? (saving ? (isUk ? 'Збереження...' : 'Saving...') : (isUk ? 'Зберегти й продовжити' : 'Save and continue')) : (isUk ? 'Продовжити' : 'Continue')}
                </CoachButton>
              </div>
            </>
          )}

          {step >= WIZARD_STEPS.length && !results && (
            <div className="grid gap-5">
              <CoachBadge tone="primary">{isUk ? 'Розумне уточнення' : 'Smart follow-up'}</CoachBadge>
              {nextQuestion ? (
                <>
                  <h2 className="coach-title-lg">{nextQuestion.text}</h2>
                  <NumericScale value={answerValue} onChange={setAnswerValue} isUk={isUk} />
                  <CoachInput label={isUk ? 'Додатковий контекст' : 'Optional context'}>
                    <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder={isUk ? 'Додайте деталі, якщо це допоможе.' : 'Add detail if it helps.'} />
                  </CoachInput>
                  <CoachButton onClick={submitAnswer} disabled={saving}>{saving ? (isUk ? 'Збереження...' : 'Saving...') : (isUk ? 'Наступне питання' : 'Next question')}</CoachButton>
                </>
              ) : (
                <EmptyCoachState title={isUk ? 'Контекст симптомів готовий' : 'Your symptom context is ready'} body={isUk ? 'Відкрийте план аналізів, щоб побачити, що варто перевірити першим.' : 'Open your lab plan to see what is worth checking first.'} actionLabel={isUk ? 'Відкрити план аналізів' : 'Open lab plan'} onAction={() => navigate('/lab-plan')} />
              )}
            </div>
          )}

          {results && (
            <EmptyCoachState
              icon={CheckCircle2}
              title={isUk ? 'Перевірку симптомів завершено' : 'Symptom check completed'}
              body={isUk ? 'Ваші відповіді збережено. Далі перегляньте план аналізів або завантажте наявні результати.' : 'Your answers are saved. Next, review the lab plan or upload existing results.'}
              actionLabel={isUk ? 'Відкрити план аналізів' : 'Open lab plan'}
              onAction={() => navigate('/lab-plan')}
            />
          )}
        </CoachCard>

        <aside className="coach-grid">
          <InsightCard
            icon={InfoIcon}
            title={isUk ? 'Навіщо ми це питаємо' : 'Why we ask this'}
            body={step < WIZARD_STEPS.length ? (isUk ? UK.steps[step].why : WIZARD_STEPS[step].why) : (isUk ? 'Розумні уточнювальні питання допомагають зменшити загальні поради.' : 'Smart follow-up questions help reduce generic advice.')}
          />
          <InsightCard
            icon={Route}
            title={isUk ? 'Готовність плану аналізів' : 'Lab plan readiness'}
            body={isUk ? `Поточна готовність: ${readiness}%. Більше контексту означає точніший план аналізів.` : `Current readiness: ${readiness}%. More context means a more focused lab plan.`}
            actionLabel={isUk ? 'Відкрити план аналізів' : 'Open lab plan'}
            onAction={() => navigate('/lab-plan')}
          />
          <InsightCard
            icon={AlertTriangle}
            tone={Object.values(redFlags).some(Boolean) ? 'warning' : 'success'}
            title={isUk ? 'Контекст безпеки' : 'Safety context'}
            body={urgency}
          />
          <CoachCard className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-teal-600" />
              <h3 className="text-lg font-extrabold text-slate-950">{isUk ? 'Що відстежувати цього тижня' : 'What to track this week'}</h3>
            </div>
            <ul className="space-y-2 text-sm leading-6 text-slate-600">
              <li>{isUk ? 'Динаміка інтенсивності головного запиту' : 'Severity trend of the main concern'}</li>
              <li>{isUk ? 'Сон, енергія, настрій і відновлення' : 'Sleep, energy, mood, and recovery'}</li>
              <li>{isUk ? 'Зміни в ліках, добавках або харчуванні' : 'Medication, supplement, or food changes'}</li>
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
