import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BrainCircuit, CheckCircle2, FileText, HeartPulse, LayoutDashboard, Sparkles, Stethoscope, TrendingUp, Upload } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'

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
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title="How AI Blood Test Analysis Works | VITALOOP"
        description="See how VITALOOP turns blood test uploads into prioritized biomarker insights and step-by-step weekly protocols. Start free and test your first report."
        path="/how-it-works"
      />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(16,185,129,0.08),transparent_34%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_6%,rgba(14,165,233,0.06),transparent_30%)]" />
      </div>

      <PageHeader />

      <section className="mx-auto grid max-w-[1240px] gap-8 px-4 pb-14 pt-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:pt-12">
        <div>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
            Health Intelligence Hub
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-5 text-5xl font-bold tracking-[-0.03em] text-slate-900 md:text-6xl">
            Explore how the system actually works
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            This page is the bridge between marketing and product reality: how uploads become insight, how insight becomes action, and how repeated lab cycles create a smarter protocol over time.
          </motion.p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => navigate('/login?signup=true')} className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600">
              Start free
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <button onClick={() => navigate('/example-report')} className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-500 hover:bg-slate-50">
              See example report
            </button>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.05)]">
          <div className="grid gap-3 sm:grid-cols-3">
            {outcomes.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{item.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-600">{item.label}</div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Command center preview</div>
                <div className="text-xs text-slate-600">What the system is designed to surface first</div>
              </div>
              <LayoutDashboard className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-600">Priority issue</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">Ferritin recovery stack</div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div className="h-2 w-[74%] rounded-full bg-emerald-500" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-600">Current loop</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">Upload → Insight → Action → Retest</div>
                <div className="mt-3 text-sm leading-relaxed text-slate-600">Each cycle compounds rather than resetting your context.</div>
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
                className={`grid items-center gap-8 rounded-[32px] border border-slate-200 bg-slate-50 p-6 md:grid-cols-2 md:p-8 ${!isEven ? 'md:[&>*:first-child]:order-2' : ''}`}
              >
                <div>
                  <div className="mb-4 flex items-end gap-4">
                    <span className="text-6xl font-bold text-emerald-200">
                      {step.code}
                    </span>
                    <Icon className="mb-2 h-12 w-12 text-emerald-600" />
                  </div>
                  <h2 className="mb-4 text-3xl font-bold text-slate-900">{step.title}</h2>
                  <p className="mb-6 text-lg leading-8 text-slate-600">{step.description}</p>
                  <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                    Built for real retest cycles
                  </div>
                </div>

                <div className={`flex h-64 items-center justify-center rounded-[28px] border border-slate-200 bg-gradient-to-br ${step.color}`}>
                  <div className="grid h-[78%] w-[78%] place-items-center rounded-[24px] border border-emerald-200 bg-white backdrop-blur">
                    <Icon className="h-24 w-24 text-emerald-600/70" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6">
        <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Featured guides</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">What you can study inside the hub</h2>
            </div>
            <button onClick={() => navigate('/')} className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-500 hover:bg-slate-50">
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
                  className="rounded-[28px] border border-slate-200 bg-white p-6"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10% 0px -10% 0px' }} className="mx-auto max-w-[1240px] px-4 py-16 text-center sm:px-6">
        <div className="rounded-[34px] border border-slate-200 bg-slate-50 px-6 py-12">
          <h2 className="text-4xl font-bold text-slate-900">Ready to map your health?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Start with one upload, then let the system build a repeatable loop around insight, protocol, and retesting.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button onClick={() => navigate('/example-report')} className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-500 hover:bg-slate-50">
              See example report
            </button>
            <button onClick={() => navigate('/login?signup=true')} className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600">
              Get started free
            </button>
          </div>
        </div>
      </motion.section>

      <Footer />
    </div>
  )
}
