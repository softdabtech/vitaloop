import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BrainCircuit,
  CalendarRange,
  FileScan,
  FlaskConical,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react'

const PREVIEW_CARDS = [
  {
    title: 'Deep Biomarker Analysis',
    description: 'Clean biomarker matrix with clinical ranges, deviations, and red-flag prioritization in seconds.',
    icon: FlaskConical,
    tone: 'emerald',
  },
  {
    title: 'Personalized Protocols',
    description: 'Nutrition, supplements, and behavior assignments automatically mapped to your biomarkers.',
    icon: Sparkles,
    tone: 'cyan',
  },
  {
    title: 'Longitudinal Tracking',
    description: 'Trend lines across lab cycles reveal momentum, relapse risk, and true biological progress.',
    icon: TrendingUp,
    tone: 'violet',
  },
  {
    title: 'AI Insights & Red Flags',
    description: 'High-signal summaries spotlight what matters now and what to retest next.',
    icon: BrainCircuit,
    tone: 'amber',
  },
  {
    title: 'Practitioner CRM',
    description: 'Pro workflows for practitioners: client portfolios, adherence, and assignment orchestration.',
    icon: Users,
    tone: 'slate',
  },
]

const ONBOARDING_STEPS = [
  {
    title: 'Upload any lab report',
    body: 'Drop a PDF or clear photo. VITALOOP extracts biomarkers and normalizes ranges automatically.',
    icon: FileScan,
  },
  {
    title: 'Get instant AI analysis',
    body: 'Claude-powered interpretation flags deficiencies, elevations, and hidden biomarker patterns.',
    icon: BrainCircuit,
  },
  {
    title: 'Receive your 7-day protocol',
    body: 'Get a personalized action plan plus longitudinal tracking and weekly adaptive check-ins.',
    icon: CalendarRange,
  },
]

function motionPreset(reduced, delay = 0) {
  if (reduced) return {}
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-8% 0px -8% 0px' },
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 18,
      delay,
    },
  }
}

function miniPreviewTone(tone) {
  switch (tone) {
    case 'emerald':
      return 'from-emerald-400/20 to-emerald-200/0 border-emerald-300/40'
    case 'cyan':
      return 'from-cyan-300/20 to-cyan-100/0 border-cyan-300/35'
    case 'violet':
      return 'from-violet-300/20 to-violet-200/0 border-violet-300/35'
    case 'amber':
      return 'from-amber-300/20 to-amber-100/0 border-amber-300/35'
    default:
      return 'from-slate-300/20 to-slate-100/0 border-slate-300/35'
  }
}

function PreviewCard({ item, index, reduced }) {
  const Icon = item.icon

  return (
    <motion.article
      {...motionPreset(reduced, Math.min(index * 0.05, 0.2))}
      whileHover={
        reduced
          ? undefined
          : {
              scale: 1.02,
              boxShadow: '0 0 0 1px rgba(16,185,129,0.42), 0 20px 40px rgba(16,185,129,0.14)',
            }
      }
      className="rounded-3xl border border-slate-700/70 bg-slate-900/55 p-8 backdrop-blur"
      style={{
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.1), inset 0 1px 0 rgba(148,163,184,0.08)',
      }}
    >
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-500/15 text-emerald-300">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-slate-100">{item.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.description}</p>

      <div className={`mt-5 h-28 rounded-2xl border bg-gradient-to-br ${miniPreviewTone(item.tone)} p-3`}>
        <div className="grid h-full grid-cols-[1fr_1fr] gap-2">
          <div className="rounded-lg border border-slate-600/70 bg-slate-900/70" />
          <div className="grid gap-2">
            <div className="rounded-lg border border-slate-600/70 bg-slate-900/70" />
            <div className="rounded-lg border border-slate-600/70 bg-slate-900/70" />
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function HealthScoreRing({ reduced }) {
  return (
    <motion.div
      {...motionPreset(reduced, 0.06)}
      className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 180deg, rgba(16,185,129,0.75) 0deg, rgba(16,185,129,0.15) 96deg, rgba(51,65,85,0.5) 96deg, rgba(51,65,85,0.35) 360deg)',
          boxShadow: '0 0 38px rgba(16,185,129,0.2)',
        }}
      />
      <div className="absolute inset-[16px] rounded-full border border-slate-600/70 bg-[#0E1529]" />
      <div className="relative text-center">
        <div className="text-5xl font-bold tracking-tight text-slate-100">0</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">health score / 100</div>
      </div>
    </motion.div>
  )
}

