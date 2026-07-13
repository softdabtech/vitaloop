import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  FlaskConical,
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  Upload,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'

const SCREENSHOTS = [
  {
    title: 'Today dashboard',
    description: 'A single place for current priorities, uploads, weekly tasks, and next actions.',
    image: '/mockups/example-report/dashboard.webp',
    alt: 'VITALOOP user dashboard with health summary cards and next actions',
    icon: LayoutDashboard,
  },
  {
    title: 'Lab results',
    description: 'Normalized biomarkers with values, units, reference ranges, status, interpretation context, and quality signals.',
    image: '/mockups/example-report/lab-results.webp',
    alt: 'VITALOOP lab results page with biomarker rows and status indicators',
    icon: FlaskConical,
  },
  {
    title: 'Upload flow',
    description: 'Upload PDF/image results or use structured entry, then keep the source context connected to the analysis.',
    image: '/mockups/example-report/upload.webp',
    alt: 'VITALOOP upload page for lab report PDFs',
    icon: Upload,
  },
  {
    title: 'Progress tracking',
    description: 'See how symptoms, actions, and biomarker trends change across repeated cycles.',
    image: '/mockups/example-report/progress.webp',
    alt: 'VITALOOP progress page with charts and trend cards',
    icon: TrendingUp,
  },
  {
    title: 'Weekly check-in',
    description: 'Capture adherence and how you feel so each loop becomes more useful than the last.',
    image: '/mockups/example-report/check-in.webp',
    alt: 'VITALOOP weekly check-in page with symptom and action tracking',
    icon: ClipboardList,
  },
  {
    title: 'Practitioner workspace',
    description: 'For labs, nutritionists, and practitioners managing client context and review queues.',
    image: '/mockups/example-report/crm.webp',
    alt: 'VITALOOP practitioner CRM dashboard with client panels',
    icon: BarChart3,
  },
]

const REPORT_HIGHLIGHTS = [
  { label: 'Analysis engine', value: 'Core V2', detail: 'shared B2C/B2B pipeline' },
  { label: 'Workflow', value: '5 steps', detail: 'symptoms -> labs -> protocol -> check-in' },
  { label: 'Output', value: 'Structured', detail: 'priorities, safety, trends, and next actions' },
]

const BIOMARKERS = [
  { name: 'Ferritin', value: '12 ng/mL', status: 'Review', tone: 'amber', note: 'Possible low iron storage pattern when paired with fatigue.' },
  { name: 'Vitamin D', value: '24 ng/mL', status: 'Low', tone: 'amber', note: 'Common optimization target to discuss with a clinician.' },
  { name: 'HbA1c', value: '5.8%', status: 'Watch', tone: 'rose', note: 'May indicate a metabolic trend that needs follow-up.' },
  { name: 'HDL', value: '58 mg/dL', status: 'In range', tone: 'emerald', note: 'Useful context for the broader lipid picture.' },
]

const WORKFLOW = [
  {
    icon: FileText,
    title: 'Upload a report',
    body: 'VITALOOP reads lab inputs, extracts biomarkers where possible, and preserves the source context.',
  },
  {
    icon: FlaskConical,
    title: 'Normalize the data',
    body: 'Values, units, and reference ranges are structured so markers can be compared safely.',
  },
  {
    icon: CheckCircle2,
    title: 'Prioritize what matters',
    body: 'The system groups findings into review priorities, explains why, and surfaces safety notes instead of leaving you with a raw table.',
  },
  {
    icon: TrendingUp,
    title: 'Track the loop',
    body: 'Weekly feedback and future lab uploads help refine the plan over time.',
  },
]

const toneClass = {
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-800',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

export default function ExampleReport() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title="Health Intelligence Example Report | VITALOOP"
        description="Preview a VITALOOP health intelligence report with normalized biomarkers, Knowledge Base reasoning, priority findings, safety notes, discussion points, retest timing, and progress tracking."
        path="/example-report"
      />

      <PageHeader />

      <main>
        <section className="mx-auto grid max-w-[1240px] gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:pt-12">
          <div>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Example report
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-5 text-4xl font-black tracking-[-0.035em] text-slate-950 sm:text-5xl md:text-6xl">
              From lab results to a working health intelligence dashboard.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              This page shows the real VITALOOP workflow: upload results, review structured biomarkers, understand priorities and safety notes, then keep progress moving through weekly check-ins and retests.
            </motion.p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/login?signup=true')}
                className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22)] transition hover:bg-emerald-600"
              >
                Start with your results
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/how-it-works')}
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-400 hover:bg-slate-50"
              >
                See how it works
              </button>
            </div>

          </div>

          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[32px] bg-[radial-gradient(circle_at_20%_10%,rgba(20,184,166,0.22),transparent_36%),radial-gradient(circle_at_88%_14%,rgba(56,189,248,0.12),transparent_34%)]" />
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-2xl shadow-emerald-900/10">
              <img
                src="/mockups/example-report/dashboard.webp"
                alt="VITALOOP dashboard preview"
                className="aspect-[16/10] w-full object-cover object-top"
              />
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {REPORT_HIGHLIGHTS.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-2xl font-black text-slate-950">{item.value}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{item.label}</div>
                <div className="mt-2 text-sm leading-5 text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50 py-16">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Cabinet screens</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] text-slate-950">What users actually see after upload</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                No decorative avatar. The product is a structured workspace for lab interpretation, symptom context, progress, and practitioner review.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {SCREENSHOTS.map(({ title, description, image, alt, icon: Icon }) => (
                <motion.article
                  key={title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-start gap-3 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 bg-slate-100 p-2">
                    <img src={image} alt={alt} className="aspect-[16/10] w-full rounded-[18px] object-cover object-top" loading="lazy" />
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Structured interpretation</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] text-slate-950">A report becomes priorities, not just numbers.</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              VITALOOP keeps results readable: each marker is normalized, statused, and connected to the broader workflow with rationale, safety context, trends, and retest direction. The output is educational decision support, not a diagnosis.
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              Medical review is recommended for abnormal or concerning values.
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {BIOMARKERS.map((marker) => (
              <article key={marker.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">{marker.name}</h3>
                    <p className="mt-1 text-2xl font-black text-slate-900">{marker.value}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${toneClass[marker.tone]}`}>
                    {marker.status}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{marker.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-slate-950 py-16 text-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Workflow</p>
                <h2 className="mt-3 text-4xl font-black tracking-[-0.03em]">The useful part is the loop.</h2>
                <p className="mt-4 text-lg leading-8 text-slate-300">
                  The report is only the starting point. VITALOOP connects it to symptom context, weekly execution, and future retesting.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {WORKFLOW.map(({ icon: Icon, title, body }) => (
                  <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,#0f766e,#10b981)] px-6 py-12 text-center text-white shadow-2xl shadow-emerald-900/15 sm:px-10">
            <h2 className="text-4xl font-black tracking-[-0.03em]">Try the workflow with your own lab report.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-emerald-50">
              Start free, upload one report, and see how VITALOOP turns raw lab values into a clearer health workspace.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => navigate('/login?signup=true')}
                className="inline-flex items-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-50"
              >
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/for-nutritionists')}
                className="inline-flex items-center rounded-2xl border border-white/35 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                For labs and practitioners
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
