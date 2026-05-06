import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart2,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import { fadeUp, fadeUpBlur, stagger, staggerChild, EASE } from '../lib/motion.js'
import { gaEvent } from '../lib/analytics.js'

/* ─── Data ──────────────────────────────────────────────── */

const PAIN_POINTS = [
  {
    icon: ClipboardList,
    title: 'Protocols are scattered across files',
    body: 'Google Docs, PDFs, and chat threads make patient data hard to track. There is no single system for execution and follow-through.',
  },
  {
    icon: FlaskConical,
    title: 'Lab reports come in mixed formats',
    body: 'Every lab uses different layouts and units. Manual interpretation takes an hour when it should take a minute.',
  },
  {
    icon: HeartPulse,
    title: 'Patients disappear after consultations',
    body: 'Without a structured follow-up loop, it is difficult to keep engagement, monitor progress, and adjust plans between sessions.',
  },
]

const WORKFLOW_STEPS = [
  {
    icon: Users,
    step: '01',
    title: 'Invite patients',
    body: 'Add clients by email. Each patient gets a personal workspace to upload labs and track progress.',
    accent: '#10b981',
  },
  {
    icon: Upload,
    step: '02',
    title: 'Lab reports are interpreted in minutes',
    body: 'Patients upload a PDF. VITALOOP extracts 85+ biomarkers, normalizes units, and highlights abnormalities.',
    accent: '#0ea5e9',
  },
  {
    icon: BrainCircuit,
    step: '03',
    title: 'AI drafts your protocol',
    body: 'Based on biomarkers, symptoms, and history, the system proposes a nutrition protocol that you finalize as the practitioner.',
    accent: '#8b5cf6',
  },
  {
    icon: Calendar,
    step: '04',
    title: 'Weekly check-ins keep patients engaged',
    body: 'Automated check-ins capture symptoms and adherence. You monitor outcomes without unnecessary calls.',
    accent: '#f59e0b',
  },
  {
    icon: TrendingUp,
    step: '05',
    title: 'Longitudinal analytics each cycle',
    body: 'New labs are compared against previous cycles, so you can see what improved, what needs adjustments, and when to retest.',
    accent: '#10b981',
  },
]

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Unified practitioner dashboard',
    body: 'All patients, all protocols, and all labs in one interface. High-risk signals are visible immediately.',
  },
  {
    icon: ClipboardList,
    title: 'Personalized care programs',
    body: 'Create rehabilitation, nutrition support, or longevity programs with specific tasks and timelines.',
  },
  {
    icon: BarChart2,
    title: 'Biomarker trends over time',
    body: 'Trend charts make patient progress clear and support protocol adjustments with real data.',
  },
  {
    icon: MessageSquare,
    title: 'Built-in tasks and follow-ups',
    body: 'Assign actions like retests, supplement plans, and nutrition changes. Patients mark completion, you track adherence.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy-first data protection',
    body: 'Medical data is never sold or shared with third parties. VITALOOP is built with strict privacy principles.',
  },
  {
    icon: Sparkles,
    title: 'AI as a second opinion, not a replacement',
    body: 'The platform provides drafts and signals. Final decisions remain in your hands as the expert.',
  },
]

const USE_CASES = [
  {
    title: 'Rehabilitation programs',
    body: 'Support patients after illness, surgery, or burnout. Track recovery markers and adjust nutrition step by step.',
    tag: 'Rehabilitation',
    tagColor: '#10b981',
  },
  {
    title: 'Longevity and preventive nutrition',
    body: 'For clients focused on healthy aging. Quarterly lab cycles with adaptive protocols and long-term optimization.',
    tag: 'Longevity',
    tagColor: '#8b5cf6',
  },
  {
    title: 'Sports nutrition and recovery',
    body: 'Track ferritin, B12, D3, and hormone balance for active clients. Adapt protocols to training cycles.',
    tag: 'Sports',
    tagColor: '#0ea5e9',
  },
  {
    title: 'Food sensitivity and gut health',
    body: 'Track inflammatory markers, nutrient status, and symptom dynamics across multiple nutrition cycles.',
    tag: 'Gut health',
    tagColor: '#f59e0b',
  },
]

const METRICS = [
  { value: '85+', label: 'Biomarkers extracted from a single report' },
  { value: '<60s', label: 'From upload to protocol draft' },
  { value: '100%', label: 'Patient history in one place' },
  { value: '1:N', label: 'One practitioner, many active patients' },
]

/* ─── Sub-components ────────────────────────────────────── */

function GlowBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_5%,rgba(16,185,129,0.18),transparent_36%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_92%_12%,rgba(14,165,233,0.10),transparent_34%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.07),transparent_40%)]" />
    </div>
  )
}

