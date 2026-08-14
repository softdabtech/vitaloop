import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  HeartPulse,
  Info,
  LineChart,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'

const REPORT_NUMBERS = [
  {
    value: '01',
    label: 'Clear summary',
    note: 'The report will start with a plain-language explanation of what appears most important.',
  },
  {
    value: '02',
    label: 'Priority markers',
    note: 'VITALOOP will separate stable values from markers that deserve review or more context.',
  },
  {
    value: '03',
    label: 'Evidence gaps',
    note: 'The system will show what is missing before a stronger interpretation can be made.',
  },
  {
    value: '04',
    label: 'Next steps',
    note: 'The user will receive a practical plan for discussion, follow-up and retesting.',
  },
]

const REPORT_BLOCKS = [
  {
    number: '01',
    title: 'Health summary',
    icon: HeartPulse,
    willShow: 'A calm, plain-language overview of the main health pattern suggested by the uploaded labs, symptoms and profile context.',
    functionalValue: 'This block will translate medical fragments into a human summary: what may be relevant, how confident the system is, and why the conclusion should remain educational.',
    userBenefit: 'A parent, patient or practitioner can understand the report direction before reading individual biomarkers.',
    checklist: [
      'Main pattern in everyday language',
      'Confidence boundary',
      'Non-diagnostic safety wording',
      'What information shaped the summary',
    ],
  },
  {
    number: '02',
    title: 'Report quality',
    icon: ShieldCheck,
    willShow: 'A readiness signal that explains whether the input is strong enough for interpretation or still needs confirmation.',
    functionalValue: 'The platform will evaluate extraction quality, recognized units, reference ranges, profile completeness and whether pediatric, pregnancy or safety context is needed.',
    userBenefit: 'The user sees when VITALOOP is confident and when the report should be treated as preliminary.',
    checklist: [
      'File extraction confidence',
      'Unit and reference-range quality',
      'Profile completeness',
      'Confirmation required when quality is limited',
    ],
  },
  {
    number: '03',
    title: 'Key priorities',
    icon: Sparkles,
    willShow: 'A short list of the most meaningful areas to review first, grouped by health domain rather than shown as isolated numbers.',
    functionalValue: 'Instead of making the user scan a long table, VITALOOP will group findings into domains such as iron status, inflammation, metabolic health, liver, kidney, thyroid, vitamin status or lipid profile when supported by data.',
    userBenefit: 'The report becomes a map of priorities, not a wall of lab values.',
    checklist: [
      'Top domains for review',
      'Stable domains',
      'Context-required domains',
      'Reason each priority appears',
    ],
  },
  {
    number: '04',
    title: 'Biomarker status cards',
    icon: FlaskConical,
    willShow: 'Individual biomarker cards with value, unit, lab reference range, status and a short explanation of what the marker is commonly used for.',
    functionalValue: 'Each marker will be normalized and displayed consistently so the user can compare values across files and time without losing the original lab reference.',
    userBenefit: 'The user understands which values are within range, outside range, near a boundary or not interpretable without context.',
    checklist: [
      'Marker name and normalized label',
      'Value, unit and lab reference',
      'Status badge',
      'Short “why it matters” explanation',
    ],
  },
  {
    number: '05',
    title: 'Range position and trend',
    icon: LineChart,
    willShow: 'A visual position inside or outside the reference interval and, when past results exist, a trend line over time.',
    functionalValue: 'VITALOOP will distinguish a one-time value from a repeated trend. One result becomes a baseline; multiple comparable results become a trend.',
    userBenefit: 'The user can see whether a marker is moving toward stability, worsening, fluctuating or simply needs more data.',
    checklist: [
      'Reference-position bar',
      'Baseline vs trend distinction',
      'Retest comparison when available',
      'No fake trend without enough data',
    ],
  },
  {
    number: '06',
    title: 'Symptom connection',
    icon: Activity,
    willShow: 'Possible relationships between reported symptoms and relevant biomarker patterns, with careful confidence language.',
    functionalValue: 'Symptoms such as fatigue, poor sleep, low energy, brain fog, hair changes, digestion issues or recovery problems will be compared with lab context and knowledge-base rules.',
    userBenefit: 'The report explains why a marker may matter personally rather than only biologically.',
    checklist: [
      'Reported symptoms',
      'Possible biomarker links',
      'Confidence level',
      'Missing context that could change the interpretation',
    ],
  },
  {
    number: '07',
    title: 'Missing evidence',
    icon: Info,
    willShow: 'A direct list of markers, profile fields or clinical context that would make the interpretation more reliable.',
    functionalValue: 'The system will say “not enough information yet” when the data is incomplete, instead of filling gaps with generic AI language.',
    userBenefit: 'Uncertainty becomes useful: the user knows what to check, upload or discuss next.',
    checklist: [
      'Missing biomarkers',
      'Missing anthropometrics or age/sex context',
      'Signals that need repeat testing',
      'Why each gap matters',
    ],
  },
  {
    number: '08',
    title: 'Safety boundary',
    icon: ShieldCheck,
    willShow: 'A safety section that flags when values, profile context or recommendations require extra caution.',
    functionalValue: 'VITALOOP will avoid diagnosis-like wording and will not frame supplements, nutrition changes or follow-up as treatment. Pediatric, pregnancy and high-risk contexts will be handled conservatively.',
    userBenefit: 'The user gets guidance that is practical but not overconfident or unsafe.',
    checklist: [
      'Doctor-discussion required flag',
      'Pediatric or pregnancy caution',
      'Supplement safety wording',
      'Blocked or softened claims when needed',
    ],
  },
  {
    number: '09',
    title: 'Nutrition and lifestyle context',
    icon: ClipboardList,
    willShow: 'Educational nutrition and lifestyle context related to the patterns found, written as discussion guidance rather than prescription.',
    functionalValue: 'The report will connect markers with food patterns, recovery, sleep, hydration, training load and supplement discussion points where supported by rules and safety checks.',
    userBenefit: 'The user sees practical levers to review without receiving unsafe dosage claims or one-size-fits-all advice.',
    checklist: [
      'Food-pattern context',
      'Sleep and recovery relevance',
      'Supplement discussion prompts',
      'What should be personalized before acting',
    ],
  },
  {
    number: '10',
    title: 'Next best step',
    icon: ArrowRight,
    willShow: 'One primary recommended next step that is realistic for the user’s current data quality and health context.',
    functionalValue: 'Instead of presenting ten equal actions, VITALOOP will choose the most useful next step: confirm data, complete profile, discuss with a clinician, upload missing labs, start check-ins or review a protocol.',
    userBenefit: 'The user knows what to do first and why it matters.',
    checklist: [
      'Primary next action',
      'Estimated effort',
      'Reason this action comes first',
      'Fallback action when data is incomplete',
    ],
  },
  {
    number: '11',
    title: 'Doctor questions',
    icon: MessageSquareText,
    willShow: 'A short list of practical questions to take to a clinician, generated from flagged markers, missing evidence and safety context.',
    functionalValue: 'The system will turn a confusing report into a structured conversation plan without telling the user what diagnosis to expect.',
    userBenefit: 'Appointments become more focused, especially for parents, busy adults and users with several disconnected lab results.',
    checklist: [
      'Questions for abnormal markers',
      'Questions for missing context',
      'Questions for retest timing',
      'Plain-language phrasing',
    ],
  },
  {
    number: '12',
    title: 'Retest plan',
    icon: CalendarClock,
    willShow: 'A conservative retest suggestion when the data supports follow-up, including what to monitor again and when.',
    functionalValue: 'VITALOOP will distinguish markers that need trend tracking from markers that only need historical storage.',
    userBenefit: 'The user understands when repeated testing can add value and when it would be premature.',
    checklist: [
      'Markers to recheck',
      'Suggested window when supported',
      'Reason for retest',
      'Trend baseline status',
    ],
  },
  {
    number: '13',
    title: 'Full biomarker table',
    icon: FileText,
    willShow: 'The complete structured table of recognized biomarkers, including values, units, reference ranges, status and source context.',
    functionalValue: 'The full table remains available for transparency, export and clinician review, but it will not dominate the first screen.',
    userBenefit: 'The user gets both a readable summary and the underlying data.',
    checklist: [
      'All extracted markers',
      'Original units and normalized labels',
      'Reference ranges',
      'Source and confidence where available',
    ],
  },
  {
    number: '14',
    title: 'Evidence and explainability',
    icon: Sparkles,
    willShow: 'A transparent explanation of what VITALOOP used to reach the report: extracted data, profile, symptoms, knowledge-base matches and safety checks.',
    functionalValue: 'This block will make the report auditable and reproducible, including versioned logic where available.',
    userBenefit: 'The user can see that the report is not a black-box paragraph.',
    checklist: [
      'Knowledge-base signals',
      'Rules or domains matched',
      'Confidence drivers',
      'Safety and missing-context notes',
    ],
  },
  {
    number: '15',
    title: 'Exportable report',
    icon: Download,
    willShow: 'A structured PDF-style summary that can be saved or shared for a clinician conversation.',
    functionalValue: 'The export will preserve the useful hierarchy: summary, findings, missing context, action plan, questions, retest plan and biomarker table.',
    userBenefit: 'The user leaves with a clean, portable health document instead of screenshots.',
    checklist: [
      'Readable report format',
      'Clinician discussion summary',
      'Biomarker table',
      'Medical disclaimer',
    ],
  },
]

