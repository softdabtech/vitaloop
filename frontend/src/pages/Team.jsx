import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileText,
  HeartPulse,
  Repeat2,
  ShieldCheck,
  Target,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/landing/Footer.jsx'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import Seo from '../components/Seo.jsx'
import TeamMemberCard from '../components/team/TeamMemberCard.jsx'
import { getTeamMembers, TEAM_CATEGORIES } from '../data/teamMembers.js'

const PAGE_DESCRIPTION = 'Meet the team building VITALOOP — a symptom-first health intelligence platform for longitudinal laboratory data interpretation.'

const HERO_FACTS = [
  'Founded to solve fragmented health data',
  'Health + Engineering + Product',
  'Backed by ARBOK',
]

const STORY_INPUTS = ['Symptoms', 'PDFs / lab files', 'Biomarkers', 'Historical tests']
const STORY_OUTPUTS = ['Structured health timeline', 'Educational interpretation', 'Action protocol', 'Progress tracking']
const PIPELINE = ['Extract', 'Normalize', 'Quality gate', 'Knowledge rules', 'Safety', 'Report', 'Protocol', 'Progress']

const CAPABILITIES = [
  {
    icon: HeartPulse,
    title: 'Symptom-first',
    text: 'Lab data is interpreted in the context of what the person is experiencing.',
  },
  {
    icon: Repeat2,
    title: 'Longitudinal',
    text: 'Results are connected across real test dates instead of treated as isolated files.',
  },
  {
    icon: ShieldCheck,
    title: 'Explainable',
    text: 'Reports and recommendations are generated through structured rules, quality controls and safety layers.',
  },
]

const HOW_WE_BUILD = [
  {
    title: 'Engineering',
    text: 'We build structured pipelines, quality gates and reliable health-data infrastructure.',
  },
  {
    title: 'Health expertise',
    text: 'Domain specialists help shape the knowledge, context and educational guidance behind the product.',
  },
  {
    title: 'Product',
    text: 'We turn complex health information into experiences people can actually understand and use.',
  },
]

const NEXT_DIRECTIONS = [
  {
    icon: BrainCircuit,
    title: 'Clinical intelligence',
    text: 'Expand structured health knowledge, rules and safety layers.',
  },
  {
    icon: Repeat2,
    title: 'Longitudinal health',
    text: 'Improve progress tracking across months and years of laboratory data.',
  },
  {
    icon: Target,
    title: 'Professional workflows',
    text: 'Build tools for nutritionists and health professionals working with multiple clients.',
  },
  {
    icon: FileText,
    title: 'B2B integrations',
    text: 'Develop infrastructure for laboratory and partner integrations.',
  },
]

function Eyebrow({ children }) {
  return <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">{children}</p>
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="max-w-3xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-[44px] lg:leading-[1.08]">{title}</h2>
      {description && <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">{description}</p>}
    </div>
  )
}