function SectionLabel({ children, color = '#10b981' }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]"
      style={{ borderColor: `${color}33`, background: `${color}12`, color }}
    >
      {children}
    </span>
  )
}

function MetricCard({ value, label }) {
  return (
    <motion.div
      variants={staggerChild}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center backdrop-blur-sm"
    >
      <div className="text-4xl font-bold tracking-tight text-emerald-600">{value}</div>
      <div className="mt-2 text-sm leading-snug text-slate-600">{label}</div>
    </motion.div>
  )
}

function PainCard({ icon: Icon, title, body }) {
  return (
    <motion.div
      variants={staggerChild}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-6 backdrop-blur-sm transition hover:border-slate-300"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
        <Icon className="h-5 w-5 text-red-600" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-600">{body}</p>
    </motion.div>
  )
}

function WorkflowStep({ icon: Icon, step, title, body, accent, index }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={index * 0.08}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      className="flex gap-5"
    >
      <div className="flex flex-col items-center">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `${accent}18`, border: `1px solid ${accent}33` }}
        >
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
        {index < WORKFLOW_STEPS.length - 1 && (
          <div className="mt-2 w-px flex-1 bg-gradient-to-b from-slate-300 to-transparent" />
        )}
      </div>
      <div className="pb-10">
        <div className="mb-1 text-xs font-bold tracking-widest" style={{ color: accent }}>{step}</div>
        <h3 className="mb-1.5 text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm leading-relaxed text-slate-600">{body}</p>
      </div>
    </motion.div>
  )
}

function FeatureCard({ icon: Icon, title, body }) {
  return (
    <motion.div
      variants={staggerChild}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-6 backdrop-blur-sm transition hover:border-emerald-300"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
        <Icon className="h-5 w-5 text-emerald-600" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-600">{body}</p>
    </motion.div>
  )
}

function UseCaseCard({ title, body, tag, tagColor }) {
  return (
    <motion.div
      variants={staggerChild}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-6 backdrop-blur-sm transition hover:border-slate-300"
    >
      <span
        className="mb-3 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
        style={{ background: `${tagColor}18`, color: tagColor }}
      >
        {tag}
      </span>
      <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-600">{body}</p>
    </motion.div>
  )
}

/* ─── Page ──────────────────────────────────────────────── */

