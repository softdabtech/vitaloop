import { Activity, ArrowRight, CheckCircle2, FileUp, LineChart, Sparkles, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeUp, stagger, staggerChild, viewport } from '../../lib/motion.js'

const USER_FLOW = [
  {
    icon: FileUp,
    step: '1 min',
    title: 'Upload labs',
    text: 'Drop PDF/JPG/PNG and get biomarkers extracted automatically.',
  },
  {
    icon: Sparkles,
    step: '2 min',
    title: 'Get clear priorities',
    text: 'See what matters now: deficiencies, borderline markers, and next actions.',
  },
  {
    icon: Activity,
    step: 'Every week',
    title: 'Follow your protocol',
    text: 'Track adherence, adjust by trends, and stay consistent with less effort.',
  },
]

const PREMIUM_UNLOCKS = [
  '7-Day Supplement Protocol',
  'Nutrition Plan by biomarker flags',
  'Lifestyle Recommendations',
  'Progress trends and Insights',
  'Weekly Check-ins and PDF export',
]

function FlowCard({ icon: Icon, step, title, text }) {
  return (
    <motion.div
      variants={staggerChild}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
    >
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600">
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-600">{step}</div>
      <h3 className="mb-1 text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm leading-6 text-slate-600">{text}</p>
    </motion.div>
  )
}

export default function HowItWorksSection() {
  const reduced = useReducedMotion()
  const navigate = useNavigate()

  return (
    <section id="how-it-works" className="border-y border-slate-100 bg-slate-50/70 px-6 py-14 md:py-16">
      <div className="mx-auto max-w-6xl">
        <motion.div
          variants={reduced ? {} : stagger(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          className="mb-8 text-center md:mb-10"
        >
          <motion.div variants={reduced ? {} : fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">
            How VITALOOP improves your health
          </motion.div>
          <motion.h2 variants={reduced ? {} : fadeUp} className="mx-auto mb-3 max-w-3xl text-balance text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl">
            Less noise. Faster decisions. Better weekly results.
          </motion.h2>
          <motion.p variants={reduced ? {} : fadeUp} className="mx-auto max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
            A compact workflow built for real users: upload once, see priorities instantly, and follow a plan you can actually stick to.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.div
            variants={reduced ? {} : stagger(0.06)}
            initial="hidden"
            whileInView="visible"
            viewport={viewport('-40px')}
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {USER_FLOW.map((item) => (
              <FlowCard key={item.title} {...item} />
            ))}
          </motion.div>

          <motion.div
            variants={reduced ? {} : fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewport('-40px')}
            className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm"
          >
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
              <Zap size={12} />
              Premium unlock
            </div>
            <h3 className="mb-3 text-xl font-bold tracking-tight text-slate-900">What you get after upgrade</h3>
            <ul className="space-y-2.5">
              {PREMIUM_UNLOCKS.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                onClick={() => navigate('/login?signup=true')}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Start free <ArrowRight size={14} aria-hidden="true" />
              </button>
              <button
                onClick={() => navigate('/#pricing')}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                Compare plans <LineChart size={14} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