function TeamCategory({ category }) {
  const members = getTeamMembers(category)
  const meta = TEAM_CATEGORIES[category]

  return (
    <section aria-labelledby={`${category}-heading`} className="mt-12 first:mt-0 sm:mt-16">
      <div className="mb-6 border-b border-slate-200 pb-5">
        <h3 id={`${category}-heading`} className="text-2xl font-bold tracking-[-0.025em] text-slate-950">{meta.title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{meta.description}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {members.map((member) => <TeamMemberCard key={member.id} member={member} />)}
      </div>
    </section>
  )
}

export default function Team() {
  return (
    <>
      <Seo title="Team | VITALOOP" description={PAGE_DESCRIPTION} path="/team" imageAlt="The team building VITALOOP" />

      <div className="min-h-screen bg-white text-slate-950">
        <PageHeader />
        <main>
          <section className="border-b border-slate-100 bg-slate-50/70">
            <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
              <div className="max-w-4xl">
                <Eyebrow>The people behind VITALOOP</Eyebrow>
                <h1 className="mt-5 text-4xl font-bold tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">The team building VITALOOP</h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">
                  We’re building a symptom-first health intelligence platform that connects symptoms, laboratory data and biomarker history into a longitudinal view of health.
                </p>
                <p className="mt-3 text-base font-semibold leading-7 text-slate-700">
                  Built across product, engineering, health expertise and clinical intelligence.
                </p>
              </div>
              <ul className="mt-9 grid gap-3 sm:grid-cols-3" aria-label="VITALOOP facts">
                {HERO_FACTS.map((fact) => (
                  <li key={fact} className="flex items-center gap-3 border-t border-slate-200 pt-3 text-sm font-semibold text-slate-700">
                    <span className="h-2 w-2 flex-none rounded-full bg-emerald-500" aria-hidden="true" />
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
            <div>
              <SectionHeading eyebrow="Our story" title="Why we started VITALOOP" />
              <div className="mt-7 space-y-5 text-base leading-8 text-slate-600">
                <p>Lab results rarely exist in isolation. Symptoms change, biomarkers move over time, tests come from different laboratories, and important context is often lost between appointments and PDF files.</p>
                <p>VITALOOP started from the belief that health data becomes more useful when it is understood longitudinally — not as a single test, but as a timeline.</p>
                <p>We are building VITALOOP to connect symptoms, laboratory data and biomarker history into one structured health intelligence layer that helps people and professionals see what changed, when it changed and what may deserve attention.</p>
              </div>
            </div>

            <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:p-7">
              <div className="rounded-2xl bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">From</p>
                <ul className="mt-4 space-y-3">
                  {STORY_INPUTS.map((item) => <li key={item} className="text-sm font-semibold text-slate-700">{item}</li>)}
                </ul>
              </div>
              <div className="flex items-center justify-center py-1 text-emerald-600 sm:px-1" aria-hidden="true">
                <ArrowRight className="h-5 w-5 rotate-90 sm:rotate-0" />
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">To</p>
                <ul className="mt-4 space-y-3">
                  {STORY_OUTPUTS.map((item) => (
                    <li key={item} className="flex gap-2 text-sm font-semibold text-slate-800">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="border-y border-slate-100 bg-slate-50">
            <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24">
              <SectionHeading eyebrow="What we’re building" title="Health intelligence across time, not a single test" />
              <div className="mt-9 flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="VITALOOP health intelligence pipeline">
                {PIPELINE.map((stage, index) => (
                  <div key={stage} className="flex items-center gap-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm">
                      <span className="mr-2 text-xs text-emerald-700">{String(index + 1).padStart(2, '0')}</span>{stage}
                    </div>
                    {index < PIPELINE.length - 1 && <ArrowRight className="h-4 w-4 flex-none text-slate-400" aria-hidden="true" />}
                  </div>
                ))}
              </div>
              <p className="mt-7 max-w-4xl text-base leading-8 text-slate-600">Our clinical intelligence engine transforms fragmented laboratory data into a structured, explainable and date-accurate health timeline.</p>
              <div className="mt-10 grid gap-5 md:grid-cols-3">
                {CAPABILITIES.map(({ icon: Icon, title, text }) => (
                  <article key={title} className="border-t-2 border-emerald-500 bg-white p-6 shadow-sm">
                    <Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24">
            <SectionHeading
              eyebrow="The team"
              title="Built across product, engineering and health expertise"
              description="VITALOOP brings together software engineering, product design, quality engineering and nutrition expertise around one health intelligence platform."
            />
            <div className="mt-12 sm:mt-16">
              <TeamCategory category="leadership" />
              <TeamCategory category="engineering" />
              <TeamCategory category="health" />
            </div>
          </section>

          <section className="border-y border-emerald-100 bg-emerald-50/50">
            <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24">
              <SectionHeading eyebrow="How we build" title="Health expertise and engineering in the same loop" />
              <div className="mt-10 grid gap-8 md:grid-cols-3">
                {HOW_WE_BUILD.map((item, index) => (
                  <article key={item.title} className="border-l border-emerald-300 pl-5">
                    <p className="text-xs font-bold text-emerald-700">0{index + 1}</p>
                    <h3 className="mt-3 text-xl font-bold text-slate-950">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto grid max-w-[1240px] overflow-hidden rounded-[30px] border border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50/80 shadow-sm lg:grid-cols-[0.72fr_1.28fr]">
              <div className="flex flex-col justify-between border-b border-emerald-100 p-7 sm:p-10 lg:border-b-0 lg:border-r">
                <div>
                  <Eyebrow>Backed by ARBOK</Eyebrow>
                  <p className="mt-7 text-5xl font-bold tracking-[-0.055em] text-slate-950 sm:text-6xl">$100K</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">Initial investment</p>
                </div>
                <p className="mt-8 text-sm font-semibold text-emerald-800">2026</p>
              </div>
              <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                <div className="relative h-11 w-44 overflow-hidden" role="img" aria-label="ARBOK">
                  <img src="/images/arbok-logo.jpeg?v=20261007" alt="" className="absolute left-1/2 top-1/2 h-auto w-[356px] max-w-none -translate-x-1/2 -translate-y-1/2" loading="lazy" width="1344" height="768" />
                </div>
                <h2 className="mt-7 text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-3xl">External backing for the next stage</h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">VITALOOP has secured a $100,000 initial investment from ARBOK to accelerate product development, strengthen its health intelligence infrastructure and support early market validation.</p>
              </div>
            </div>
          </section>

          <section className="border-y border-slate-100 bg-slate-50">
            <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24">
              <SectionHeading
                eyebrow="What’s next"
                title="Building the next layer of health intelligence"
                description="Our next stage is focused on making VITALOOP more useful across longer health timelines, deeper biomarker context and professional workflows."
              />
              <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
                {NEXT_DIRECTIONS.map(({ icon: Icon, title, text }) => (
                  <article key={title}>
                    <div className="inline-flex rounded-xl bg-emerald-100 p-2.5 text-emerald-700"><Icon className="h-5 w-5" aria-hidden="true" /></div>
                    <h3 className="mt-4 text-lg font-bold text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24">
            <div className="border-l-4 border-emerald-500 pl-6 sm:flex sm:items-end sm:justify-between sm:gap-12 sm:pl-10">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">Build the next stage with us</h2>
                <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">We’re growing the team, expanding our health expertise and speaking with partners and investors who share our view of longitudinal health intelligence.</p>
              </div>
              <div className="mt-7 flex flex-col gap-3 sm:mt-0 sm:flex-row sm:flex-shrink-0">
                <Link to="/for-investors/" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                  For Investors <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/contact/" className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">Contact us</Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  )
}
