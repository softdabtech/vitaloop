import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CirclePlay,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
  Users,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'

const NAV_LINKS = [
  { id: 'problem', label: 'Problem' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'why-vitaloop', label: 'Why VITALOOP' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'testimonials', label: 'Stories' },
  { id: 'faq', label: 'FAQ' },
]

const STEPS = [
  { icon: Upload, title: 'Upload labs', body: 'Drop any blood test PDF or lab image — we handle OCR and unit normalization automatically.' },
  { icon: BrainCircuit, title: 'AI extraction', body: 'AI extracts 85+ biomarkers, normalizes units, and maps each value against clinical reference ranges.' },
  { icon: FlaskConical, title: 'Signal mapping', body: 'Cross-biomarker correlations, deficiencies, elevations, and longitudinal anomalies are ranked by significance.' },
  { icon: Sparkles, title: 'Protocol engine', body: 'A personalized blood test interpretation protocol — supplements, nutrition, and weekly targets — tied to your exact markers.' },
  { icon: HeartPulse, title: 'Adaptive loop', body: 'Check-ins and new labs continuously refine guidance.' },
]

const BENEFITS = [
  {
    title: 'Personalized protocol, not generic tips',
    body: 'Every recommendation ties to your biomarkers, symptoms, and adherence history.',
    icon: Sparkles,
  },
  {
    title: 'Longitudinal health intelligence',
    body: 'Track change over time instead of reacting to one-off snapshots.',
    icon: LayoutDashboard,
  },
  {
    title: 'Clinically readable outputs',
    body: 'Results are structured for user clarity and practitioner review.',
    icon: Stethoscope,
  },
  {
    title: 'Secure by design',
    body: 'Privacy-first architecture with strict identity and access controls.',
    icon: ShieldCheck,
  },
  {
    title: 'AI + human escalation path',
    body: 'Know when to act alone and when to escalate to a professional.',
    icon: Users,
  },
]

const TESTIMONIALS = [
  {
    quote: 'I stopped guessing. VITALOOP gave me a clear sequence and my energy stabilized in six weeks.',
    author: 'Nora, 34',
    role: 'Product lead, Berlin',
  },
  {
    quote: 'The weekly check-ins made me actually follow the plan. My ferritin trend finally moved in the right direction.',
    author: 'Alex, 41',
    role: 'Founder, London',
  },
  {
    quote: 'As a clinician, I value how quickly I can see risk patterns and adherence context in one place.',
    author: 'Dr. Sam R.',
    role: 'Functional medicine practitioner',
  },
]