const AFTER_REPORT_FEATURES = [
  {
    title: 'Personal baseline',
    body: 'After the first upload, VITALOOP will store a baseline for future comparison. Later reports can show whether markers remain stable, move closer to a target range, or require review.',
    icon: BarChart3,
  },
  {
    title: 'Highlighted markers',
    body: 'The cabinet will highlight markers that are outside range, near a boundary, changing over time, connected to symptoms, or important for the user’s age, sex and profile context.',
    icon: FlaskConical,
  },
  {
    title: 'Wellbeing check-ins',
    body: 'Fatigue, sleep, energy, focus, digestion, mood, recovery and other self-reported signals will be tracked. These signals help interpret whether lab changes matter in daily life.',
    icon: Activity,
  },
  {
    title: 'Progress statistics',
    body: 'The user will see trend direction, completed actions, repeated symptoms, retest reminders and which priorities are improving, unchanged or waiting for more data.',
    icon: LineChart,
  },
  {
    title: 'Health loop updates',
    body: 'New labs, weekly check-ins and profile updates will feed the next report. The goal is a learning loop: symptoms, biomarkers, actions and retests in one place.',
    icon: HeartPulse,
  },
  {
    title: 'Family and age-aware context',
    body: 'For children or family profiles, age, sex, height, weight and growth context will be treated as required context before stronger interpretation is shown.',
    icon: ShieldCheck,
  },
]

