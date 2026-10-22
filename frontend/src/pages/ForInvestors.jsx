import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, CheckCircle2, Handshake, Landmark, Network, ShieldCheck, Users, Workflow, Zap, DollarSign } from 'lucide-react'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'

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
    detail: 'Builds AI analysis, biomarker normalization, and protocol generation infrastructure.',
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

const ROUND_SNAPSHOT = [
  { value: '$100K', label: 'received from Arbok', detail: 'September 2026' },
  { value: '$200K', label: 'open allocation', detail: 'Current investor opportunity' },
  { value: '$300K', label: 'target round', detail: 'Capital to reach the next operating milestone' },
]

const TECHNOLOGY_ADVANTAGES = [
  {
    icon: Network,
    title: 'Normalized lab intelligence',
    body: 'A production workflow that reconciles heterogeneous reports, units, reference ranges, and dates into a longitudinal record that can be reviewed and reused.',
  },
  {
    icon: Workflow,
    title: 'Reasoning that becomes execution',
    body: 'The product connects symptom context, priorities, clinician-discussion prompts, protocol actions, retest timing, and weekly follow-through instead of stopping at a static report.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy-aware operating model',
    body: 'The platform separates health intelligence from billing flows and is designed around explicit product boundaries, review states, and safe user communication.',
  },
]

const PARTNERSHIP_PATHWAYS = [
  { title: 'Laboratories', body: 'Make lab outputs more understandable and actionable after the result is delivered.' },
  { title: 'Clinics', body: 'Give care teams a structured view of history, priorities, and follow-through between visits.' },
  { title: 'Nutritionists & practitioners', body: 'Turn fragmented client material into a repeatable workflow for review, plans, and check-ins.' },
]

