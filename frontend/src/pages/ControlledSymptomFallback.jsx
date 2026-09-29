import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, FileUp, Loader2, ShieldAlert, Stethoscope } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api.js'
import CabinetPageFrame from '../components/dashboard/CabinetPageFrame.jsx'
import '../styles/coach-design-system.css'

const CONCERNS = [
  { id: 'energy', label: 'Energy and recovery', signals: ['Fatigue', 'Low stamina', 'Post-activity exhaustion', 'General weakness'] },
  { id: 'sleep', label: 'Sleep', signals: ['Difficulty falling asleep', 'Waking during the night', 'Unrefreshing sleep', 'Daytime sleepiness'] },
  { id: 'cognition', label: 'Focus and cognition', signals: ['Brain fog', 'Poor concentration', 'Memory difficulty', 'Head pressure'] },
  { id: 'digestion', label: 'Digestion', signals: ['Bloating', 'Abdominal discomfort', 'Bowel changes', 'Food-related symptoms'] },
  { id: 'hair_skin', label: 'Hair, skin and nails', signals: ['Hair shedding', 'Dry skin', 'Brittle nails', 'Skin changes'] },
  { id: 'mood', label: 'Mood and stress', signals: ['Low mood', 'Anxiety', 'Irritability', 'High stress load'] },
  { id: 'pain', label: 'Pain and inflammation', signals: ['Muscle pain', 'Joint pain', 'Headache', 'General aches'] },
]

const WELLBEING = [
  ['good', 'Good — I feel well today'],
  ['mostly_good', 'Mostly good — a few minor concerns'],
  ['reduced', 'Reduced — something is affecting how I feel'],
  ['poor', 'Poor — I feel significantly unwell'],
]

const DURATIONS = [
  ['today', 'Started today'], ['days_2_7', '2–7 days'], ['weeks_1_4', '1–4 weeks'],
  ['months_1_3', '1–3 months'], ['months_3_plus', 'More than 3 months'],
  ['intermittent', 'Comes and goes'], ['unknown', 'Not sure'],
]

const YES_NO_UNKNOWN = [['present', 'Yes'], ['absent', 'No'], ['unknown', 'Not sure']]

const DOMAIN_QUESTION = {
  energy: 'Does rest fail to restore your usual energy?',
  sleep: 'Do you wake feeling unrefreshed despite enough time in bed?',
  cognition: 'Does the problem make focused work or conversation difficult?',
  digestion: 'Does the problem reliably appear after meals?',
  hair_skin: 'Did the change become noticeably faster during the last month?',
  mood: 'Does the problem persist even when the immediate stressor is absent?',
  pain: 'Is the affected area swollen, hot, or visibly inflamed?',
}

function Select({ label, value, onChange, options, placeholder, disabled = false }) {
  return (
    <label className="coach-field">
      <span className="coach-field__label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">{placeholder}</option>
        {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
      </select>
    </label>
  )
}

function StepHeader({ step }) {
  return (
    <div className="grid gap-3" aria-label={`Step ${step} of 3`}>
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        <span>Structured symptom check</span><span>Step {step} of 3</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((number) => <span key={number} className={`h-2 rounded-full ${number <= step ? 'bg-emerald-500' : 'bg-slate-200'}`} />)}
      </div>
    </div>
  )
}

