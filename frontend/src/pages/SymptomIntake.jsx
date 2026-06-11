import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, FlaskConical, Loader2, Mail, ShieldCheck, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

import BrandMark from '../components/landing/BrandMark.jsx'
import api from '../lib/api.js'
import { getPublicFunnelSessionId, trackPublicFunnelEvent } from '../lib/publicFunnel.js'

const SYMPTOMS = [
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'sleep_issues', label: 'Sleep issues' },
  { id: 'hair_loss', label: 'Hair loss' },
  { id: 'brain_fog', label: 'Brain fog' },
  { id: 'digestive_issues', label: 'Digestive issues' },
  { id: 'joint_pain', label: 'Joint pain' },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'cold_intolerance', label: 'Cold intolerance' },
  { id: 'weight_change', label: 'Weight change' },
  { id: 'poor_immunity', label: 'Poor immunity' },
]

const DURATIONS = [
  'Less than 2 weeks',
  '2-8 weeks',
  'More than 2 months',
]

const AGE_RANGES = ['Under 25', '25-34', '35-44', '45-54', '55+']
const SEX_OPTIONS = ['Female', 'Male', 'Prefer not to say']

function StepPill({ active, done, children }) {
  return (
    <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-3 text-xs font-bold ${
      active
        ? 'border-emerald-500 bg-emerald-500 text-white'
        : done
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-500'
    }`}>
      {children}
    </span>
  )
}

function OptionButton({ selected, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
        selected
          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50'
      }`}
    >
      {children}
    </button>
  )
}

export default function SymptomIntake() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [symptoms, setSymptoms] = useState([])
  const [duration, setDuration] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [sex, setSex] = useState('')
  const [loading, setLoading] = useState(false)
  const [assessmentId, setAssessmentId] = useState('')
  const [recommendedLabs, setRecommendedLabs] = useState([])
  const [email, setEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)

  const sessionId = useMemo(() => getPublicFunnelSessionId(), [])

  useEffect(() => {
    trackPublicFunnelEvent('symptom_started', { path: '/symptom-intake' })
  }, [])

  function toggleSymptom(id) {
    setSymptoms((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      if (current.length === 0 && next.length > 0) {
        trackPublicFunnelEvent('symptom_q1_answered', { symptom_count: next.length })
      }
      return next
    })
  }

  function nextFromSymptoms() {
    if (symptoms.length === 0) {
      toast.error('Choose at least one symptom.')
      return
    }
    setStep(2)
  }

  function selectDuration(value) {
    setDuration(value)
    trackPublicFunnelEvent('symptom_q2_answered', { duration: value })
  }

  function continueFromDemographics() {
    trackPublicFunnelEvent('symptom_q3_answered', {
      age_range: ageRange || 'skipped',
      sex: sex || 'skipped',
    })
    submitAssessment()
  }

  async function submitAssessment() {
    if (!duration) {
      toast.error('Choose how long this has been going on.')
      return
    }

    setLoading(true)
    try {
      const { data } = await api.post('/assessment/symptom-intake', {
        session_id: sessionId,
        symptoms,
        duration,
        age_range: ageRange || null,
        sex: sex || null,
        source: 'vitaloop.today',
      })
      setAssessmentId(data?.assessment_id || '')
      setRecommendedLabs(Array.isArray(data?.recommended_labs) ? data.recommended_labs : [])
      setStep(4)
    } catch {
      toast.error('Could not save the assessment. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function saveEmail() {
    if (!email || !assessmentId) return

    try {
      await api.post('/assessment/email', {
        session_id: sessionId,
        assessment_id: assessmentId,
        email,
      })
      setEmailSaved(true)
      toast.success('Saved.')
    } catch {
      toast.error('Could not save your email.')
    }
  }

  function skipEmail() {
    trackPublicFunnelEvent('email_skipped', { assessment_id: assessmentId })
    setEmailSaved(true)
  }

  function goUpload() {
    trackPublicFunnelEvent('upload_clicked', { assessment_id: assessmentId })
    navigate('/upload')
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2">
            <BrandMark />
          </button>
          <button
            type="button"
            onClick={() => navigate('/login?signup=true')}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:border-emerald-300"
          >
            Create account
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.78fr_0.22fr]">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_32%),linear-gradient(135deg,#ffffff,#f0fdfa)] px-5 py-6 sm:px-7">
            <div className="mb-5 flex items-center gap-2">
              {[1, 2, 3, 4].map((item) => (
                <StepPill key={item} active={step === item} done={step > item}>{item}</StepPill>
              ))}
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Symptom-first check</p>
            <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Answer a few questions. See which labs may be worth discussing.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              This is a wellness education flow, not a diagnosis. It helps organize your symptoms before you upload labs or create an account.
            </p>
          </div>

          <div className="px-5 py-6 sm:px-7">
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-slate-950">What is bothering you?</h2>
                <p className="mt-1 text-sm text-slate-600">Choose all that apply.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {SYMPTOMS.map((item) => (
                    <OptionButton key={item.id} selected={symptoms.includes(item.id)} onClick={() => toggleSymptom(item.id)}>
                      {item.label}
                    </OptionButton>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <button type="button" onClick={nextFromSymptoms} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700">
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-xl font-bold text-slate-950">How long has this been going on?</h2>
                <div className="mt-5 grid gap-3">
                  {DURATIONS.map((item) => (
                    <OptionButton key={item} selected={duration === item} onClick={() => selectDuration(item)}>
                      {item}
                    </OptionButton>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button type="button" onClick={() => duration && setStep(3)} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!duration}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-xl font-bold text-slate-950">Optional context</h2>
                <p className="mt-1 text-sm text-slate-600">This helps keep recommendations more relevant. You can skip it.</p>
                <div className="mt-5">
                  <p className="mb-2 text-sm font-bold text-slate-800">Age range</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {AGE_RANGES.map((item) => (
                      <OptionButton key={item} selected={ageRange === item} onClick={() => setAgeRange(item)}>
                        {item}
                      </OptionButton>
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <p className="mb-2 text-sm font-bold text-slate-800">Sex</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {SEX_OPTIONS.map((item) => (
                      <OptionButton key={item} selected={sex === item} onClick={() => setSex(item)}>
                        {item}
                      </OptionButton>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button type="button" onClick={continueFromDemographics} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    See labs
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">Your lab discussion list is ready</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      These are commonly discussed with qualified healthcare professionals for the symptoms you selected.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {recommendedLabs.map((lab) => (
                    <div key={lab.key || lab.name} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                          <FlaskConical className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-950">{lab.name}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{lab.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  VITALOOP does not diagnose or prescribe. Use this list as preparation for a clinician conversation.
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-emerald-700" />
                    <p className="font-bold text-slate-950">Save this recommendation list</p>
                  </div>
                  {emailSaved ? (
                    <p className="mt-3 text-sm font-semibold text-emerald-700">Saved. You can upload labs or create an account next.</p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                      <button type="button" onClick={saveEmail} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Save</button>
                      <button type="button" onClick={skipEmail} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Skip</button>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={goUpload} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700">
                    <Upload className="h-4 w-4" /> Upload PDF
                  </button>
                  <button type="button" onClick={() => navigate('/login?signup=true')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:border-emerald-300">
                    Create account <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            <p className="mt-3 text-sm font-bold text-slate-950">Built for validation</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              No account required. Your answers are used to measure whether this symptom-first workflow is useful.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-950">What happens next?</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              If you already have lab results, upload a PDF after this. VITALOOP will structure markers and connect them back to your symptoms.
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
