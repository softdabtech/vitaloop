import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, ChartNoAxesCombined, CheckCircle2, ShieldCheck, Users, Workflow } from 'lucide-react'
import Seo from '../components/Seo.jsx'

const TRACTION_METRICS = [
  { value: '85+', label: 'Biomarkers normalized per upload' },
  { value: '<60s', label: 'Upload to first protocol draft' },
  { value: '3', label: 'Monetization layers (Free, Pro, Enterprise)' },
  { value: 'Weekly', label: 'Retention loop via check-ins' },
]

const TEAM = [
  {
    name: 'Product and Platform',
    role: 'Founding team',
    detail: 'Owns product direction, onboarding funnel, and care-loop experience end to end.',
    linkedin: 'https://www.linkedin.com/company/softdab/',
  },
  {
    name: 'AI and Data Infrastructure',
    role: 'Founding team',
    detail: 'Builds OCR, biomarker normalization, and protocol generation infrastructure.',
    linkedin: 'https://www.linkedin.com/company/softdab/',
  },
  {
    name: 'Clinical Workflow Design',
    role: 'Advisory network',
    detail: 'Shapes practitioner-facing workflows and risk-review structure for enterprise usage.',
    linkedin: 'https://www.linkedin.com/company/softdab/',
  },
]

const ENTERPRISE_FLOW = [
  {
    title: 'Intake and normalization',
    body: 'Lab reports are uploaded and normalized across units and ranges before review begins.',
  },
  {
    title: 'Triage and assignment',
    body: 'Practitioner dashboard highlights highest-risk clients and creates ranked action queues.',
  },
  {
    title: 'Protocol and follow-up',
    body: 'Teams run protocols, monitor adherence, and adapt plans on each check-in cycle.',
  },
]

const COMPETITOR_ROWS = [
  {
    name: 'LabCorp / MyChart',
    focus: 'Record delivery',
    gap: 'No adaptive protocol engine, no weekly adherence loop.',
    edge: 'VITALOOP turns records into a living action system.',
  },
  {
    name: 'Everlywell',
    focus: 'Consumer test distribution',
    gap: 'Limited longitudinal decision support after report delivery.',
    edge: 'VITALOOP keeps decision context active between tests.',
  },
  {
    name: 'Levels',
    focus: 'Single-domain tracking',
    gap: 'Narrow biomarker scope relative to full lab interpretation workflows.',
    edge: 'VITALOOP covers multi-system lab signals in one cockpit.',
  },
  {
    name: 'Function Health',
    focus: 'Premium diagnostics access',
    gap: 'Interpretation and execution depth for weekly workflow is less explicit.',
    edge: 'VITALOOP emphasizes execution loops and practitioner operations.',
  },
  {
    name: 'General LLM chat tools',
    focus: 'Generic reasoning',
    gap: 'No trusted longitudinal memory, no workflow primitives for care teams.',
    edge: 'VITALOOP is workflow software plus AI, not prompts alone.',
  },
]

export default function ForInvestors() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#09101d] text-white">
      <Seo
        title="For Investors | VITALOOP"
        description="Investor overview of VITALOOP: founding team, traction signals, enterprise narrative, and competitive positioning."
        path="/for-investors"
      />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_6%,rgba(16,185,129,0.2),transparent_34%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.12),transparent_32%)]" />
      </div>

      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to landing
        </button>
      </div>

      <section className="mx-auto grid max-w-[1240px] gap-8 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            For Investors
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-5 text-5xl font-bold tracking-[-0.03em] text-white md:text-6xl">
            AI infrastructure for longitudinal lab intelligence
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            VITALOOP is building the execution layer between lab data and repeated health outcomes. The product blends consumer habit loops with practitioner operations, creating a wedge from individual self-optimization into clinic workflows.
          </motion.p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => navigate('/login?signup=true')} className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
              Open product
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <a href="mailto:info@softdab.tech?subject=VITALOOP%20Investor%20Deck" className="inline-flex items-center rounded-2xl border border-slate-700 bg-slate-950/75 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/50">
              Request investor deck
            </a>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-[30px] border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Traction signals</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {TRACTION_METRICS.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="text-2xl font-bold tracking-tight text-white">{item.value}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="rounded-[30px] border border-slate-800 bg-slate-950/55 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Users className="h-5 w-5 text-emerald-300" />
            <h2 className="text-3xl font-bold text-white">Built by a product and infrastructure team</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-300">
            The founding team came from shipping production software in regulated and data-heavy environments. VITALOOP is intentionally designed as execution software first, not as a content-only AI layer.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {TEAM.map((member) => (
              <article key={member.name} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="text-lg font-semibold text-white">{member.name}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-emerald-300">{member.role}</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{member.detail}</p>
                <a href={member.linkedin} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300 hover:text-emerald-200">
                  LinkedIn
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="rounded-[30px] border border-slate-800 bg-slate-950/55 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Workflow className="h-5 w-5 text-emerald-300" />
            <h2 className="text-3xl font-bold text-white">Enterprise wedge: practitioner operating system</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-300">
            Enterprise demand is driven by workflow pain: fragmented client data, no triage order, and no adherence visibility between visits. VITALOOP addresses this as a workflow product, not as a static reporting layer.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {ENTERPRISE_FLOW.map((step, idx) => (
              <article key={step.title} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-xs font-semibold text-emerald-300">
                  0{idx + 1}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{step.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/65 p-4 text-sm leading-7 text-slate-300">
            Case study snapshot: one practitioner can review client priorities faster because labs, assignment context, and adherence state are visible in one queue instead of across disconnected tools.
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 pb-20 sm:px-6">
        <div className="rounded-[30px] border border-slate-800 bg-slate-950/55 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-emerald-300" />
            <h2 className="text-3xl font-bold text-white">Competitive positioning</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-300">
            The market has diagnostics providers, record portals, and generic AI assistants. VITALOOP is positioned as a longitudinal decision system with workflow primitives for both users and practitioners.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <th className="px-3 py-3">Competitor</th>
                  <th className="px-3 py-3">Primary focus</th>
                  <th className="px-3 py-3">Gap</th>
                  <th className="px-3 py-3">VITALOOP edge</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_ROWS.map((row) => (
                  <tr key={row.name} className="border-b border-slate-800/80 align-top">
                    <td className="px-3 py-4 font-semibold text-white">{row.name}</td>
                    <td className="px-3 py-4 text-slate-300">{row.focus}</td>
                    <td className="px-3 py-4 text-slate-300">{row.gap}</td>
                    <td className="px-3 py-4 text-emerald-300">{row.edge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="mailto:info@softdab.tech?subject=VITALOOP%20Investor%20Call" className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
              Book investor call
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <button onClick={() => navigate('/')} className="inline-flex items-center rounded-2xl border border-slate-700 bg-slate-950/75 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/50">
              Back to landing
            </button>
          </div>
          <div className="mt-6 flex items-start gap-2 rounded-2xl border border-slate-800 bg-slate-900/65 p-4 text-sm text-slate-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            Competitive positioning is updated as workflows and enterprise design-partners evolve.
          </div>
        </div>
      </section>
    </div>
  )
}