const MARKER_GROUPS = [
  'Iron status',
  'Vitamin D and micronutrients',
  'Inflammation context',
  'Metabolic health',
  'Thyroid signals',
  'Liver and kidney context',
  'Lipids and cardiovascular context',
  'Blood count and recovery markers',
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

function ReportBlockCard({ block, index }) {
  const Icon = block.icon

  return (
    <motion.article {...fadeUp(index * 0.02)} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{block.number}</span>
      </div>

      <h3 className="mt-4 text-xl font-black text-slate-950">{block.title}</h3>
      <div className="mt-4 grid gap-3">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase text-slate-500">What it will show</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{block.willShow}</p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-[11px] font-black uppercase text-emerald-700">Functional meaning</p>
          <p className="mt-1 text-sm leading-6 text-emerald-950">{block.functionalValue}</p>
        </div>
        <div className="rounded-lg border border-sky-100 bg-sky-50 p-4">
          <p className="text-[11px] font-black uppercase text-sky-700">User value</p>
          <p className="mt-1 text-sm leading-6 text-sky-950">{block.userBenefit}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-black uppercase text-slate-500">Included checks</p>
        <div className="mt-3 grid gap-2">
          {block.checklist.map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm leading-5 text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.article>
  )
}

export default function ExampleReport() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f7fbfa] text-slate-900">
      <Seo
        title="Blood Test Report Structure | VITALOOP"
        description="Explore what each VITALOOP report block will show: health summary, biomarker priorities, missing evidence, symptom links, wellbeing tracking, retest planning, and next steps."
        path="/example-report"
        image="https://vitaloop.today/mockups/cabinet-live/results-clean.webp?v=20260814"
        imageAlt="VITALOOP health report structure and biomarker interpretation blocks"
      />

      <PageHeader />

      <main>
        <section className="border-b border-emerald-100 bg-[linear-gradient(180deg,#f1faf7_0%,#ffffff_72%,#f7fbfa_100%)]">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-14">
            <motion.div {...fadeUp()}>
              <StatusPill tone="emerald">Report structure</StatusPill>
              <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
                What a VITALOOP report will explain after your lab upload.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                This page is not a sample diagnosis. It describes the functional meaning of every report block: what the user will see, why the block matters, what data it uses, and how it helps turn lab results into a safer next step.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/login?signup=true')}
                  className="inline-flex min-h-12 items-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-700"
                >
                  Build your report
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
            </motion.div>

            <motion.div {...fadeUp(0.08)} className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-black uppercase text-emerald-700">Report blueprint</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">From raw file to useful health context</h2>
                </div>
                <FileText className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  ['1', 'Read and normalize biomarkers'],
                  ['2', 'Evaluate quality, profile and safety context'],
                  ['3', 'Group markers into health domains'],
                  ['4', 'Connect findings with symptoms and check-ins'],
                  ['5', 'Create next steps, doctor questions and retest plan'],
                ].map(([number, text]) => (
                  <div key={number} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">{number}</span>
                    <span className="text-sm font-bold text-slate-800">{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REPORT_NUMBERS.map((stat) => (
              <motion.article key={stat.label} {...fadeUp()} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-3xl font-black text-emerald-700">{stat.value}</p>
                <p className="mt-1 text-sm font-black text-slate-950">{stat.label}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{stat.note}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 pb-12 sm:px-6">
          <motion.div {...fadeUp()} className="mb-6 max-w-3xl">
            <p className="text-xs font-bold uppercase text-emerald-700">Report block checklist</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">Every block has a job</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              The report is designed to be read from top to bottom: first the meaning, then the evidence, then the safest next step. Numbers stay available, but they are no longer the whole experience.
            </p>
          </motion.div>

          <div className="grid gap-5 lg:grid-cols-2">
            {REPORT_BLOCKS.map((block, index) => (
              <ReportBlockCard key={block.title} block={block} index={index} />
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-12">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <motion.div {...fadeUp()} className="max-w-3xl">
              <p className="text-xs font-bold uppercase text-emerald-700">After the report</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">What the user continues to receive in the cabinet</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                The report is the beginning of the health loop. VITALOOP will continue to connect lab values, symptoms, wellbeing, actions and retests so the user can see whether the picture is changing.
              </p>
            </motion.div>

            <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {AFTER_REPORT_FEATURES.map(({ title, body, icon: Icon }, index) => (
                <motion.article key={title} {...fadeUp(index * 0.03)} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1240px] gap-5 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
          <motion.div {...fadeUp()} className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
            <p className="text-xs font-bold uppercase text-emerald-700">Marker highlighting</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">Which markers will be highlighted</h2>
            <p className="mt-3 text-base leading-7 text-emerald-950">
              VITALOOP will not highlight every number equally. It will emphasize markers that are outside range, near a boundary, repeated across uploads, connected to symptoms, missing important companion markers, or meaningful for a user’s age and profile.
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.05)} className="grid gap-3 sm:grid-cols-2">
            {MARKER_GROUPS.map((group) => (
              <div key={group} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span className="text-sm font-bold text-slate-800">{group}</span>
              </div>
            ))}
          </motion.div>
        </section>

        <section className="bg-slate-950 py-12 text-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <motion.div {...fadeUp()} className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase text-emerald-300">Wellbeing influence</p>
                <h2 className="mt-3 text-3xl font-black">Symptoms will change how the report is interpreted.</h2>
                <p className="mt-3 text-base leading-7 text-slate-300">
                  A lab value means more when it is connected with how the person feels. VITALOOP will use check-ins to compare symptoms and biomarkers over time, without turning correlation into diagnosis.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['Fatigue and energy', 'May help prioritize iron status, thyroid context, B12/folate context, inflammation or recovery-related domains when the lab data supports it.'],
                  ['Sleep quality', 'Will be tracked as a daily-life signal that may influence how recovery, stress and metabolic patterns are discussed.'],
                  ['Brain fog and focus', 'Can help frame discussion around micronutrients, glucose patterns, thyroid context or inflammation when supporting markers exist.'],
                  ['Digestion and nutrition', 'Will add context for nutrient patterns, supplementation discussion prompts and retest priorities.'],
                  ['Training and recovery', 'Can influence interpretation of inflammation, muscle-related markers and recovery timing.'],
                  ['Child or family profile', 'Age, sex, height, weight and growth context will be required before stronger pediatric interpretation is shown.'],
                ].map(([title, body]) => (
                  <article key={title} className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
                    <h3 className="font-black text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
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
              <h2 className="mt-2 text-3xl font-black text-slate-950">Upload labs and build your own structured report.</h2>
              <p className="mt-2 text-base leading-7 text-slate-700">
                VITALOOP will show what was recognized, what needs context, which markers deserve attention, and how your wellbeing changes the interpretation over time.
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
            VITALOOP is an educational wellness product. It does not diagnose, treat, prescribe, or replace medical care.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
