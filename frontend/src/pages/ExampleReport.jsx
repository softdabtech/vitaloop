import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  HeartPulse,
  Info,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'

const REPORT_STATS = [
  { label: 'Markers reviewed', value: '7', tone: 'bg-white text-slate-950' },
  { label: 'Need context', value: '2', tone: 'bg-rose-50 text-rose-700' },
  { label: 'Stable markers', value: '5', tone: 'bg-emerald-50 text-emerald-700' },
  { label: 'Confidence', value: '69%', tone: 'bg-amber-50 text-amber-800' },
]

const SUMMARY_SIGNALS = [
  {
    title: 'What matters now',
    value: 'Two reticulocyte volume indices are below the lab reference range.',
    body: 'The pattern can be useful, but it should be interpreted together with CBC, iron status, B12, folate, inflammation context, symptoms, and child profile.',
    icon: AlertTriangle,
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  {
    title: 'What VITALOOP will not claim',
    value: 'This does not confirm anemia or a diagnosis.',
    body: 'The report stays conservative when decisive markers are missing. It is designed to prepare a better medical conversation.',
    icon: ShieldCheck,
    tone: 'border-sky-200 bg-sky-50 text-sky-900',
  },
  {
    title: 'Next best step',
    value: 'Review the result with CBC and iron context.',
    body: 'A stronger interpretation needs hemoglobin, RBC indices, ferritin, transferrin saturation, B12, folate, CRP and age-aware review.',
    icon: ClipboardList,
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
]

const FINDINGS = [
  {
    marker: 'Mean Reticulocyte Volume',
    value: '91.9 fl',
    range: '92.7 - 112.1 fl',
    status: 'Below reference',
    delta: '0.8 fl below lower limit',
    summary: 'One isolated low reticulocyte index. Useful as a signal, not enough as a standalone conclusion.',
    position: 7,
  },
  {
    marker: 'Mean Spherical Cell Volume',
    value: '66.6 fl',
    range: '72.8 - 87.3 fl',
    status: 'Below reference',
    delta: '6.2 fl below lower limit',
    summary: 'A second reticulocyte volume signal. It becomes more meaningful when paired with CBC and iron-related markers.',
    position: 12,
  },
]

const EVIDENCE_GAPS = [
  'Hemoglobin, RBC, hematocrit, MCV, MCH, MCHC, RDW',
  'Ferritin plus transferrin saturation and serum iron',
  'Vitamin B12 and folate',
  'CRP or inflammation context, if relevant',
  'Age, sex, height, weight, symptoms, nutrition, recent illness',
]

const ACTIONS = [
  {
    label: 'Today',
    title: 'Do not act on the isolated markers alone',
    body: 'Use this report to prepare questions. Avoid supplements or treatment decisions until the broader context is reviewed.',
  },
  {
    label: 'This week',
    title: 'Collect missing context',
    body: 'Bring CBC indices, iron panel, B12, folate, symptoms, recent illness, nutrition pattern and growth context into one review.',
  },
  {
    label: 'Retest timing',
    title: 'Retest depends on clinical context',
    body: 'VITALOOP suggests timing only when the data supports it. In this sample, follow-up timing should come after medical review.',
  },
]

const DOCTOR_QUESTIONS = [
  'Do these reticulocyte volume indices matter together with hemoglobin, MCV, MCH, MCHC and RDW?',
  'Should ferritin, transferrin saturation, serum iron, B12, folate and CRP be checked to clarify the picture?',
  'For a child, should these values be interpreted differently based on age, growth, symptoms and recent illness?',
]

const BIOMARKER_TABLE = [
  ['Mean Reticulocyte Volume', '91.9 fl', '92.7 - 112.1 fl', 'Below reference'],
  ['Mean Spherical Cell Volume', '66.6 fl', '72.8 - 87.3 fl', 'Below reference'],
  ['Reticulocytes', '1.22%', '0.5 - 2.2%', 'In range'],
  ['Reticulocytes', '59.8 Г/л', '30 - 105 Г/л', 'In range'],
  ['Immature Reticulocytes', '0.34%', '0.2 - 0.42%', 'In range'],
  ['Mature Reticulocytes', '0.41%', '0.15 - 0.73%', 'In range'],
  ['Reticulocyte Distribution Width', '25.4%', '22.9 - 31.2%', 'In range'],
]

const CABINET_SCREENS = [
  {
    title: 'Report screen',
    body: 'Health summary, priority findings, evidence gaps, doctor questions, retest planning, and the full biomarker table.',
    image: '/mockups/cabinet-live/results-clean.webp?v=20260814',
    alt: 'VITALOOP results report screen with summary, findings, evidence gaps and actions',
  },
  {
    title: 'Upload flow',
    body: 'PDF, image, spreadsheet, or manual entry flows keep the source connected to the interpretation.',
    image: '/mockups/cabinet-live/upload-clean.webp?v=20260814',
    alt: 'VITALOOP upload screen for lab reports and manual biomarker entry',
  },
  {
    title: 'Lab history',
    body: 'Past uploads remain accessible for comparison, protocol planning and future retest loops.',
    image: '/mockups/cabinet-live/lab-results-clean.webp?v=20260814',
    alt: 'VITALOOP lab results history screen',
  },
]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
})