export default function ForNutritionists() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title="AI Lab Analysis for Nutritionists | VITALOOP"
        description="Manage clients, interpret blood test labs in minutes, and run personalized nutrition protocols in one practitioner workspace. Start free with VITALOOP."
        path="/for-nutritionists"
        schemas={[
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'AI Lab Analysis for Nutritionists',
            description:
              'VITALOOP provides nutritionists and dietitians with AI-powered blood test analysis, client management, personalized protocol generation, and longitudinal biomarker tracking.',
            provider: {
              '@type': 'Organization',
              name: 'VITALOOP',
              url: 'https://vitaloop.today',
            },
            url: 'https://vitaloop.today/for-nutritionists',
            serviceType: 'Health Technology Platform',
            audience: {
              '@type': 'Audience',
              audienceType: 'Nutritionists, Dietitians, Functional Medicine Practitioners',
            },
          },
        ]}
      />

      <GlowBg />

      <PageHeader />

      {/* ── Hero ── */}
      <section className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible">
              <SectionLabel>For Nutritionists</SectionLabel>
            </motion.div>
            <motion.h1
              variants={fadeUpBlur}
              custom={0.06}
              initial="hidden"
              animate="visible"
              className="mt-5 text-5xl font-bold leading-[1.08] tracking-[-0.03em] text-slate-900 md:text-6xl"
            >
                Manage patients&nbsp;—<br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  not spreadsheets
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={0.12}
              initial="hidden"
              animate="visible"
              className="mt-5 max-w-xl text-lg leading-8 text-slate-600"
            >
                VITALOOP turns blood test data into personalized nutrition and recovery protocols.
                Bring patients, monitor progress, and adjust programs from one practitioner-focused workspace.
            </motion.p>
            <motion.div
              variants={fadeUp}
              custom={0.18}
              initial="hidden"
              animate="visible"
              className="mt-8 flex flex-wrap gap-3"
            >
              <button
                onClick={() => {
                  gaEvent('nutritionist_cta_click', { location: 'hero', label: 'start_free' })
                  navigate('/login?signup=true')
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                  Start for free
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  gaEvent('nutritionist_example_click', { location: 'hero' })
                  navigate('/example-report')
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-500 hover:bg-slate-50"
              >
                  View sample report
              </button>
            </motion.div>
            <motion.div
              variants={fadeUp}
              custom={0.22}
              initial="hidden"
              animate="visible"
              className="mt-6 flex flex-wrap gap-4"
            >
              {['Free starter plan', 'No EMR integration required', 'Works with any lab PDF'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Hero card */}
          <motion.div
            variants={fadeUp}
            custom={0.1}
            initial="hidden"
            animate="visible"
            className="rounded-3xl border border-slate-200 bg-white p-6 backdrop-blur-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Patient: Anna K., 34</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">Active protocol</span>
            </div>
            <div className="space-y-3">
              {[
                { marker: 'Ferritin', val: '11 ng/mL', flag: 'Low', color: '#ef4444' },
                { marker: 'Vitamin D (25-OH)', val: '18 nmol/L', flag: 'Deficient', color: '#f59e0b' },
                { marker: 'B12', val: '245 pmol/L', flag: 'Borderline', color: '#f59e0b' },
                { marker: 'TSH', val: '2.1 mIU/L', flag: 'Normal', color: '#10b981' },
                { marker: 'hsCRP', val: '0.8 mg/L', flag: 'Normal', color: '#10b981' },
              ].map(({ marker, val, flag, color }) => (
                <div key={marker} className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2.5">
                  <span className="text-sm text-slate-700">{marker}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-900">{val}</span>
                    <span className="min-w-[70px] rounded-full px-2 py-0.5 text-center text-[11px] font-semibold" style={{ background: `${color}1a`, color }}>{flag}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <BrainCircuit className="h-3.5 w-3.5" />
                  AI protocol draft
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                  Priority: restore iron and vitamin D. Suggested: iron bisglycinate 25 mg/day with vitamin C, vitamin D3 5000 IU/day. Retest ferritin in 8 weeks.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Metrics ── */}
      <section className="border-y border-slate-200 bg-slate-50 py-12">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mx-auto grid max-w-[1240px] grid-cols-2 gap-4 px-4 sm:px-6 lg:grid-cols-4"
        >
          {METRICS.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </motion.div>
      </section>

      {/* ── Pain points ── */}
      <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <SectionLabel color="#ef4444">Common pain points</SectionLabel>
          <motion.h2
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
          >
              Why client management is still painful
          </motion.h2>
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-5 md:grid-cols-3"
        >
          {PAIN_POINTS.map((p) => (
            <PainCard key={p.title} {...p} />
          ))}
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="border-y border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="mb-14 max-w-xl">
            <SectionLabel>Workflow</SectionLabel>
            <motion.h2
              variants={fadeUp}
              custom={0}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
            >
                From first intake to measurable outcomes in 5 steps
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={0.06}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="mt-3 text-slate-600"
            >
                Run the full patient cycle in one platform without EMR integrations or setup overhead.
            </motion.p>
          </div>
          <div className="max-w-2xl">
            {WORKFLOW_STEPS.map((step, i) => (
              <WorkflowStep key={step.step} {...step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ── */}
      <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <SectionLabel>Capabilities</SectionLabel>
          <motion.h2
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
          >
              Everything a nutritionist needs to run better care
          </motion.h2>
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </motion.div>
      </section>

      {/* ── Use cases ── */}
      <section className="border-y border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="mb-12 text-center">
            <SectionLabel color="#8b5cf6">Use cases</SectionLabel>
            <motion.h2
              variants={fadeUp}
              custom={0}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
            >
                Built for multiple nutrition practice models
            </motion.h2>
          </div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {USE_CASES.map((u) => (
              <UseCaseCard key={u.title} {...u} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Patient value ── */}
      <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <SectionLabel color="#0ea5e9">Patient value</SectionLabel>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Patients see outcomes, not just recommendations
            </h2>
            <p className="mt-4 text-slate-600">
                The patient workspace shows biomarker trends, current protocol steps, and task completion.
                This improves engagement and reduces drop-off between sessions.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Full lab history in one place',
                'Clear interpretation for non-clinical users',
                'Weekly reminders for protocol adherence',
                'Progress trends improve motivation',
                'Mobile-friendly access from any device',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Mockup: patient view */}
          <motion.div
            variants={fadeUp}
            custom={0.08}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="rounded-3xl border border-slate-200 bg-white p-6 backdrop-blur-sm"
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Anna's progress</span>
              <span className="text-xs text-slate-500">8 weeks on protocol</span>
            </div>
            <div className="mb-4 space-y-3">
              {[
                { marker: 'Ferritin', before: '11', after: '28', unit: 'ng/mL', up: true },
                { marker: 'Vitamin D', before: '18', after: '47', unit: 'nmol/L', up: true },
                { marker: 'B12', before: '245', after: '390', unit: 'pmol/L', up: true },
              ].map(({ marker, before, after, unit, up }) => (
                <div key={marker} className="rounded-xl bg-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{marker}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <TrendingUp className="h-3 w-3" />
                      {before} → {after} {unit}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-300">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                      initial={{ width: '20%' }}
                      whileInView={{ width: '72%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: EASE, delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 text-xs font-semibold text-slate-600">Weekly tasks</div>
              {[
                { done: true,  text: 'Take iron with vitamin C' },
                { done: true,  text: 'Take D3 + K2 in the morning with food' },
                { done: false, text: 'Complete CBC retest (scheduled)' },
              ].map(({ done, text }) => (
                <div key={text} className="flex items-center gap-2 py-1.5 text-sm">
                  <CheckCircle2 className={`h-4 w-4 shrink-0 ${done ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className={done ? 'text-slate-700' : 'text-slate-600'}>{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="mx-auto max-w-[1240px] px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <SectionLabel color="#10b981">Pricing</SectionLabel>
          <motion.h2
            variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
          >
              Simple plans for real clinical work
          </motion.h2>
          <motion.p
            variants={fadeUp} custom={0.06} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="mt-3 text-slate-600"
          >
              Start free and upgrade when your practice grows.
          </motion.p>
        </div>
        <div className="mx-auto flex flex-col items-center gap-6 lg:flex-row lg:items-stretch lg:justify-center">

          {/* Free card */}
          <motion.div
            variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 backdrop-blur-sm"
          >
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-600">Starter</div>
            <div className="mb-1 text-4xl font-bold text-slate-900">$0</div>
            <div className="mb-5 text-sm text-slate-600">free forever</div>
            <ul className="mb-8 space-y-3">
              {[
                '1-2 analyses per month',
                'Basic flags and summary',
                '1 patient seat',
                'Protocol drafts',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                gaEvent('nutritionist_pricing_click', { plan: 'free' })
                navigate('/login?signup=true')
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-500 hover:bg-white"
            >
                Start free
            </button>
          </motion.div>

          {/* Practitioner Premium card — highlighted */}
          <motion.div
            variants={fadeUp} custom={0.08} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="relative w-full max-w-sm rounded-3xl border border-emerald-200 bg-emerald-50 p-8 shadow-[0_0_40px_rgba(16,185,129,0.08)] backdrop-blur-sm"
          >
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  Recommended
              </span>
            </div>
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-600">Practitioner Premium</div>
            <div className="mb-1 flex items-end gap-1">
              <span className="text-4xl font-bold text-slate-900">$29</span>
              <span className="mb-1 text-sm text-slate-600">/month</span>
            </div>
            <div className="mb-5 text-sm text-slate-600">or $299/year — save 17%</div>
            <ul className="mb-8 space-y-3">
              {[
                'Unlimited analyses',
                'Full biomarker-driven protocols',
                'Multiple active patients',
                'CRM workflows and task tracking',
                'Longitudinal biomarker trends',
                'Weekly patient check-ins',
                'Priority product updates',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                gaEvent('nutritionist_pricing_click', { plan: 'practitioner_pro' })
                navigate('/login?signup=true')
              }}
              className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
                Try Practitioner Premium
            </button>
          </motion.div>

        </div>
      </section>

      {/* ── Contact ── */}
      <section className="border-y border-slate-200 bg-slate-50 py-16">
        <motion.div
          variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="mx-auto max-w-[680px] px-4 text-center sm:px-6"
        >
          <SectionLabel color="#0ea5e9">Contact us</SectionLabel>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Questions or enterprise requirements?
          </h2>
          <p className="mt-3 text-slate-600">
              Email us directly. We usually respond within one business day and can discuss custom conditions for clinics and nutrition practices.
          </p>
          <a
            href="mailto:info@softdab.tech"
            onClick={() => gaEvent('nutritionist_contact_click', { location: 'contact_section' })}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-6 py-3 text-sm font-semibold text-sky-600 transition hover:bg-sky-100 hover:text-sky-700"
          >
            <MessageSquare className="h-4 w-4" />
            info@softdab.tech
          </a>
          <p className="mt-4 text-xs text-slate-600">
              We can also help with integrations, onboarding, and enterprise pricing.
          </p>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white py-24">
        <div className="mx-auto max-w-[720px] px-4 text-center sm:px-6">
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <SectionLabel>Get started today</SectionLabel>
            <h2 className="mt-5 text-4xl font-bold tracking-[-0.03em] text-slate-900 md:text-5xl">
                Bring your first patient<br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  today
              </span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
                Start with a free account. Upload one patient report and see how VITALOOP saves time on every consultation.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => {
                  gaEvent('nutritionist_cta_click', { location: 'bottom_cta', label: 'signup' })
                  navigate('/login?signup=true')
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-600 sm:w-auto"
              >
                  Sign up for free
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  gaEvent('nutritionist_how_it_works_click', { location: 'bottom_cta' })
                  navigate('/how-it-works')
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-900 transition hover:border-emerald-500 sm:w-auto"
              >
                  How the platform works
              </button>
            </div>
            <p className="mt-5 text-xs text-slate-600">
                No EMR integration required · Works with any lab PDF · Data is never sold
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