const MOCKUPS = [
  { title: 'Dashboard', alt: 'VITALOOP dashboard mockup showing score, priorities, and recent health events.' },
  { title: 'Lab Upload', alt: 'Upload interface mockup with drag-and-drop area for lab PDFs and images.' },
  { title: 'Lab Results', alt: 'Results mockup with prioritized biomarkers and severity labels.' },
  { title: 'Personalized Protocol', alt: 'Protocol mockup with supplements, nutrition actions, and timeline.' },
  { title: 'Timeline', alt: 'Longitudinal timeline mockup with markers across multiple test cycles.' },
  { title: 'Practitioner CRM', alt: 'CRM mockup for practitioner oversight, assignments, and client trends.' },
  { title: 'Weekly Check-in', alt: 'Weekly check-in wizard mockup with guided multi-step questions.' },
  { title: 'Health Avatar', alt: 'Interactive avatar mockup connecting body zones with biomarkers.' },
]

  const STATS = [
    { value: '14,000+', label: 'Lab reports analyzed' },
    { value: '85+', label: 'Biomarker types tracked' },
    { value: '4.8★', label: 'Average user rating' },
    { value: '92%', label: 'Protocol adherence rate' },
  ]

  const FAQ_ITEMS = [
    {
      question: 'What is AI lab analysis and how does VITALOOP use it?',
      answer: 'AI lab analysis uses machine learning to extract, normalize, and interpret biomarker data from blood test PDFs. VITALOOP applies Claude AI to identify deficiencies, flag out-of-range values, and map patterns across multiple test cycles — turning raw numbers into actionable health priorities.',
    },
    {
      question: 'Which blood test formats does VITALOOP support?',
      answer: 'VITALOOP supports PDF and image uploads from any laboratory. Our OCR engine normalizes units and reference ranges across 85+ biomarkers including CBC, metabolic panels, thyroid, hormones, vitamins, and inflammation markers.',
    },
    {
      question: 'How accurate is AI blood test interpretation?',
      answer: 'VITALOOP cross-references each biomarker against clinical reference ranges and your historical trends. The AI surfaces correlations a manual review might miss — like ferritin, transferrin saturation, and CRP together indicating iron metabolism issues — with confidence scores and source context.',
    },
    {
      question: 'Is VITALOOP a medical device or replacement for a doctor?',
      answer: 'No. VITALOOP is a health intelligence platform, not a licensed medical device. It provides educational insights and protocol suggestions based on your lab data. Always consult a qualified healthcare professional for medical decisions.',
    },
    {
      question: 'What is longitudinal biomarker tracking?',
      answer: 'Longitudinal biomarker tracking means analyzing the same health markers across multiple lab draws over time — weeks, months, or years. VITALOOP visualizes trend lines, detects recovery patterns, and alerts you when trajectories worsen, giving you a health timeline instead of a one-off snapshot.',
    },
    {
      question: 'How is VITALOOP different from asking ChatGPT about my labs?',
      answer: 'ChatGPT has no memory of your history, cannot parse lab PDFs reliably, and generates generic advice. VITALOOP maintains your longitudinal data, normalizes units, applies clinical reference logic, integrates weekly check-in feedback, and generates structured protocols tied to your specific biomarker patterns.',
    },
    {
      question: 'Can practitioners use VITALOOP for client management?',
      answer: 'Yes. The Enterprise plan includes a full Practitioner CRM with multi-client dashboards, assignment workflows, protocol templates, and trend visibility — enabling functional medicine practitioners and health coaches to manage dozens of clients efficiently.',
    },
    {
      question: 'How much does VITALOOP cost?',
      answer: 'VITALOOP offers a free plan with 1 active upload and a core dashboard. Personal Pro is $9.99/month (or $95/year) and includes unlimited uploads, personalized AI protocols, and weekly check-ins. Enterprise plans start at $99/month for practitioner teams.',
    },
  ]

  const SCHEMA_HOWTO = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Analyze Blood Test Results With AI Using VITALOOP',
    description: 'Upload your lab report and receive AI-powered biomarker analysis, personalized health protocol, and longitudinal tracking in under 60 seconds.',
    totalTime: 'PT1M',
    estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: '0' },
    step: [
      { '@type': 'HowToStep', name: 'Upload your lab report', text: 'Drop a PDF or image of your blood test results into VITALOOP. Supported formats include any standard laboratory PDF or photo.', position: 1 },
      { '@type': 'HowToStep', name: 'AI extracts and normalizes biomarkers', text: 'Our AI engine uses OCR to extract all biomarker values and normalizes them across units and reference ranges automatically.', position: 2 },
      { '@type': 'HowToStep', name: 'Signal mapping and pattern detection', text: 'Deficiencies, elevations, and cross-biomarker correlations are surfaced and ranked by clinical significance.', position: 3 },
      { '@type': 'HowToStep', name: 'Receive your personalized protocol', text: 'VITALOOP generates a targeted protocol including supplement recommendations, nutrition actions, and weekly assignments tied to your specific biomarkers.', position: 4 },
      { '@type': 'HowToStep', name: 'Track progress with adaptive check-ins', text: 'Weekly AI check-ins and new lab uploads continuously refine your protocol based on adherence and biomarker trends over time.', position: 5 },
    ],
  }

  const SCHEMA_FAQ = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }

