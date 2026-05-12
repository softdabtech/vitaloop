import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api.js'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { gaCheckInSubmit } from '../lib/analytics.js'

const FEELING_OPTIONS = [
  { value: 'drained', label: 'Drained', hint: 'Low energy all week', score: 3 },
  { value: 'off', label: 'Off-balance', hint: 'Mixed mood and focus', score: 5 },
  { value: 'steady', label: 'Steady', hint: 'Mostly stable and productive', score: 7 },
  { value: 'great', label: 'Great', hint: 'Clear, energized, and focused', score: 9 },
]

const ADHERENCE_OPTIONS = [
  { value: 'yes', label: 'Yes, daily', hint: 'I followed the protocol consistently', score: 5 },
  { value: 'partial', label: 'Partially', hint: 'I missed some doses or days', score: 3 },
  { value: 'no', label: 'Not this week', hint: 'I could not follow the plan yet', score: 1 },
]

function buildCheckinPayload({ userId, selectedFeeling, sleepStars, selectedAdherence, changes }) {
  const now = new Date()
  return {
    user_id: userId,
    week_start: now.toISOString().slice(0, 10),
    energy_score: selectedFeeling?.score ?? 5,
    mood_score: selectedFeeling?.score ?? 5,
    sleep_quality: Math.max(1, Math.min(10, sleepStars * 2)),
    protocol_adherence: selectedAdherence?.score ?? 3,
    symptom_changes: changes.trim(),
    new_complaints: '',
    notes: [
      selectedFeeling ? `Weekly feeling: ${selectedFeeling.label}` : '',
      `Sleep rating: ${sleepStars}/5`,
      selectedAdherence ? `Protocol adherence: ${selectedAdherence.label}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  }
}

function getViewportWidth() {
  if (typeof window === 'undefined') return 1024
  return window.innerWidth
}

function canContinueAtStep({ step, feeling, sleepStars, adherence }) {
  if (step === 1) return Boolean(feeling)
  if (step === 2) return sleepStars >= 1
  if (step === 3) return Boolean(adherence)
  return true
}

function getStepTitleAndSubtitle(step) {
  if (step === 1) {
    return {
      title: 'How are you feeling this week?',
      subtitle: 'Choose the option that best matches your overall state.',
    }
  }

  if (step === 2) {
    return {
      title: 'How was your sleep quality?',
      subtitle: 'Rate your average sleep for the week.',
    }
  }

  if (step === 3) {
    return {
      title: 'Did you follow your protocol?',
      subtitle: 'Honest tracking helps personalize your next recommendations.',
    }
  }

  return {
    title: 'Any notable changes this week?',
    subtitle: 'Optional: symptoms, side effects, wins, or challenges.',
  }
}

export default function WeeklyCheckIn() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [feeling, setFeeling] = useState('')
  const [sleepStars, setSleepStars] = useState(3)
  const [adherence, setAdherence] = useState('')
  const [changes, setChanges] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth)

  const totalSteps = 4
  const progress = Math.round((step / totalSteps) * 100)
  const isMobile = viewportWidth < 500

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const selectedFeeling = useMemo(() => FEELING_OPTIONS.find((opt) => opt.value === feeling) || null, [feeling])
  const selectedAdherence = useMemo(() => ADHERENCE_OPTIONS.find((opt) => opt.value === adherence) || null, [adherence])
  const stepInfo = useMemo(() => getStepTitleAndSubtitle(step), [step])

  const canContinue = useMemo(
    () => canContinueAtStep({ step, feeling, sleepStars, adherence }),
    [step, feeling, sleepStars, adherence]
  )

  const nextStep = () => {
    if (!canContinue || step >= totalSteps) return
    setStep((prev) => prev + 1)
  }

  const prevStep = () => {
    if (step <= 1) return
    setStep((prev) => prev - 1)
  }

  const submit = async () => {
    if (!user?.id || submitting) return

    setSubmitting(true)
    const payload = buildCheckinPayload({
      userId: user.id,
      selectedFeeling,
      sleepStars,
      selectedAdherence,
      changes,
    })

    try {
      await api.post('/checkins', payload)
      gaCheckInSubmit()
      setDone(true)
      setTimeout(() => navigate('/dashboard'), 900)
    } finally {
      setSubmitting(false)
    }
  }

  const renderStep = () => {
    if (step === 1) {
      return (
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{stepInfo.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{stepInfo.subtitle}</p>
          <div className="mt-4 grid gap-3">
            {FEELING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFeeling(opt.value)}
                className={`rounded-2xl border p-4 text-left transition ${
                  feeling === opt.value
                    ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-200 bg-white hover:border-emerald-200'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                <div className="mt-1 text-xs text-slate-500">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (step === 2) {
      return (
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{stepInfo.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{stepInfo.subtitle}</p>
          <div className="mt-6 flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSleepStars(n)}
                className={`h-11 w-11 rounded-xl border text-lg font-semibold transition ${
                  n <= sleepStars
                    ? 'border-amber-300 bg-amber-100 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-400 hover:border-amber-200'
                }`}
                aria-label={`Rate sleep ${n} out of 5`}
              >
                {n <= sleepStars ? '*' : '+'}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">Selected: {sleepStars}/5</p>
        </div>
      )
    }

    if (step === 3) {
      return (
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{stepInfo.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{stepInfo.subtitle}</p>
          <div className="mt-4 grid gap-3">
            {ADHERENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAdherence(opt.value)}
                className={`rounded-2xl border p-4 text-left transition ${
                  adherence === opt.value
                    ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-200 bg-white hover:border-emerald-200'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                <div className="mt-1 text-xs text-slate-500">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{stepInfo.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{stepInfo.subtitle}</p>
        <textarea
          rows={6}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          placeholder="Example: Better morning energy, less bloating, mild headaches on day 2..."
          value={changes}
          onChange={(e) => setChanges(e.target.value)}
        />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8" style={{ paddingLeft: isMobile ? '16px' : '24px', paddingRight: isMobile ? '16px' : '24px' }}>
      <div className="mx-auto max-w-3xl space-y-6">
        <CabinetPageHeader
          title="Weekly Check-in"
          subtitle="A quick 4-step reflection to keep your protocol adaptive and accurate."
        />

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm" style={{ padding: isMobile ? '20px 16px' : '24px' }}>
          {!done ? (
            <>
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Step {step} of {totalSteps}</span>
                  <span>{progress}% complete</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {renderStep()}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={step === 1 || submitting}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>

                {step < totalSteps ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!canContinue || submitting}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Complete check-in'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <h3 className="text-lg font-semibold text-emerald-900">Check-in saved</h3>
              <p className="mt-1 text-sm text-emerald-700">Thanks. Redirecting to your dashboard...</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