const GROWTH_STRATEGY = [
  { phase: 'Product depth', timeline: 'Now', focus: 'Strengthen normalization, reasoning quality, and the repeatable consumer care loop.' },
  { phase: 'Design partners', timeline: 'Next', focus: 'Co-design workflows with laboratories, clinics, and practitioner teams that need better longitudinal context.' },
  { phase: 'Repeatable distribution', timeline: 'Then', focus: 'Turn validated partner workflows into a scalable consumer and professional go-to-market motion.' },
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
        title="Investor Overview | VITALOOP Clinical Reasoning Platform"
        description="Investor overview of VITALOOP: clinical reasoning for symptom-first health workflows, lab intelligence, and practitioner operations."
        path="/for-investors"
        schemas={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'VITALOOP',
            url: 'https://vitaloop.today',
            logo: 'https://vitaloop.today/og-cover-2026-05.jpg',
            description:
              'VITALOOP is a clinical reasoning platform that connects symptom intake, lab interpretation, and longitudinal protocol execution.',
            sameAs: [
              'https://www.instagram.com/vitaloop_today/',
              'https://www.linkedin.com/company/vitaloop-today',
              'https://www.facebook.com/vitaloop.today',
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
            The intelligence layer for longitudinal lab care
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            VITALOOP turns scattered symptom context and lab reports into an explainable, repeatable workflow for people and the professionals who support them. We are building the infrastructure that keeps health decisions useful after the result arrives.
          </motion.p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="mailto:info@softdab.tech?subject=VITALOOP%20Investor%20Introduction" className="vtl-public-button vtl-public-button--primary">
              Start an investor conversation
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a href="mailto:info@softdab.tech?subject=VITALOOP%20Investor%20Deck" className="vtl-public-button vtl-public-button--secondary">
              Request investor deck
            </a>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-[var(--vtl-radius-panel)] border border-[color:var(--vtl-color-border)] bg-[color:var(--vtl-color-canvas)] p-5 shadow-[var(--vtl-shadow-card)]">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-[color:var(--vtl-color-brand-700)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--vtl-color-brand-700)]">Current round</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {ROUND_SNAPSHOT.map((item) => (
              <div key={item.label} className="rounded-[var(--vtl-radius-card)] border border-[color:var(--vtl-color-border)] bg-[color:var(--vtl-color-surface)] p-4">
                <div className="text-2xl font-bold tracking-tight text-[color:var(--vtl-color-ink)]">{item.value}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--vtl-color-ink-secondary)]">{item.label}</div>
                <div className="mt-2 text-xs leading-5 text-[color:var(--vtl-color-text-muted)]">{item.detail}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-[color:var(--vtl-color-ink-secondary)]">
            We welcome investors who can help shape a durable, partnership-led health infrastructure company—not just finance the next release.
          </p>
          <p className="mt-4 text-xs leading-5 text-[color:var(--vtl-color-text-muted)]">
            VITALOOP’s operating entity is registered in Cyprus.
          </p>
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
            <Network className="h-5 w-5 text-emerald-600" />
            <h2 className="text-3xl font-bold text-slate-900">Why the technology compounds</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            VITALOOP is not a generic chat interface layered on top of a PDF. Its internal workflow turns fragmented input into reusable structured context, then keeps that context active across review, planning, retesting, and follow-through.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {TECHNOLOGY_ADVANTAGES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-3xl border border-slate-200 bg-white p-5">
                <Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Handshake className="h-5 w-5 text-emerald-600" />
            <h2 className="text-3xl font-bold text-slate-900">A partnership-led distribution strategy</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            We are building alongside the organizations that already sit close to lab data and health decisions. The goal is a useful shared workflow, not a standalone dashboard that creates another destination for users to manage.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PARTNERSHIP_PATHWAYS.map((item) => (
              <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Zap className="h-5 w-5 text-emerald-600" />
            <h2 className="text-3xl font-bold text-slate-900">A disciplined path from product to platform</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            We are sequencing product depth, design partnerships, and distribution deliberately. Each step gives the next one stronger evidence, a clearer workflow, and a more durable commercial foundation.
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
            <h2 className="text-3xl font-bold text-slate-900">Completing a $300K round with the right partners</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            With $100K received from Arbok in September, VITALOOP is opening a $200K allocation to complete a $300K round. We are looking for investors who bring conviction in health infrastructure and can open durable partnership paths.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm uppercase tracking-[0.16em] text-emerald-600 font-semibold">Capital allocation</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Product & engineering:</strong> strengthen the reasoning workflow, report coverage, and professional tools.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Partnership development:</strong> build repeatable pilots with laboratories, clinics, and practitioner teams.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Clinical workflow quality:</strong> deepen practitioner co-design and safety-aware product review.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Operations:</strong> maintain the reliable, privacy-aware infrastructure required to scale responsibly.</span>
                </li>
              </ul>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm uppercase tracking-[0.16em] text-emerald-600 font-semibold">What this unlocks</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>A stronger longitudinal reasoning and execution layer for users and professionals.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>Structured partner pilots with laboratories, clinics, and nutrition professionals.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>Evidence for a repeatable partnership and distribution motion.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>A clearer foundation for the next institutional funding conversation.</span>
                </li>
              </ul>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="text-sm uppercase tracking-[0.16em] text-emerald-600 font-semibold">Investor collaboration</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Health infrastructure expertise:</strong> perspective on building trustworthy, durable product systems.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Commercial access:</strong> introductions to potential laboratory, clinical, and professional partners.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Long-term alignment:</strong> support for a focused path to a larger institutional round.</span>
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
              <caption className="sr-only">VITALOOP investment and business metrics</caption>
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
            <a href="mailto:info@softdab.tech?subject=VITALOOP%20Investor%20Call" className="vtl-public-button vtl-public-button--primary">
              Book investor call
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <button onClick={() => navigate('/')} className="vtl-public-button vtl-public-button--secondary">
              Back to landing
            </button>
          </div>
          <div className="mt-6 flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Competitive positioning is updated as workflows and enterprise design-partners evolve.
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto w-full max-w-[1240px] px-4 py-2 pb-12 sm:px-6 md:py-4">
        <div className="rounded-3xl border border-slate-200 bg-white/85 p-6 backdrop-blur md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">About</p>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Why VITALOOP exists</span>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
            <p className="text-sm leading-relaxed text-slate-700">
              VITALOOP turns scattered symptoms and lab data into a structured health operating system: upload, prioritize biomarkers, run a protocol, and adapt weekly.
              {' '}
              <a
                href="https://www.linkedin.com/in/aleksey-bombela/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-700 hover:text-emerald-600"
              >
                Meet the founder
              </a>
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Lab compatibility</div>
                <div className="mt-1 text-sm font-semibold">Quest, LabCorp, and 50+ report formats</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Launch & stack</div>
                <div className="mt-1 text-sm font-semibold">May 2026 launch · FastAPI + Advanced AI + Supabase</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Founder contact</div>
                <a href="mailto:bombela@softdab.tech" className="mt-1 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-600">
                  bombela@softdab.tech
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