const PRICING = {
  monthly: [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      points: ['1 active upload', 'Basic biomarker summary', 'Core dashboard'],
      cta: 'Start free',
      featured: false,
    },
    {
      name: 'Personal Pro',
      price: '$9.99',
      period: '/month',
      points: ['Unlimited uploads', 'Personalized protocol', 'Weekly AI check-ins', 'Priority insights'],
      cta: 'Upgrade to Pro',
      featured: true,
    },
    {
      name: 'Enterprise',
      price: '$99+',
      period: '/month',
      points: ['Team seats', 'Practitioner CRM', 'Workflow automation', 'Dedicated onboarding'],
      cta: 'Talk to sales',
      featured: false,
    },
  ],
  yearly: [
    {
      name: 'Free',
      price: '$0',
      period: '/year',
      points: ['1 active upload', 'Basic biomarker summary', 'Core dashboard'],
      cta: 'Start free',
      featured: false,
    },
    {
      name: 'Personal Pro',
      price: '$95',
      period: '/year',
      points: ['Unlimited uploads', 'Personalized protocol', 'Weekly AI check-ins', 'Priority insights'],
      cta: 'Get yearly plan',
      featured: true,
    },
    {
      name: 'Enterprise',
      price: '$990+',
      period: '/year',
      points: ['Team seats', 'Practitioner CRM', 'Workflow automation', 'Dedicated onboarding'],
      cta: 'Talk to sales',
      featured: false,
    },
  ],
}

function fadeUp(reduced, delay = 0) {
  if (reduced) return { initial: false, whileInView: {}, viewport: { once: true } }
  return {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.2, 0.65, 0.3, 1] },
    viewport: { once: true, margin: '-10% 0px -10% 0px' },
  }
}