export default function ControlledSymptomFallback() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [wellbeing, setWellbeing] = useState('')
  const [concernId, setConcernId] = useState('')
  const [primarySignal, setPrimarySignal] = useState('')
  const [duration, setDuration] = useState('')
  const [related, setRelated] = useState(['', ''])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)

  const concern = CONCERNS.find((item) => item.id === concernId)
  const signalOptions = (concern?.signals || []).map((label) => [label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label])
  const selectedSignalLabel = signalOptions.find(([id]) => id === primarySignal)?.[1] || 'this symptom'
  const questions = useMemo(() => [
    { id: 'severity', text: `How strong is ${selectedSignalLabel.toLowerCase()} right now?`, options: [['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']] },
    { id: 'trajectory', text: 'How has it changed since it started?', options: [['improving', 'Improving'], ['stable', 'About the same'], ['worsening', 'Gradually worsening'], ['intermittent', 'Comes and goes']] },
    { id: 'functional_impact', text: 'How much does it limit normal daily activity?', options: [['none', 'No limitation'], ['mild', 'Some tasks feel harder'], ['moderate', 'I have reduced normal activities'], ['severe', 'I cannot manage normal activities']] },
    { id: 'domain_detail', text: DOMAIN_QUESTION[concernId] || 'Is there a consistent pattern?', options: YES_NO_UNKNOWN },
    { id: 'urgent_warning', text: 'Are any urgent warning signs present?', help: 'Severe chest pain, trouble breathing, fainting, new one-sided weakness, confusion, or uncontrolled bleeding.', options: YES_NO_UNKNOWN },
  ], [concernId, selectedSignalLabel])
  const currentQuestion = questions[questionIndex]

  function nextFromBaseline(event) {
    event.preventDefault()
    if (!wellbeing || !concernId) return setError('Select both your current wellbeing and the main area.')
    setError(''); setStep(2)
  }

  function nextFromSignals(event) {
    event.preventDefault()
    if (!primarySignal || !duration) return setError('Select the main signal and how long it has been present.')
    setError(''); setStep(3)
  }

  async function saveContext() {
    setSaving(true); setError('')
    try {
      const relatedLabels = related.filter(Boolean).map((id) => signalOptions.find(([value]) => value === id)?.[1]).filter(Boolean)
      const severityScore = { mild: 3, moderate: 6, severe: 9 }[answers.severity] || 5
      await api.patch('/questionnaire/session/context', {
        complete: true,
        active_concern: [selectedSignalLabel, ...relatedLabels].join(', '),
        summary: {
          schema_version: 'controlled_symptom_fallback_v1',
          input_mode: 'controlled_only',
          overall_wellbeing: wellbeing,
          primary_concern_id: concernId,
          primary_concept_id: primarySignal,
          primary_signal: selectedSignalLabel,
          related_symptoms: relatedLabels,
          duration_bucket: duration,
          severity: severityScore,
          symptom_pattern: answers.trajectory,
          functional_impact: answers.functional_impact,
          domain_detail: answers.domain_detail,
          urgent_warning: answers.urgent_warning,
          controlled_answers: answers,
        },
      })
      setCompleted(true)
    } catch (saveError) {
      setError(saveError?.response?.data?.detail || 'We could not save your answers. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  async function answerQuestion(event) {
    event.preventDefault()
    if (!answers[currentQuestion.id]) return setError('Select one answer to continue.')
    setError('')
    if (questionIndex < questions.length - 1) setQuestionIndex((value) => value + 1)
    else await saveContext()
  }

  if (completed) {
    const urgent = answers.urgent_warning === 'present'
    const relatedLabels = related.filter(Boolean).map((id) => signalOptions.find(([value]) => value === id)?.[1]).filter(Boolean)
    const answerLabel = (questionId) => questions.find((question) => question.id === questionId)?.options.find(([id]) => id === answers[questionId])?.[1] || 'Not recorded'
    const durationLabel = DURATIONS.find(([id]) => id === duration)?.[1] || 'Not recorded'
    return (
      <CabinetPageFrame>
        <div className="coach-shell mx-auto grid max-w-5xl gap-5">
          <section className={`rounded-3xl border bg-white p-6 sm:p-8 ${urgent ? 'border-red-300' : 'border-emerald-200'}`}>
            <div className="flex items-start gap-4">
              {urgent ? <ShieldAlert className="h-7 w-7 shrink-0 text-red-700" /> : <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-700" />}
              <div>
                <p className={`coach-eyebrow ${urgent ? 'text-red-700' : ''}`}>{urgent ? 'Safety result' : 'Symptom check complete'}</p>
                <h1 className="coach-title-lg">{urgent ? 'Get urgent medical help now' : 'Your symptom context is saved'}</h1>
                <p className="coach-body mt-2">{urgent ? 'Your answer indicates that at least one urgent warning sign may be present. This result comes from the safety question below — not from a diagnosis or a lab result.' : 'Your controlled answers are ready to add context to lab results and future comparisons. This is not a diagnosis.'}</p>
              </div>
            </div>
          </section>

          {urgent && (
            <section className="coach-card grid gap-5 p-6 sm:p-8" aria-label="Why this result was shown">
              <div><p className="coach-eyebrow">Why this result was shown</p><h2 className="coach-title-lg">You answered “Yes” to urgent warning signs</h2></div>
              <p className="coach-body">The question covered severe chest pain, trouble breathing, fainting, new one-sided weakness, confusion, or uncontrolled bleeding. Because the answer was “Yes”, VITALOOP stops the assessment and recommends prompt professional evaluation.</p>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950">
                Call your local emergency number now if symptoms are severe, rapidly worsening, or you feel unsafe. Otherwise, contact an appropriate medical professional promptly.
              </div>
            </section>
          )}

          <section className="coach-card p-6 sm:p-8" aria-label="Your symptom check answers">
            <div><p className="coach-eyebrow">Your submitted answers</p><h2 className="coach-title-lg">Symptom-check summary</h2></div>
            <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div><dt className="coach-eyebrow">Main signal</dt><dd className="mt-1 text-sm font-bold text-slate-950">{selectedSignalLabel}</dd></div>
              <div><dt className="coach-eyebrow">Duration</dt><dd className="mt-1 text-sm text-slate-700">{durationLabel}</dd></div>
              <div><dt className="coach-eyebrow">Severity</dt><dd className="mt-1 text-sm text-slate-700">{answerLabel('severity')}</dd></div>
              <div><dt className="coach-eyebrow">Change over time</dt><dd className="mt-1 text-sm text-slate-700">{answerLabel('trajectory')}</dd></div>
              <div><dt className="coach-eyebrow">Daily impact</dt><dd className="mt-1 text-sm text-slate-700">{answerLabel('functional_impact')}</dd></div>
              <div><dt className="coach-eyebrow">Urgent warning signs</dt><dd className={`mt-1 text-sm font-bold ${urgent ? 'text-red-700' : 'text-slate-700'}`}>{answerLabel('urgent_warning')}</dd></div>
            </dl>
            {relatedLabels.length > 0 && <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600"><span className="font-bold text-slate-800">Related signals:</span> {relatedLabels.join(', ')}</p>}
          </section>

          {!urgent && <button className="coach-button coach-button--primary coach-button--md justify-self-start" onClick={() => navigate('/upload')}><FileUp className="h-4 w-4" /> Upload lab results</button>}
        </div>
      </CabinetPageFrame>
    )
  }

  return (
    <CabinetPageFrame>
      <div className="coach-shell mx-auto grid max-w-5xl gap-5">
        <header className="coach-hero grid gap-5">
          <StepHeader step={step} />
          <div><p className="coach-eyebrow">Controlled inputs, useful context</p><h1 className="coach-title-xl">{step === 1 ? 'Start with how you feel today' : step === 2 ? 'Choose the signals that matter' : 'Answer five focused questions'}</h1><p className="coach-body mt-3">Every answer is stored as a known value the VITALOOP backend can use. No medical free text is collected.</p></div>
        </header>
        {error && <div role="alert" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950"><AlertTriangle className="h-5 w-5 shrink-0" />{String(error)}</div>}

        {step === 1 && <form onSubmit={nextFromBaseline} className="coach-card grid gap-6 p-6 sm:p-8"><div className="grid gap-5 md:grid-cols-2"><Select label="How do you feel overall today?" value={wellbeing} onChange={setWellbeing} options={WELLBEING} placeholder="Select current wellbeing" /><Select label="What area would you like to highlight?" value={concernId} onChange={(value) => { setConcernId(value); setPrimarySignal(''); setRelated(['', '']) }} options={CONCERNS.map(({ id, label }) => [id, label])} placeholder="Select one area" /></div><div className="flex justify-end border-t border-slate-100 pt-5"><button className="coach-button coach-button--primary coach-button--md"><Stethoscope className="h-4 w-4" /> Continue <ArrowRight className="h-4 w-4" /></button></div></form>}

        {step === 2 && <form onSubmit={nextFromSignals} className="coach-card grid gap-6 p-6 sm:p-8"><div className="grid gap-5 md:grid-cols-2"><Select label="Main signal" value={primarySignal} onChange={(value) => { setPrimarySignal(value); setRelated(['', '']) }} options={signalOptions} placeholder="Select the main signal" /><Select label="How long has it been present?" value={duration} onChange={setDuration} options={DURATIONS} placeholder="Select duration" /><Select label="Related signal (optional)" value={related[0]} onChange={(value) => setRelated([value, related[1]])} options={signalOptions.filter(([id]) => id !== primarySignal && id !== related[1])} placeholder="Select if relevant" disabled={!primarySignal} /><Select label="Another related signal (optional)" value={related[1]} onChange={(value) => setRelated([related[0], value])} options={signalOptions.filter(([id]) => id !== primarySignal && id !== related[0])} placeholder="Select if relevant" disabled={!primarySignal} /></div><div className="flex items-center justify-between border-t border-slate-100 pt-5"><button type="button" className="coach-button coach-button--ghost coach-button--md" onClick={() => setStep(1)}>Back</button><button className="coach-button coach-button--primary coach-button--md">Start focused questions <ArrowRight className="h-4 w-4" /></button></div></form>}

        {step === 3 && <form onSubmit={answerQuestion} className="coach-card grid gap-6 p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="coach-eyebrow">Question {questionIndex + 1} of {questions.length}</p><h2 className="coach-title-lg">{currentQuestion.text}</h2>{currentQuestion.help && <p className="mt-3 text-sm leading-6 text-slate-600">{currentQuestion.help}</p>}</div>{currentQuestion.id === 'urgent_warning' && <span className="coach-badge coach-badge--warning"><ShieldAlert className="h-4 w-4" /> Safety check</span>}</div><Select label="Select the closest answer" value={answers[currentQuestion.id] || ''} onChange={(value) => setAnswers((current) => ({ ...current, [currentQuestion.id]: value }))} options={currentQuestion.options} placeholder="Select one answer" /><div className="flex items-center justify-between border-t border-slate-100 pt-5"><button type="button" className="coach-button coach-button--ghost coach-button--md" onClick={() => questionIndex ? setQuestionIndex((value) => value - 1) : setStep(2)}>Back</button><button disabled={saving} className="coach-button coach-button--primary coach-button--md">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{questionIndex === questions.length - 1 ? 'Save symptom context' : 'Save and continue'} <ArrowRight className="h-4 w-4" /></button></div></form>}

        <button type="button" onClick={() => navigate('/dashboard')} className="justify-self-start text-sm font-bold text-slate-500 hover:text-slate-800">Skip for now and return to dashboard</button>
      </div>
    </CabinetPageFrame>
  )
}
