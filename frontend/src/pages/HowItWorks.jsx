import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BrainCircuit, CheckCircle2, FileText, HeartPulse, LayoutDashboard, Sparkles, Stethoscope, TrendingUp, Upload } from 'lucide-react'
import Seo from '../components/Seo.jsx'

export default function HowItWorks() {
  const navigate = useNavigate()
  const steps = [
    {
      icon: Upload,
      title: 'Upload a real lab report',
      description: 'Bring any PDF or lab image from your provider. VITALOOP handles OCR, unit cleanup, and biomarker normalization before analysis begins.',
      code: '01',
      color: 'from-emerald-500/25 to-cyan-500/15',
    },
    {
      icon: BrainCircuit,
      title: 'Map the signal structure',
      description: 'The engine compares your biomarkers across ranges, patterns, and historical context so you can see what is noisy, what is meaningful, and what deserves attention first.',
      code: '02',
      color: 'from-cyan-500/20 to-emerald-500/10',
    },
    {
      icon: LayoutDashboard,
      title: 'Turn analysis into execution',
      description: 'Your dashboard becomes a command center: priorities, protocol tasks, trend visibility, and next best action instead of an inert report archive.',
      code: '03',
      color: 'from-emerald-500/20 to-sky-500/15',
    },
    {
      icon: HeartPulse,
      title: 'Close the feedback loop',
      description: 'Weekly check-ins and fresh uploads make the next protocol cycle sharper than the last one, so the system compounds over time.',
      code: '04',
      color: 'from-emerald-500/20 to-violet-500/15',
    },
  ]

  const guideCards = [
    {
      title: 'Biomarker interpretation',
      body: 'Learn how ferritin, thyroid, cortisol, lipids, inflammation, and metabolic markers should be read as a system instead of isolated values.',
      icon: FileText,
    },
    {
      title: 'Protocol design',
      body: 'See how VITALOOP converts patterns into supplements, food changes, and adherence tasks that can actually be executed.',
      icon: Sparkles,
    },
    {
      title: 'Practitioner collaboration',
      body: 'Understand how the platform keeps outputs readable when a coach or clinician needs to review your case quickly.',
      icon: Stethoscope,
    },
  ]

  const outcomes = [
    { label: 'Upload to insight', value: '< 60 sec', icon: Upload },
    { label: 'Biomarkers tracked', value: '85+', icon: TrendingUp },
    { label: 'Weekly loop', value: 'Always on', icon: CheckCircle2 },
  ]

  return (
    <div className="min-h-screen bg-[#09101d] text-white">
      <Seo
        title="Health Intelligence Hub | VITALOOP"
        description="Explore how VITALOOP turns lab uploads into biomarker insight, personalized protocols, and a repeatable biohacking feedback loop."
        path="/how-it-works"
      />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(16,185,129,0.18),transparent_34%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_6%,rgba(14,165,233,0.12),transparent_30%)]" />
      </div>

      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to site
        </button>
      </div>

      <section className="mx-auto grid max-w-[1240px] gap-8 px-4 pb-14 pt-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:pt-12">
        <div>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            Health Intelligence Hub
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-5 text-5xl font-bold tracking-[-0.03em] text-white md:text-6xl">
            Explore how the system actually works
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            This page is the bridge between marketing and product reality: how uploads become insight, how insight becomes action, and how repeated lab cycles create a smarter protocol over time.
          </motion.p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => navigate('/login?signup=true')} className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
              Start free
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <button onClick={() => navigate('/example-report')} className="inline-flex items-center rounded-2xl border border-slate-700 bg-slate-950/75 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/50">
              See example report
            </button>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-[32px] border border-slate-800 bg-[linear-gradient(180deg,rgba(7,15,27,0.96),rgba(9,21,36,0.86))] p-5 shadow-[0_24px_60px_rgba(2,6,23,0.35)]">
          <div className="grid gap-3 sm:grid-cols-3">
            {outcomes.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="mt-3 text-2xl font-bold tracking-tight text-white">{item.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Command center preview</div>
                <div className="text-xs text-slate-400">What the system is designed to surface first</div>
              </div>
              <LayoutDashboard className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Priority issue</div>
                <div className="mt-2 text-lg font-semibold text-white">Ferritin recovery stack</div>
                <div className="mt-3 h-2 rounded-full bg-slate-800">
                  <div className="h-2 w-[74%] rounded-full bg-emerald-500" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Current loop</div>
                <div className="mt-2 text-lg font-semibold text-white">Upload → Insight → Action → Retest</div>
                <div className="mt-3 text-sm leading-relaxed text-slate-300">Each cycle compounds rather than resetting your context.</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
        <div className="space-y-8">
          {steps.map((step, idx) => {
            const Icon = step.icon
            const isEven = idx % 2 === 0

            return (
              <motion.div
                key={step.code}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
                transition={{ delay: idx * 0.2 }}
                className={`grid items-center gap-8 rounded-[32px] border border-slate-800 bg-slate-950/55 p-6 md:grid-cols-2 md:p-8 ${!isEven ? 'md:[&>*:first-child]:order-2' : ''}`}
              >
                <div>
                  <div className="mb-4 flex items-end gap-4">
                    <span className="text-6xl font-bold text-emerald-300/35">
                      {step.code}
                    </span>
                    <Icon className="mb-2 h-12 w-12 text-emerald-300" />
                  </div>
                  <h2 className="mb-4 text-3xl font-bold text-white">{step.title}</h2>
                  <p className="mb-6 text-lg leading-8 text-slate-300">{step.description}</p>
                  <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                    Built for real retest cycles
                  </div>
                </div>

                <div className={`flex h-64 items-center justify-center rounded-[28px] border border-slate-800 bg-gradient-to-br ${step.color}`}>
                  <div className="grid h-[78%] w-[78%] place-items-center rounded-[24px] border border-white/10 bg-slate-950/75 backdrop-blur">
                    <Icon className="h-24 w-24 text-white/70" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6">
        <div className="rounded-[32px] border border-slate-800 bg-slate-950/55 p-6 md:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Featured guides</p>
              <h2 className="mt-3 text-3xl font-bold text-white">What you can study inside the hub</h2>
            </div>
            <button onClick={() => navigate('/')} className="inline-flex items-center rounded-2xl border border-slate-700 bg-slate-950/75 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/50">
              Return to landing
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {guideCards.map((item, idx) => {
              const Icon = item.icon
              return (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
                  transition={{ delay: idx * 0.08 }}
                  className="rounded-[28px] border border-slate-800 bg-[linear-gradient(180deg,rgba(8,15,30,0.92),rgba(13,25,40,0.76))] p-6"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10% 0px -10% 0px' }} className="mx-auto max-w-[1240px] px-4 py-16 text-center sm:px-6">
        <div className="rounded-[34px] border border-slate-800 bg-[linear-gradient(180deg,rgba(8,15,29,0.96),rgba(11,24,39,0.82))] px-6 py-12">
          <h2 className="text-4xl font-bold text-white">Ready to map your health?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Start with one upload, then let the system build a repeatable loop around insight, protocol, and retesting.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button onClick={() => navigate('/example-report')} className="inline-flex items-center rounded-2xl border border-slate-700 bg-slate-950/75 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/50">
              See example report
            </button>
            <button onClick={() => navigate('/login?signup=true')} className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
              Get started free
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