function MockupCard({ title, alt, index }) {
  return (
    <motion.article
      {...fadeUp(false, Math.min(index * 0.05, 0.25))}
      className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/70 p-4 backdrop-blur"
      style={{
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.32), 0 8px 10px -6px rgb(0 0 0 / 0.28), inset 0 1px 0 rgba(16,185,129,0.08)',
      }}
    >
      {/* Image placement suggestion:
          Place optimized mockup image in /public/mockups/{slug}.webp
          Recommended dimensions: 1440x900
          Alt text should describe function, not decoration.
      */}
      <div className="relative mb-3 h-40 rounded-2xl border border-slate-700/70 bg-[linear-gradient(145deg,#0f172a,#111827_55%,#0b1220)] p-3">
        <div className="grid h-full grid-rows-[auto_1fr] gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="grid grid-cols-[1fr_0.9fr] gap-2">
            <div className="rounded-lg border border-slate-700/70 bg-slate-800/75" />
            <div className="grid gap-2">
              <div className="rounded-lg border border-slate-700/70 bg-slate-800/75" />
              <div className="rounded-lg border border-slate-700/70 bg-slate-800/75" />
            </div>
          </div>
        </div>
      </div>
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{alt}</p>
    </motion.article>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [pricingMode, setPricingMode] = useState('monthly')
  const [theme, setTheme] = useState('dark')

  const pricingCards = PRICING[pricingMode]

  const isDark = theme === 'dark'
  const rootClasses = isDark
    ? 'bg-[#0A0F1C] text-slate-100'
    : 'bg-slate-50 text-slate-900'

  const sectionCard = isDark
    ? 'border border-slate-800/80 bg-slate-900/55 backdrop-blur'
    : 'border border-slate-200 bg-white/85 backdrop-blur'

  const ctaBase = 'inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50'

  const navTextClass = isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'

  const staggerParent = useMemo(() => ({
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.08 } },
  }), [reduced])

  return (
    <div className={rootClasses}>
      <Seo
        title="AI Lab Analysis & Biohacking Platform | VITALOOP"
        description="Upload blood tests, get AI-powered biomarker analysis, personalized health protocols, and longitudinal tracking. Start free — no credit card required."
        path="/"
        schemas={[SCHEMA_HOWTO, SCHEMA_FAQ]}
      />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(16,185,129,0.18),transparent_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_2%,rgba(59,130,246,0.12),transparent_38%)]" />
      </div>

      <header className={`sticky top-0 z-40 border-b ${isDark ? 'border-slate-800/70 bg-[#0A0F1C]/84' : 'border-slate-200 bg-white/85'} backdrop-blur`}>
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-4 sm:px-6">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/90 text-white">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">VITALOOP</span>
          </button>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((item) => (
              <button
                key={item.id}
                onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
                className={`text-sm transition ${navTextClass}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className={`${ctaBase} ${isDark ? 'border border-slate-700 bg-slate-900 text-slate-200' : 'border border-slate-300 bg-white text-slate-700'} px-3 py-2 text-xs`}
              aria-label="Toggle dark and light mode"
            >
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            <button onClick={() => navigate('/login')} className={`${ctaBase} ${isDark ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
              Start free
            </button>
          </div>
        </div>
      </header>

      <main>
        <section id="hero" className="mx-auto grid w-full max-w-[1240px] gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <motion.div {...fadeUp(reduced)}>
            <p className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              Premium AI Biohacking Platform
            </p>
            <h1 className={`mt-5 text-[32px] font-bold leading-[1.1] tracking-[-0.025em] md:text-[42px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Turn Blood Test Results Into an AI-Powered Health System
            </h1>
            <p className={`mt-5 max-w-xl text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              VITALOOP uses AI to analyze your blood test results, extract biomarker insights across 85+ markers, and build a personalized protocol — then adapts it weekly based on your check-ins and new lab uploads.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate('/login?signup=true')}
                className={`${ctaBase} ${isDark ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
              >
                Start Free - No card required
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className={`${ctaBase} ${isDark ? 'border border-slate-700 bg-slate-900/80 text-slate-100 hover:border-emerald-400/50' : 'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'} `}
              >
                <CirclePlay className="mr-2 h-4 w-4" />
                Watch 45s Demo
              </button>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {['Built for longevity', 'Privacy-first architecture', 'Clinically readable outputs'].map((item) => (
                <div key={item} className={`rounded-2xl border px-4 py-3 text-sm ${isDark ? 'border-slate-800 bg-slate-900/55 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp(reduced, 0.12)} className={`rounded-3xl p-4 sm:p-5 ${sectionCard}`} style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1), inset 0 1px 0 rgba(16,185,129,0.12)' }}>
            <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-700 bg-slate-950/85' : 'border-slate-200 bg-slate-50'}`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Health Command Center</div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Realtime longitudinal overview</div>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">+12 this month</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-200 bg-white'}`}>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Top priority</div>
                  <div className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Ferritin recovery</div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-700/40">
                    <div className="h-1.5 w-[68%] rounded-full bg-emerald-500" />
                  </div>
                </div>
                <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-200 bg-white'}`}>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Weekly adherence</div>
                  <div className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>4 / 5 habits complete</div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-700/40">
                    <div className="h-1.5 w-[80%] rounded-full bg-emerald-500" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>


        {/* === Stats bar === */}
        <section aria-label="Platform statistics" className="mx-auto w-full max-w-[1240px] px-4 pb-4 sm:px-6">
          <motion.div {...fadeUp(reduced)} className={`grid grid-cols-2 gap-3 rounded-3xl border p-5 sm:grid-cols-4 ${sectionCard}`}>
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className={`text-2xl font-bold tracking-tight ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{stat.value}</div>
                <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </section>

        <section id="problem" className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className={`rounded-3xl p-6 md:p-8 ${sectionCard}`}>
            <h2 className="text-[28px] font-semibold tracking-tight">Why Most People Get Zero Value From Their Blood Tests</h2>
            <p className={`mt-4 max-w-3xl text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Standard lab reports show values and ranges — but offer no interpretation, no cross-biomarker analysis, and no personalized protocol. VITALOOP closes that gap with a continuous AI loop from raw data to weekly action.
            </p>
          </motion.div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className="mb-7">
            <h2 className="text-[28px] font-semibold tracking-tight">How AI Analyzes Your Lab Results — 5 Steps From Upload to Action</h2>
            <p className={`mt-3 max-w-3xl text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              From PDF upload to personalized protocol in under 60 seconds. Then your health system compounds over time.
            </p>
          </motion.div>

          <motion.div variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-10% 0px -10% 0px' }} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {STEPS.map((step, idx) => {
              const Icon = step.icon
              return (
                <motion.article
                  key={step.title}
                  variants={fadeUp(reduced, idx * 0.04)}
                  whileHover={reduced ? undefined : { scale: 1.02, boxShadow: '0 0 0 4px rgba(16,185,129,0.12)' }}
                  className={`rounded-3xl border p-6 transition ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'}`}
                  style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08), inset 0 1px 0 rgba(16,185,129,0.08)' }}
                >
                  <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className={`text-sm font-semibold uppercase tracking-[0.15em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Step {idx + 1}</div>
                  <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{step.body}</p>
                </motion.article>
              )
            })}
          </motion.div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className="mb-7">
            <h2 className="text-[28px] font-semibold tracking-tight">Longitudinal Biomarker Tracking Across Every Health Dimension</h2>
            <p className={`mt-3 max-w-3xl text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Every screen is designed around one goal: turning raw biomarker data into clarity you can act on — today and six months from now.
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {MOCKUPS.map((mockup, index) => (
              <MockupCard key={mockup.title} index={index} title={mockup.title} alt={mockup.alt} />
            ))}
          </div>
        </section>

        <section id="why-vitaloop" className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className="mb-7">
            <h2 className="text-[28px] font-semibold tracking-tight">Why VITALOOP</h2>
          </motion.div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {BENEFITS.map((benefit, idx) => {
              const Icon = benefit.icon
              return (
                <motion.article
                  key={benefit.title}
                  {...fadeUp(reduced, idx * 0.06)}
                  whileHover={reduced ? undefined : { scale: 1.02, boxShadow: '0 0 0 4px rgba(16,185,129,0.12)' }}
                  className={`rounded-3xl border p-6 ${isDark ? 'border-slate-800 bg-slate-900/55' : 'border-slate-200 bg-white'}`}
                  style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08), inset 0 1px 0 rgba(16,185,129,0.08)' }}
                >
                  <Icon className="h-6 w-6 text-emerald-400" />
                  <h3 className="mt-4 text-lg font-semibold">{benefit.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{benefit.body}</p>
                </motion.article>
              )
            })}
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[28px] font-semibold tracking-tight">Pricing</h2>
              <p className={`mt-3 text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Freemium entry, premium personal plan, and scalable practitioner ops.</p>
            </div>
            <div className={`inline-flex rounded-2xl border p-1 ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-300 bg-white'}`}>
              {['monthly', 'yearly'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPricingMode(mode)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${pricingMode === mode ? 'bg-emerald-500 text-slate-950' : isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-3">
            {pricingCards.map((plan) => (
              <motion.article
                key={plan.name}
                {...fadeUp(reduced)}
                className={`relative rounded-3xl border p-6 ${plan.featured ? 'border-emerald-300 bg-emerald-500/10' : isDark ? 'border-slate-800 bg-slate-900/55' : 'border-slate-200 bg-white'}`}
                style={{ boxShadow: plan.featured ? '0 0 0 4px rgba(16,185,129,0.12), 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)' }}
              >
                {plan.featured && (
                  <span className="absolute right-4 top-4 rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-950">
                    Most popular
                  </span>
                )}
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className={`pb-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{plan.period}</span>
                </div>
                <ul className="mt-5 space-y-2">
                  {plan.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{point}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigate('/login?signup=true')} className={`mt-6 w-full ${ctaBase} ${plan.featured ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : isDark ? 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400/60' : 'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}>
                  {plan.cta}
                </button>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="testimonials" className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className="mb-7">
            <h2 className="text-[28px] font-semibold tracking-tight">Real Users. Real Biomarker Progress.</h2>
          </motion.div>
          <div className="grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((item, idx) => (
              <motion.article key={item.author} {...fadeUp(reduced, idx * 0.06)} className={`rounded-3xl border p-6 ${isDark ? 'border-slate-800 bg-slate-900/55' : 'border-slate-200 bg-white'}`}>
                <p className={`text-[17px] leading-[1.7] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>"{item.quote}"</p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-300">
                    {item.author[0]}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{item.author}</div>
                    <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.role}</div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>


        {/* === FAQ Section === */}
        <section id="faq" className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className="mb-7">
            <h2 className="text-[28px] font-semibold tracking-tight">FAQ: AI Lab Analysis & Biohacking Platform</h2>
            <p className={`mt-3 max-w-3xl text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Common questions about AI-powered blood test interpretation, biomarker tracking, and personalized health protocols.
            </p>
          </motion.div>
          <div className="grid gap-3 md:gap-4">
            {FAQ_ITEMS.map((item, idx) => (
              <motion.details
                key={item.question}
                {...fadeUp(reduced, idx * 0.04)}
                className={`group rounded-2xl border px-5 py-4 ${isDark ? 'border-slate-800 bg-slate-900/55' : 'border-slate-200 bg-white'}`}
              >
                <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  <span>{item.question}</span>
                  <span className="shrink-0 text-emerald-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className={`mt-3 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.answer}</p>
              </motion.details>
            ))}
          </div>
        </section>

        {/* === Blog teaser === */}
        <section aria-label="Health intelligence resources" className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6">
          <motion.div {...fadeUp(reduced)} className={`rounded-3xl border p-6 md:p-8 ${sectionCard}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Health Intelligence Hub</p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Guides on Biomarker Interpretation & Biohacking</h2>
                <p className={`mt-2 max-w-xl text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Deep dives on reading blood test results, optimizing ferritin, testosterone, cortisol, and building a sustainable biohacking protocol.
                </p>
              </div>
              <button
                onClick={() => navigate('/how-it-works')}
                className={`${ctaBase} shrink-0 ${isDark ? 'border border-slate-700 bg-slate-900/80 text-slate-100 hover:border-emerald-400/60' : 'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}
              >
                Explore guides
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className={`rounded-3xl border p-6 md:p-8 ${sectionCard}`}>
            <h2 className="text-[28px] font-semibold tracking-tight">The Biohacking Feedback Loop: How Longitudinal Lab Tracking Works</h2>
            <p className={`mt-3 max-w-3xl text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Biohacking is not a one-time blood test — it is a continuous feedback cycle. VITALOOP makes that loop automatic: data → AI insight → action protocol → weekly check-in → next lab upload. Each cycle makes the next one smarter.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-5">
              {['Data', 'Insight', 'Action', 'Feedback', 'Adaptation'].map((item, idx) => (
                <div key={item} className={`rounded-2xl border px-4 py-4 text-center ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                  <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{idx + 1}</div>
                  <div className="mt-1 text-sm font-semibold">{item}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-10 sm:px-6 md:pb-28 md:pt-16">
          <motion.div {...fadeUp(reduced)} className={`rounded-3xl border p-6 text-center md:p-10 ${sectionCard}`}>
            <h2 className="text-[28px] font-semibold tracking-tight">Start Interpreting Your Blood Tests With AI Today</h2>
            <p className={`mx-auto mt-3 max-w-2xl text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Join 14,000+ users who replaced guesswork with AI-powered biomarker analysis and personalized protocols. Free to start, no credit card required.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => navigate('/login?signup=true')} className={`${ctaBase} ${isDark ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
                Start free now
              </button>
              <button onClick={() => navigate('/how-it-works')} className={`${ctaBase} ${isDark ? 'border border-slate-700 bg-slate-900/80 text-slate-100 hover:border-emerald-400/60' : 'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}>
                Explore product
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className={`border-t ${isDark ? 'border-slate-800 bg-[#070b15]' : 'border-slate-200 bg-white'} py-8`}>
        <div className="mx-auto flex w-full max-w-[1240px] flex-col justify-between gap-2 px-4 text-sm sm:px-6 md:flex-row">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>VITALOOP © {new Date().getFullYear()} — AI Lab Analysis & Biohacking Platform</span>
          <div className="flex gap-4">
            <button onClick={() => navigate('/terms')} className={`underline-offset-2 hover:underline ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Terms</button>
            <button onClick={() => navigate('/privacy')} className={`underline-offset-2 hover:underline ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Privacy</button>
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Not medical advice</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