function StatusPill({ children, tone = 'emerald' }) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${tones[tone] || tones.emerald}`}>
      {children}
    </span>
  )
}

function MarkerRange({ position }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase text-slate-500">
        <span>Below range</span>
        <span>Reference interval</span>
      </div>
      <div className="relative h-3 rounded-full bg-slate-200">
        <div className="absolute left-[18%] top-0 h-3 w-[62%] rounded-full bg-emerald-300" />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow-md"
          style={{ left: `${position}%` }}
        />
      </div>
    </div>
  )
}

export default function ExampleReport() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f7fbfa] text-slate-900">
      <Seo
        title="Example Health Intelligence Report | VITALOOP"
        description="See how VITALOOP turns lab results into a clear educational report with findings, context gaps, next actions, doctor questions, retest planning, and biomarker details."
        path="/example-report"
        image="https://vitaloop.today/mockups/cabinet-live/results-clean.webp?v=20260814"
        imageAlt="VITALOOP example health intelligence report screen"
      />

      <PageHeader />

      <main>
        <section className="border-b border-emerald-100 bg-[linear-gradient(180deg,#f1faf7_0%,#ffffff_72%,#f7fbfa_100%)]">
          <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:py-14">
            <motion.div {...fadeUp()}>
              <StatusPill tone="emerald">Example report</StatusPill>
              <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
                A clearer health report, not another lab table.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                This sample shows the new VITALOOP cabinet report: what is happening, why it matters, what context is missing, what to discuss with a clinician, and what to do next.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/login?signup=true')}
                  className="inline-flex min-h-12 items-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-700"
                >
                  Try with your results
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate('/upload')}
                  className="inline-flex min-h-12 items-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  Upload labs
                  <Upload className="ml-2 h-4 w-4" />
                </button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  'Educational interpretation, not diagnosis',
                  'Knowledge Base plus deterministic checks',
                  'Safety language before recommendations',
                  'PDF export for clinician conversations',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.08)} className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10">
              <img
                src="/mockups/cabinet-live/results-clean.webp?v=20260814"
                alt="VITALOOP report screen with health summary, findings, evidence gaps, actions, and biomarker table"
                width="1110"
                height="700"
                className="aspect-[16/10] w-full rounded-lg border border-slate-100 bg-slate-50 object-cover object-top"
                loading="eager"
              />
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REPORT_STATS.map((stat) => (
              <motion.article key={stat.label} {...fadeUp()} className={`rounded-lg border border-slate-200 p-5 shadow-sm ${stat.tone}`}>
                <p className="text-3xl font-black">{stat.value}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{stat.label}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 pb-12 sm:px-6">
          <motion.article {...fadeUp()} className="overflow-hidden rounded-lg border border-emerald-200 bg-white shadow-xl shadow-emerald-900/5">
            <div className="grid lg:grid-cols-[1fr_320px]">
              <div className="p-6 sm:p-8">
                <StatusPill tone="emerald">Health summary</StatusPill>
                <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                  Isolated low reticulocyte volume indices need context before a stronger conclusion.
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                  Mean Reticulocyte Volume and Mean Spherical Cell Volume are below the laboratory reference range, while available reticulocyte counts are within range. VITALOOP treats this as a context-required signal rather than a diagnosis.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate('/login?signup=true')}
                    className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    Create your report
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                  <button className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:border-emerald-300">
                    Download sample
                    <Download className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="border-t border-emerald-100 bg-emerald-50 p-6 lg:border-l lg:border-t-0">
                <p className="text-xs font-bold uppercase text-emerald-700">Report quality</p>
                <p className="mt-3 text-4xl font-black text-emerald-800">69%</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  Useful signal found, but stronger interpretation requires missing CBC, iron, B12, folate and profile context.
                </p>
                <div className="mt-5 rounded-lg border border-emerald-200 bg-white p-4">
                  <p className="text-sm font-bold text-slate-950">Safety boundary</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Do not start supplements or treatment based only on this sample report.
                  </p>
                </div>
              </div>
            </div>
          </motion.article>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 pb-12 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {SUMMARY_SIGNALS.map(({ title, value, body, icon: Icon, tone }, index) => (
              <motion.article key={title} {...fadeUp(index * 0.04)} className={`rounded-lg border p-5 shadow-sm ${tone}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/80">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase">{title}</p>
                    <h3 className="mt-2 text-lg font-black leading-6 text-slate-950">{value}</h3>
                    <p className="mt-2 text-sm leading-6">{body}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1240px] gap-5 px-4 pb-12 sm:px-6 lg:grid-cols-[1fr_0.82fr]">
          <motion.div {...fadeUp()} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FlaskConical className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase text-emerald-700">Top findings</p>
                <h2 className="text-2xl font-black text-slate-950">What was outside the lab reference range</h2>
              </div>
            </div>

            <div className="grid gap-4">
              {FINDINGS.map((finding) => (
                <article key={finding.marker} className="rounded-lg border border-sky-100 bg-sky-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">{finding.marker}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        <span className="font-bold text-slate-950">{finding.value}</span> · reference {finding.range}
                      </p>
                    </div>
                    <StatusPill tone="rose">{finding.status}</StatusPill>
                  </div>
                  <MarkerRange position={finding.position} />
                  <p className="mt-4 text-sm font-bold text-sky-800">{finding.delta}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{finding.summary}</p>
                </article>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.05)} className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-amber-700">
                <Info className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase text-amber-800">Missing evidence</p>
                <h2 className="text-2xl font-black text-slate-950">What would make the conclusion stronger</h2>
              </div>
            </div>
            <ul className="mt-5 space-y-3">
              {EVIDENCE_GAPS.map((gap) => (
                <li key={gap} className="flex gap-3 rounded-lg border border-amber-200 bg-white/80 p-3 text-sm leading-6 text-slate-700">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </section>

        <section className="border-y border-slate-200 bg-white py-12">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <motion.div {...fadeUp()} className="max-w-3xl">
              <p className="text-xs font-bold uppercase text-emerald-700">Action plan</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">The report turns uncertainty into the next useful step.</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                VITALOOP does not pretend the answer is stronger than the data. It separates immediate caution, this-week preparation, and retest timing.
              </p>
            </motion.div>

            <div className="mt-7 grid gap-4 lg:grid-cols-3">
              {ACTIONS.map(({ label, title, body }, index) => (
                <motion.article key={label} {...fadeUp(index * 0.04)} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <StatusPill tone={index === 0 ? 'emerald' : index === 1 ? 'amber' : 'slate'}>{label}</StatusPill>
                  <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1240px] gap-5 px-4 py-12 sm:px-6 lg:grid-cols-[0.78fr_1.22fr]">
          <motion.div {...fadeUp()} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <h2 className="text-2xl font-black text-slate-950">Questions for your doctor</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {DOCTOR_QUESTIONS.map((question) => (
                <p key={question} className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {question}
                </p>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.05)} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase text-emerald-700">Biomarker details</p>
                <h2 className="text-2xl font-black text-slate-950">Full table stays available when you need the numbers</h2>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Marker</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {BIOMARKER_TABLE.map(([marker, value, range, status]) => (
                    <tr key={`${marker}-${value}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{marker}</td>
                      <td className="px-4 py-3 text-slate-700">{value}</td>
                      <td className="px-4 py-3 text-slate-500">{range}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={status === 'In range' ? 'emerald' : 'rose'}>{status}</StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 pb-12 sm:px-6">
          <motion.div {...fadeUp()} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <HeartPulse className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase text-emerald-700">How VITALOOP reached this view</p>
                  <h2 className="text-2xl font-black text-slate-950">Signals, gaps, safety checks, and Knowledge Base rules are kept visible.</h2>
                </div>
              </div>
              <StatusPill tone="amber">Approved with caution</StatusPill>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              {[
                { title: 'Extraction quality', body: 'Values, units, ranges and source rows are structured before interpretation.', icon: FileText },
                { title: 'Knowledge match', body: 'Rules can explain a possible pattern only when required context is available.', icon: Sparkles },
                { title: 'Safety boundary', body: 'The report avoids diagnosis-like language and treatment claims.', icon: ShieldCheck },
                { title: 'Retest logic', body: 'Timing is conservative and depends on context rather than a fixed promise.', icon: CalendarClock },
              ].map(({ title, body, icon: Icon }) => (
                <article key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Icon className="h-5 w-5 text-emerald-700" />
                  <h3 className="mt-3 font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </article>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="bg-slate-950 py-12 text-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <motion.div {...fadeUp()} className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase text-emerald-300">Real cabinet proof</p>
                <h2 className="mt-3 text-3xl font-black">The example connects to the actual cabinet workflow.</h2>
                <p className="mt-3 text-base leading-7 text-slate-300">
                  Screens below use the same product direction as the live cabinet: upload, results, history, actions and progress loops.
                </p>
              </div>
              <div className="grid gap-4">
                {CABINET_SCREENS.map((screen) => (
                  <article key={screen.title} className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.06] p-3 sm:grid-cols-[220px_1fr] sm:items-center">
                    <img
                      src={screen.image}
                      alt={screen.alt}
                      width="1110"
                      height="700"
                      className="aspect-[16/10] w-full rounded-lg border border-white/10 object-cover object-top"
                      loading="lazy"
                    />
                    <div className="p-2">
                      <h3 className="text-lg font-black">{screen.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{screen.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6">
          <div className="grid gap-5 rounded-lg border border-emerald-200 bg-emerald-50 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase text-emerald-700">Ready for the next step?</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">Upload your own report and get a structured health workspace.</h2>
              <p className="mt-2 text-base leading-7 text-slate-700">
                Start with one file. VITALOOP will show what was extracted, what needs context, and what is useful to discuss.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/login?signup=true')}
                className="inline-flex min-h-12 items-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/how-it-works')}
                className="inline-flex min-h-12 items-center rounded-lg border border-emerald-200 bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:border-emerald-400"
              >
                How it works
                <Stethoscope className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            VITALOOP is an educational wellness product. It does not diagnose, treat, or replace medical care.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
