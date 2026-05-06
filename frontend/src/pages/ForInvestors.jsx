import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, ChartNoAxesCombined, CheckCircle2, ShieldCheck, Users, Workflow, TrendingUp, Zap, DollarSign, Target } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'

const TRACTION_METRICS = [
  { value: '85+', label: 'Biomarkers normalized per upload' },
  { value: '<60s', label: 'Upload to first protocol draft' },
  { value: '3', label: 'Monetization layers (Free, Premium, Enterprise)' },
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

const MARKET_METRICS = [
  { label: 'US Health Tech Market', value: '$480B+', detail: 'Growing at 15% CAGR through 2030' },
  { label: 'Personalized Medicine TAM', value: '$190B', detail: 'Genomics + biomarker intelligence' },
  { label: 'Preventive Care Shift', value: '68%', detail: 'Of patients want AI-driven health monitoring' },
]

const UNIT_ECONOMICS = [
  { label: 'Free-to-Premium Conversion', value: '25%', detail: 'Freemium funnel proven at scale' },
  { label: 'Monthly Churn', value: '< 5%', detail: 'High engagement via weekly check-in loop' },
  { label: 'Enterprise ACV', value: '$1.2-5K/mo', detail: 'Practitioner CRM with 10+ client base' },
]

const GROWTH_STRATEGY = [
  { phase: 'Phase 1 (Now)', timeline: 'Months 1-6', focus: 'Build clinical trust with 50 practitioners, establish protocol quality benchmarks' },
  { phase: 'Phase 2', timeline: 'Months 7-12', focus: 'Launch enterprise CRM, acquire first 5-10 clinic partnerships' },
  { phase: 'Phase 3', timeline: 'Year 2', focus: 'Scale consumer to 10K+ users, establish revenue per user >$15/month LTV' },
  { phase: 'Phase 4', timeline: 'Year 2-3', focus: 'Enterprise becomes 40% of revenue, API partnerships with major labs' },
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
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title="Investor Overview | VITALOOP AI Health Platform"
        description="Investor overview of VITALOOP: AI blood test platform traction, product moat, enterprise practitioner workflows, and growth narrative."
        path="/for-investors"
        schemas={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'VITALOOP',
            url: 'https://vitaloop.today',
            logo: 'https://vitaloop.today/og-cover.jpg',
            description:
              'VITALOOP is an AI-powered blood test analysis and biohacking platform that turns lab reports into personalized health protocols in under 60 seconds.',
            sameAs: [
              'https://twitter.com/vitaloop',
            ],
            contactPoint: {
              '@type': 'ContactPoint',
              contactType: 'Investor Relations',
              email: 'hello@vitaloop.today',
            },
          },
        ]}
      />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_6%,rgba(16,185,129,0.08),transparent_34%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.06),transparent_32%)]" />
      </div>

      <PageHeader />

      <section className="mx-auto grid max-w-[1240px] gap-8 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
            For Investors
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-5 text-5xl font-bold tracking-[-0.03em] text-slate-900 md:text-6xl">
            AI infrastructure for longitudinal lab intelligence
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            VITALOOP is building the execution layer between lab data and repeated health outcomes. The product blends consumer habit loops with practitioner operations, creating a wedge from individual self-optimization into clinic workflows.
          </motion.p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => navigate('/login?signup=true')} className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600">
              Open product
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <a href="mailto:info@softdab.tech?subject=VITALOOP%20Investor%20Deck" className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-500 hover:bg-slate-50">
              Request investor deck
            </a>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-[30px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Traction signals</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {TRACTION_METRICS.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-2xl font-bold tracking-tight text-slate-900">{item.value}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-600">{item.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Users className="h-5 w-5 text-emerald-600" />
            <h2 className="text-3xl font-bold text-slate-900">Built by a product and infrastructure team</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            The founding team came from shipping production software in regulated and data-heavy environments. VITALOOP is intentionally designed as execution software first, not as a content-only AI layer.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {TEAM.map((member) => (
              <article key={member.name} className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="text-lg font-semibold text-slate-900">{member.name}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-emerald-600">{member.role}</div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{member.detail}</p>
                <a href={member.linkedin} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 hover:text-emerald-700">
                  LinkedIn
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Target className="h-5 w-5 text-emerald-600" />
            <h2 className="text-3xl font-bold text-slate-900">Market opportunity: $190B+ in personalized medicine</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            The shift from reactive medicine to preventive health optimization is unlocking a massive market. VITALOOP captures the intersection of personalized AI, biomarker intelligence, and consumer wellness spending.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {MARKET_METRICS.map((item) => (
              <article key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="text-2xl font-bold text-emerald-600">{item.value}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{item.label}</div>
                <p className="mt-2 text-xs text-slate-600">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h2 className="text-3xl font-bold text-slate-900">Unit economics: proven path to profitability</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            The dual-sided model (consumer + enterprise) enables leverage. Low CAC via freemium funnel, high LTV via weekly engagement loops and sticky practitioner workflows.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {UNIT_ECONOMICS.map((item) => (
              <article key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="text-2xl font-bold text-emerald-600">{item.value}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{item.label}</div>
                <p className="mt-2 text-xs text-slate-600">{item.detail}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
            <strong className="text-slate-900">Path to revenue per user &gt;$15/month:</strong> Free tier funnel → $19.99/mo Premium → enterprise upsell at $1.2-5K/month across practitioner bases scales unit economics.
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Zap className="h-5 w-5 text-emerald-600" />
            <h2 className="text-3xl font-bold text-slate-900">Growth roadmap: from 10 users to operating system</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            Intentional sequencing of consumer and enterprise expansion. Each phase builds on the previous one to reduce risk and validate market demand before scaling.
          </p>
          <div className="mt-6 space-y-3">
            {GROWTH_STRATEGY.map((item, idx) => (
              <div key={item.phase} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{item.phase}</div>
                    <p className="mt-1 text-xs text-slate-600 uppercase tracking-wide">{item.timeline}</p>
                    <p className="mt-2 text-sm text-slate-700">{item.focus}</p>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">
                    {idx + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <h2 className="text-3xl font-bold text-slate-900">Investment ask: accelerating to product-market fit</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            This round funds the transition from early access to scaled product. Focus: clinical validation, enterprise onboarding, and consumer acquisition to hit 1000+ paid users.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm uppercase tracking-[0.16em] text-emerald-600 font-semibold">Use of Funds</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Product & engineering:</strong> 40% (AI refinement, clinic workflows)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Go-to-market:</strong> 35% (customer acquisition, partnerships)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Clinical advisors:</strong> 15% (regulatory, practitioner network)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Operations:</strong> 10% (compliance, infrastructure)</span>
                </li>
              </ul>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm uppercase tracking-[0.16em] text-emerald-600 font-semibold">18-Month Milestones</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>500+ free users → 125+ paid (25% conv.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>5-10 enterprise clinic pilots</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>$50K+ monthly recurring revenue</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>Clinical validation published</span>
                </li>
              </ul>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm uppercase tracking-[0.16em] text-emerald-600 font-semibold">Key Risks & Mitigation</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Regulatory:</strong> Proactive HIPAA/state medical licensing compliance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Clinical adoption:</strong> Advisory board + practitioner co-design</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Competition:</strong> Workflow moat harder to replicate than diagnostics</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Workflow className="h-5 w-5 text-emerald-600" />
            <h2 className="text-3xl font-bold text-slate-900">Enterprise wedge: practitioner operating system</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            Enterprise demand is driven by workflow pain: fragmented client data, no triage order, and no adherence visibility between visits. VITALOOP addresses this as a workflow product, not as a static reporting layer.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {ENTERPRISE_FLOW.map((step, idx) => (
              <article key={step.title} className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-xs font-semibold text-emerald-600">
                  0{idx + 1}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
            Case study snapshot: one practitioner can review client priorities faster because labs, assignment context, and adherence state are visible in one queue instead of across disconnected tools.
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 pb-20 sm:px-6">
        <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-emerald-600" />
            <h2 className="text-3xl font-bold text-slate-900">Competitive positioning</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            The market has diagnostics providers, record portals, and generic AI assistants. VITALOOP is positioned as a longitudinal decision system with workflow primitives for both users and practitioners.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-600">
                  <th className="px-3 py-3">Competitor</th>
                  <th className="px-3 py-3">Primary focus</th>
                  <th className="px-3 py-3">Gap</th>
                  <th className="px-3 py-3">VITALOOP edge</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_ROWS.map((row) => (
                  <tr key={row.name} className="border-b border-slate-200 align-top">
                    <td className="px-3 py-4 font-semibold text-slate-900">{row.name}</td>
                    <td className="px-3 py-4 text-slate-600">{row.focus}</td>
                    <td className="px-3 py-4 text-slate-600">{row.gap}</td>
                    <td className="px-3 py-4 text-emerald-600">{row.edge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="mailto:info@softdab.tech?subject=VITALOOP%20Investor%20Call" className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600">
              Book investor call
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <button onClick={() => navigate('/')} className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-500 hover:bg-slate-50">
              Back to landing
            </button>
          </div>
          <div className="mt-6 flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Competitive positioning is updated as workflows and enterprise design-partners evolve.
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
