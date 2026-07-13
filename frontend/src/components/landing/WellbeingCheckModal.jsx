import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Cookie,
  Droplets,
  Moon,
  Scale,
  Sparkles,
  Thermometer,
  Timer,
  TrendingDown,
  TrendingUp,
  Waves,
  Wind,
  X,
  Zap,
} from 'lucide-react'

const SYMPTOM_GROUPS = [
  {
    label: 'Energy and sleep',
    Icon: Zap,
    color: '#f59e0b',
    items: [
      { id: 'persistent-fatigue', Icon: Zap, label: 'Persistent fatigue' },
      { id: 'poor-sleep', Icon: Moon, label: 'Poor sleep' },
      { id: 'low-energy', Icon: TrendingDown, label: 'Low energy' },
      { id: 'hard-to-wake', Icon: Timer, label: 'Hard to wake up' },
    ],
  },
  {
    label: 'Head and mood',
    Icon: Brain,
    color: '#8b5cf6',
    items: [
      { id: 'brain-fog', Icon: Wind, label: 'Brain fog' },
      { id: 'anxiety', Icon: AlertCircle, label: 'Anxiety' },
      { id: 'mood-swings', Icon: Activity, label: 'Mood swings' },
      { id: 'headaches', Icon: Brain, label: 'Headaches' },
    ],
  },
  {
    label: 'Weight and metabolism',
    Icon: Scale,
    color: '#0ea5e9',
    items: [
      { id: 'cant-lose-weight', Icon: Scale, label: "Can't lose weight" },
      { id: 'weight-gain', Icon: TrendingUp, label: 'Weight gain' },
      { id: 'cravings', Icon: Cookie, label: 'Sugar cravings' },
      { id: 'cold-hands-feet', Icon: Thermometer, label: 'Cold hands or feet' },
    ],
  },
  {
    label: 'Digestion, skin, hair',
    Icon: Waves,
    color: '#14b8a6',
    items: [
      { id: 'bloating', Icon: Waves, label: 'Bloating' },
      { id: 'hair-shedding', Icon: Droplets, label: 'Hair shedding' },
      { id: 'dry-skin', Icon: Thermometer, label: 'Dry skin or nails' },
      { id: 'skin-changes', Icon: Activity, label: 'Acne or skin changes' },
    ],
  },
]

const DURATION_OPTIONS = ['A few days', '1-3 weeks', '1-3 months', 'More than 3 months']
const INTENSITY_OPTIONS = ['Mild', 'Noticeable', 'Disruptive']

const LAB_DIRECTIONS_BY_SYMPTOM = {
  'persistent-fatigue': ['CBC', 'Ferritin and iron panel', 'Vitamin D', 'Vitamin B12', 'TSH and free T4'],
  'poor-sleep': ['Vitamin D', 'Magnesium', 'TSH and free T4', 'Fasting glucose'],
  'low-energy': ['CBC', 'Ferritin and iron panel', 'Vitamin B12', 'Vitamin D', 'HbA1c'],
  'hard-to-wake': ['CBC', 'Ferritin and iron panel', 'TSH and free T4', 'Cortisol context'],
  'brain-fog': ['Vitamin B12', 'Vitamin D', 'TSH and free T4', 'Fasting glucose', 'CRP'],
  anxiety: ['TSH and free T4', 'Vitamin D', 'Vitamin B12', 'Magnesium'],
  'mood-swings': ['Vitamin D', 'TSH and free T4', 'Fasting glucose', 'HbA1c'],
  headaches: ['CBC', 'Ferritin and iron panel', 'Vitamin D', 'CRP'],
  'cant-lose-weight': ['Fasting glucose', 'HbA1c', 'Fasting insulin', 'Lipid panel', 'TSH and free T4'],
  'weight-gain': ['TSH and free T4', 'HbA1c', 'Fasting insulin', 'Lipid panel', 'ALT and AST'],
  cravings: ['Fasting glucose', 'HbA1c', 'Fasting insulin', 'Magnesium'],
  'cold-hands-feet': ['CBC', 'Ferritin and iron panel', 'TSH and free T4', 'Vitamin B12'],
  bloating: ['CBC', 'CRP', 'Ferritin and iron panel', 'Vitamin B12'],
  'hair-shedding': ['Ferritin and iron panel', 'TSH and free T4', 'Vitamin D', 'Zinc'],
  'dry-skin': ['TSH and free T4', 'Vitamin D', 'Zinc', 'Ferritin and iron panel'],
  'skin-changes': ['Vitamin D', 'Zinc', 'Fasting glucose', 'HbA1c', 'CRP'],
}