export default function PremiumEmptyDashboardState({ userName, onUploadClick }) {
  const reduced = useReducedMotion()

  return (
    <div className="space-y-6">
      <motion.section
        {...motionPreset(reduced)}
        className="relative overflow-hidden rounded-[28px] border border-slate-700/70 bg-[#0A0F1C] p-8 sm:p-10"
        style={{
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.1), inset 0 1px 0 rgba(148,163,184,0.09)',
        }}
      >
        <div className="pointer-events-none absolute -left-28 -top-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />

        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
              <HeartPulse className="h-3.5 w-3.5" />
              Premium dashboard preview
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
              Welcome back, {userName}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Your AI-powered health intelligence platform. Upload your first lab and unlock personalized biomarker analysis, adaptive protocols, and longitudinal tracking.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                style={{ boxShadow: '0 0 24px rgba(16,185,129,0.38)' }}
              >
                Upload Your First Lab
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-600/70 bg-slate-900/55 px-4 py-3 text-sm text-slate-300">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Privacy-first, clinically structured output
              </div>
            </div>
          </div>

          <HealthScoreRing reduced={reduced} />
        </div>
      </motion.section>

      <section>
        <motion.div {...motionPreset(reduced, 0.03)} className="mb-4">
          <h3 className="text-xl font-semibold tracking-tight text-slate-100">What You'll Discover</h3>
          <p className="mt-1 text-sm text-slate-400">A preview of what activates instantly after your first upload.</p>
        </motion.div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PREVIEW_CARDS.map((item, index) => (
            <PreviewCard key={item.title} item={item} index={index} reduced={reduced} />
          ))}
        </div>
      </section>

      <motion.section
        {...motionPreset(reduced, 0.06)}
        className="rounded-[28px] border border-slate-700/70 bg-slate-900/55 p-8 sm:p-10"
        style={{
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.1), inset 0 1px 0 rgba(16,185,129,0.1)',
        }}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
          <Stethoscope className="h-4 w-4" />
          Product teaser mockup
          <span className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
            after first upload
          </span>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-600/80 bg-[linear-gradient(145deg,#0f172a,#111827_55%,#0b1220)] p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-emerald-300/10 to-transparent" />
          <div className="mb-4 flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-600/70 bg-slate-900/70 p-4">
                <div className="mb-2 h-3 w-32 rounded bg-slate-700" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-12 rounded-lg border border-emerald-300/30 bg-emerald-500/15" />
                  <div className="h-12 rounded-lg border border-slate-600/70 bg-slate-800/90" />
                  <div className="h-12 rounded-lg border border-slate-600/70 bg-slate-800/90" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-600/70 bg-slate-900/70 p-4">
                <div className="mb-2 h-3 w-28 rounded bg-slate-700" />
                <div className="h-20 rounded-xl border border-cyan-300/30 bg-cyan-400/10" />
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-600/70 bg-slate-900/70 p-4">
                <div className="mb-2 h-3 w-24 rounded bg-slate-700" />
                <div className="space-y-2">
                  <div className="h-8 rounded-lg border border-slate-600/70 bg-slate-800/90" />
                  <div className="h-8 rounded-lg border border-emerald-300/30 bg-emerald-500/15" />
                  <div className="h-8 rounded-lg border border-slate-600/70 bg-slate-800/90" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-600/70 bg-slate-900/70 p-4">
                <div className="h-20 rounded-xl border border-violet-300/30 bg-violet-400/10" />
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-300">This is what your intelligent health dashboard will look like.</div>
        </div>
      </motion.section>

      <section>
        <motion.div {...motionPreset(reduced, 0.08)} className="mb-4">
          <h3 className="text-xl font-semibold tracking-tight text-slate-100">Beautiful onboarding flow</h3>
          <p className="mt-1 text-sm text-slate-400">Three steps to move from raw data to guided action.</p>
        </motion.div>
        <div className="grid gap-4 md:grid-cols-3">
          {ONBOARDING_STEPS.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.article
                key={step.title}
                {...motionPreset(reduced, 0.1 + index * 0.04)}
                whileHover={
                  reduced
                    ? undefined
                    : {
                        scale: 1.02,
                        boxShadow: '0 0 0 1px rgba(16,185,129,0.42), 0 20px 40px rgba(16,185,129,0.14)',
                      }
                }
                className="rounded-3xl border border-slate-700/70 bg-slate-900/55 p-8"
                style={{
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.1), inset 0 1px 0 rgba(148,163,184,0.08)',
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-500/15 text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Step {index + 1}</span>
                </div>
                <h4 className="text-lg font-semibold text-slate-100">{step.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.body}</p>
              </motion.article>
            )
          })}
        </div>
      </section>

      <motion.section
        {...motionPreset(reduced, 0.12)}
        className="rounded-[28px] border border-slate-700/70 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(135deg,_#0f172a,_#111827_58%,_#0a0f1c)] p-8 sm:p-10"
        style={{
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.1), inset 0 1px 0 rgba(16,185,129,0.14)',
        }}
      >
        <blockquote className="max-w-3xl text-xl leading-relaxed text-slate-100 sm:text-2xl">
          "The most powerful health intervention is not a supplement. It is a better feedback loop."
        </blockquote>
        <div className="mt-4 text-sm text-slate-300">Users who complete one upload + one check-in in week one show up to 2.1x higher adherence by week four.</div>
        <button
          onClick={onUploadClick}
          className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          style={{ boxShadow: '0 0 24px rgba(16,185,129,0.38)' }}
        >
          Start Your Health Journey - Upload First Lab
          <ArrowRight className="h-4 w-4" />
        </button>
      </motion.section>
    </div>
  )
}