const DEFAULT_LABS = ['CBC', 'Comprehensive metabolic panel', 'Ferritin and iron panel', 'Vitamin D', 'Vitamin B12', 'TSH and free T4', 'HbA1c']

function flattenSymptoms() {
  return SYMPTOM_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))
}

function getLabDirections(selectedIds) {
  const labs = selectedIds.flatMap((id) => LAB_DIRECTIONS_BY_SYMPTOM[id] || [])
  return [...new Set(labs.length ? labs : DEFAULT_LABS)].slice(0, 8)
}

export default function WellbeingCheckModal({ open, onClose }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [duration, setDuration] = useState('')
  const [intensity, setIntensity] = useState('')
  const [notes, setNotes] = useState('')

  const allSymptoms = useMemo(flattenSymptoms, [])
  const selectedSymptoms = useMemo(
    () => selectedIds.map((id) => allSymptoms.find((item) => item.id === id)).filter(Boolean),
    [allSymptoms, selectedIds]
  )
  const labDirections = useMemo(() => getLabDirections(selectedIds), [selectedIds])
  const attentionAreas = useMemo(
    () => [...new Set(selectedSymptoms.map((item) => item.group))],
    [selectedSymptoms]
  )

  if (!open || typeof document === 'undefined') return null

  const canContinue = step === 1 ? selectedIds.length > 0 : step === 2 ? duration && intensity : true

  function toggleSymptom(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function resetFlow() {
    setStep(1)
    setSelectedIds([])
    setDuration('')
    setIntensity('')
    setNotes('')
  }

  function goSignup() {
    const params = new URLSearchParams({ signup: 'true', from: 'wellbeing_modal' })
    if (selectedIds.length) params.set('symptoms', selectedIds.join(','))
    navigate(`/login?${params.toString()}`)
  }

  function goUpload() {
    const params = new URLSearchParams({ signup: 'true', from: 'wellbeing_modal', returnUrl: '/upload' })
    if (selectedIds.length) params.set('symptoms', selectedIds.join(','))
    navigate(`/login?${params.toString()}`)
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/60 px-2 py-3 backdrop-blur-sm sm:px-4 sm:py-8" role="dialog" aria-modal="true" aria-label="AI wellbeing check">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] items-start sm:items-center">
        <div className="relative w-full overflow-hidden rounded-[24px] border border-white/70 bg-[#f8f5f0] shadow-[0_24px_90px_rgba(15,23,42,0.42)] sm:rounded-[34px]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close wellbeing check"
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[#e5dfd6] bg-white text-slate-900 shadow-sm transition hover:bg-teal-50 hover:text-teal-700 sm:right-4 sm:top-4 sm:h-12 sm:w-12"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <aside className="relative overflow-hidden bg-[linear-gradient(145deg,#082f3a,#0f766e)] p-5 text-white sm:p-8 lg:p-9">
              <div className="absolute inset-0 opacity-45">
                <div className="absolute -left-24 top-10 h-56 w-56 rounded-full bg-teal-300/35 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-200/25 blur-3xl" />
              </div>
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-teal-50">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI wellbeing check
                </div>
                <h2 className="mt-6 text-[34px] font-black leading-tight tracking-tight sm:text-[42px]">
                  Briefly describe how you feel. VITALOOP will map what needs attention.
                </h2>
                <p className="mt-5 text-sm leading-7 text-teal-50/90 sm:text-base">
                  An educational summary in English: possible symptom connections, useful lab directions, clinician questions, and next steps.
                </p>
                <div className="mt-8 grid gap-3 text-sm">
                  {['Not a diagnosis', 'No treatment claims', 'Focused on the next step'].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                      <Check className="h-4 w-4 text-teal-200" />
                      <span className="font-bold">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <section className="flex max-h-[86vh] min-h-[620px] flex-col bg-[#fbfaf7] p-4 sm:p-6 lg:p-8">
              <div className="mb-5 mr-12 flex items-center gap-2">
                {[1, 2, 3].map((item) => (
                  <div key={item} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= item ? 'bg-teal-700' : 'bg-[#e5dfd6]'}`} />
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {step === 1 && (
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">Step 1</p>
                    <h3 className="mt-2 text-[26px] font-black leading-tight text-slate-900">What feels off right now?</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Choose symptoms. VITALOOP will turn them into an attention map.
                      {selectedIds.length > 0 && <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-[10px] font-black text-white">{selectedIds.length}</span>}
                    </p>

                    <div className="mt-5 space-y-4">
                      {SYMPTOM_GROUPS.map((group) => (
                        <div key={group.label}>
                          <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                            <group.Icon className="h-3.5 w-3.5" style={{ color: group.color }} />
                            {group.label}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {group.items.map(({ Icon, id, label }) => {
                              const active = selectedIds.includes(id)
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => toggleSymptom(id)}
                                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition active:scale-[0.98] ${
                                    active
                                      ? 'border-teal-700 bg-teal-700 text-white shadow-[0_10px_28px_rgba(15,118,110,0.25)]'
                                      : 'border-[#e5dfd6] bg-white text-slate-900 hover:border-teal-200 hover:bg-teal-50/50'
                                  }`}
                                >
                                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-white/20' : 'bg-teal-50'}`}>
                                    <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-teal-700'}`} />
                                  </span>
                                  <span className="leading-tight">{label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">Step 2</p>
                    <h3 className="mt-2 text-[26px] font-black leading-tight text-slate-900">Add context</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      A few details help avoid generic advice and make the suggested lab directions more useful.
                    </p>

                    <div className="mt-6 space-y-6">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">How long has this been going on?</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {DURATION_OPTIONS.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setDuration(option)}
                              className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                                duration === option ? 'border-teal-700 bg-teal-700 text-white' : 'border-[#e5dfd6] bg-white text-slate-800 hover:border-teal-200'
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">How disruptive is it?</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {INTENSITY_OPTIONS.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setIntensity(option)}
                              className={`rounded-2xl border px-4 py-3 text-center text-sm font-bold transition ${
                                intensity === option ? 'border-teal-700 bg-teal-700 text-white' : 'border-[#e5dfd6] bg-white text-slate-800 hover:border-teal-200'
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="block">
                        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Optional context</span>
                        <textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          rows={4}
                          placeholder="Recent illness, stress, diet changes, medications, training load, cycle changes, or anything else that matters."
                          className="mt-3 w-full resize-none rounded-2xl border border-[#e5dfd6] bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">Step 3</p>
                    <h3 className="mt-2 text-[26px] font-black leading-tight text-slate-900">Your attention map</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      This is a lightweight preview. A full VITALOOP report uses your uploaded labs, reference ranges, safety context, and Core V2 rules.
                    </p>

                    <div className="mt-5 grid gap-3">
                      <article className="rounded-3xl border border-teal-100 bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">Selected context</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {selectedSymptoms.map((item) => item.label).join(', ')}. Duration: {duration || 'not set'}. Intensity: {intensity || 'not set'}.
                        </p>
                        {notes.trim() && <p className="mt-2 text-sm leading-6 text-slate-500">Extra note: {notes.trim()}</p>}
                      </article>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <article className="rounded-3xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Attention areas</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(attentionAreas.length ? attentionAreas : ['Baseline screening']).map((area) => (
                              <span key={area} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">{area}</span>
                            ))}
                          </div>
                        </article>

                        <article className="rounded-3xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Useful lab directions</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {labDirections.map((lab) => (
                              <span key={lab} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{lab}</span>
                            ))}
                          </div>
                        </article>
                      </div>

                      <article className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-black text-amber-900">Safety note</p>
                        <p className="mt-2 text-sm leading-6 text-amber-900/80">
                          This flow is educational and does not diagnose, treat, or replace medical care. Seek urgent care for chest pain, trouble breathing, fainting, severe weakness, suicidal thoughts, or rapidly worsening symptoms.
                        </p>
                      </article>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col-reverse gap-3 border-t border-[#e5dfd6] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <button type="button" onClick={step === 1 ? onClose : () => setStep((current) => current - 1)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e5dfd6] bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:bg-slate-50">
                    {step === 1 ? 'Close' : <><ArrowLeft className="h-4 w-4" /> Back</>}
                  </button>
                  {step === 3 && (
                    <button type="button" onClick={resetFlow} className="inline-flex items-center justify-center rounded-2xl border border-[#e5dfd6] bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                      Start over
                    </button>
                  )}
                </div>

                {step < 3 ? (
                  <button
                    type="button"
                    disabled={!canContinue}
                    onClick={() => setStep((current) => current + 1)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-7 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(20,184,166,0.28)] transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-200"
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={goUpload} className="inline-flex items-center justify-center rounded-2xl border border-teal-200 bg-white px-5 py-3 text-sm font-black text-teal-800 transition hover:bg-teal-50">
                      Upload labs
                    </button>
                    <button type="button" onClick={goSignup} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(20,184,166,0.28)] transition hover:bg-teal-700">
                      Create free account <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
