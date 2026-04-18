import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CirclePlay,
  Clock3,
  FileText,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Lock,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'
import { CabinetPreviewModal } from '../components/landing/Hero.jsx'

const NAV_LINKS = [
  { id: 'problem', label: 'Why it matters' },
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
    title: 'Built for weekly follow-through',
    body: 'Check-ins, assignments, and adherence loops keep your protocol alive after the first upload.',
    icon: Clock3,
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

const PREMIUM_FEATURES = [
  {
    title: 'Longitudinal Biomarker Engine',
    body: 'Every upload is normalized into one timeline, so ferritin, thyroid, hormones, inflammation, and metabolic markers can be compared across months instead of read as isolated reports.',
    detail: 'What you get: trend lines, directionality, abnormal persistence, and recovery detection.',
    icon: TrendingUp,
  },
  {
    title: 'Protocol Command Center',
    body: 'The platform converts lab patterns into a structured protocol with supplement priorities, nutrition changes, and execution tasks ranked by likely impact.',
    detail: 'What you get: concrete next steps instead of a PDF full of unexplained numbers.',
    icon: Sparkles,
  },
  {
    title: 'Weekly Adherence Loop',
    body: 'Check-ins continuously feed energy, sleep, mood, and compliance data back into your protocol so the system can distinguish low adherence from poor response.',
    detail: 'What you get: smarter adjustments between lab cycles, not just after them.',
    icon: HeartPulse,
  },
  {
    title: 'Practitioner-Ready Review Layer',
    body: 'Results are organized so a practitioner, coach, or care team can immediately see history, risk, assignments, and progress without reconstructing the case manually.',
    detail: 'What you get: collaboration-ready outputs when self-optimization is not enough.',
    icon: Stethoscope,
  },
]

const PLAN_DETAILS = {
  Free: {
    eyebrow: 'Validate the experience',
    description: 'For first-time users who want to upload one report, see the dashboard structure, and understand how VITALOOP turns raw biomarker values into usable context.',
    idealFor: 'Best for: trying your first blood test interpretation without commitment.',
  },
  'Personal Pro': {
    eyebrow: 'Most chosen plan',
    description: 'For users actively running a health protocol who need unlimited uploads, longitudinal tracking, weekly adaptation, and fast feedback between lab cycles.',
    idealFor: 'Best for: people serious about biohacking, recovery, hormone optimization, or deficiency correction.',
  },
  Enterprise: {
    eyebrow: 'Practitioner operations',
    description: 'For clinics, functional practitioners, and high-touch teams who need client oversight, workflow coordination, and shared execution visibility.',
    idealFor: 'Best for: scaling client management without losing biomarker context.',
  },
}

const HUB_GUIDES = [
  {
    title: 'How to read ferritin in context',
    body: 'Why ferritin without CRP, iron saturation, symptoms, and trend direction is often misleading.',
    icon: FileText,
  },
  {
    title: 'Building a repeatable retest loop',
    body: 'How to time uploads, check-ins, and protocol changes so progress is measurable rather than anecdotal.',
    icon: BrainCircuit,
  },
  {
    title: 'From biomarkers to action stack',
    body: 'A guide to translating abnormal markers into nutrition, supplements, and recovery priorities.',
    icon: LayoutDashboard,
  },
]

const LOOP_FLOW = [
  {
    title: 'Upload data',
    body: 'Bring in a new lab report or retest.',
    icon: Upload,
  },
  {
    title: 'Extract signals',
    body: 'AI normalizes biomarkers and flags patterns.',
    icon: BrainCircuit,
  },
  {
    title: 'Run protocol',
    body: 'You execute the highest-leverage actions.',
    icon: Sparkles,
  },
  {
    title: 'Check weekly response',
    body: 'Symptoms and adherence explain what changed.',
    icon: HeartPulse,
  },
  {
    title: 'Adapt the next cycle',
    body: 'The next upload becomes more precise than the last.',
    icon: TrendingUp,
  },
]

const TESTIMONIALS = [
  {
    quote: 'I stopped guessing. VITALOOP gave me a clear sequence and my energy stabilized in six weeks.',
    author: 'Nora, 34',
    role: 'Product lead, Berlin',
    result: 'Ferritin: 14 to 68 ng/mL in 12 weeks',
  },
  {
    quote: 'The weekly check-ins made me actually follow the plan. My ferritin trend finally moved in the right direction.',
    author: 'Alex, 41',
    role: 'Founder, London',
    result: 'CRP: 5.2 to 1.8 mg/L in 8 weeks',
  },
  {
    quote: 'As a clinician, I value how quickly I can see risk patterns and adherence context in one place.',
    author: 'Dr. Sam R.',
    role: 'Functional medicine practitioner',
    result: 'Client review prep: 45 min to 12 min',
  },
]

const MOCKUPS = [
  { title: 'Dashboard', alt: 'Dashboard with biomarker score, priority flags, and adherence trend.', device: 'desktop' },
  { title: 'Lab Upload', alt: 'Upload workspace with PDF intake, OCR status, and validation checks.', device: 'desktop' },
  { title: 'Lab Results', alt: 'Structured lab results with severity chips and high-risk markers.', device: 'desktop' },
  { title: 'Personalized Protocol', alt: 'Protocol plan with supplements, nutrition actions, and progress targets.', device: 'desktop' },
  { title: 'Timeline', alt: 'Longitudinal timeline with biomarker trajectories across multiple test cycles.', device: 'desktop' },
  { title: 'Practitioner CRM', alt: 'Practitioner CRM dashboard with client panels and assignment overview.', device: 'desktop' },
  { title: 'Weekly Check-in', alt: 'Mobile check-in flow with daily energy, sleep, and symptom entries.', device: 'mobile' },
]

const HERO_TRUST_SIGNALS = [
  {
    title: 'Clinical-grade interpretation',
    body: '85+ biomarkers normalized by range, unit, and trend context.',
    icon: FileText,
  },
  {
    title: 'Privacy-first architecture',
    body: 'Strict auth controls and secure processing for sensitive lab data.',
    icon: Lock,
  },
  {
    title: 'Action in under 60 seconds',
    body: 'From upload to personalized protocol with weekly adaptation loop.',
    icon: Clock3,
  },
]

  const STATS = [
    { value: '85+', label: 'Biomarker types tracked' },
    { value: '<60s', label: 'From upload to protocol' },
    { value: '$9.99', label: 'Personal Pro per month' },
    { value: '3 plans', label: 'Free, Pro, Enterprise' },
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
      cta: 'Try free',
      featured: false,
    },
    {
      name: 'Personal Pro',
      price: '$9.99',
      period: '/month',
      points: ['Unlimited uploads', 'Personalized protocol', 'Weekly AI check-ins', 'Priority insights'],
      cta: 'Upgrade',
      featured: true,
    },
    {
      name: 'Enterprise',
      price: '$99+',
      period: '/month',
      points: ['Team seats', 'Practitioner CRM', 'Workflow automation', 'Dedicated onboarding'],
      cta: 'Contact sales',
      featured: false,
    },
  ],
  yearly: [
    {
      name: 'Free',
      price: '$0',
      period: '/year',
      points: ['1 active upload', 'Basic biomarker summary', 'Core dashboard'],
      cta: 'Try free',
      featured: false,
    },
    {
      name: 'Personal Pro',
      price: '$95',
      period: '/year',
      points: ['Unlimited uploads', 'Personalized protocol', 'Weekly AI check-ins', 'Priority insights'],
      cta: 'Upgrade',
      featured: true,
    },
    {
      name: 'Enterprise',
      price: '$990+',
      period: '/year',
      points: ['Team seats', 'Practitioner CRM', 'Workflow automation', 'Dedicated onboarding'],
      cta: 'Contact sales',
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

function MockupCard({ title, alt, index, reduced, isDark, device = 'desktop' }) {
  const mobile = device === 'mobile'

  const desktopContent = (() => {
    if (title === 'Dashboard') return (
      <div className="grid h-36 grid-cols-[0.9fr_1.1fr] gap-2">
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-700/70 bg-slate-900/85 p-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-emerald-500/40 bg-emerald-500/10">
            <span className="text-[11px] font-bold text-emerald-300">78</span>
          </div>
          <div className="mt-2 h-1.5 w-14 rounded-full bg-slate-700" />
          <div className="mt-1 h-1 w-10 rounded-full bg-slate-800" />
        </div>
        <div className="grid gap-2">
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/85 p-2">
            <div className="mb-1.5 h-1.5 w-10 rounded-full bg-slate-700" />
            <div className="mt-1 flex items-center gap-1"><div className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/80" /><div className="ml-0.5 h-1 w-[78%] rounded-full bg-slate-700" /></div>
            <div className="mt-1 flex items-center gap-1"><div className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" /><div className="ml-0.5 h-1 w-[55%] rounded-full bg-slate-700" /></div>
            <div className="mt-1 flex items-center gap-1"><div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" /><div className="ml-0.5 h-1 w-[88%] rounded-full bg-slate-700" /></div>
          </div>
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/85 p-2">
            <div className="mb-1 h-1.5 w-14 rounded-full bg-slate-700" />
            <div className="h-2.5 w-full rounded-full bg-slate-800"><div className="h-2.5 w-[72%] rounded-full bg-emerald-500/70" /></div>
          </div>
        </div>
      </div>
    )
    if (title === 'Lab Upload') return (
      <div className="flex h-36 flex-col items-center justify-center gap-2.5 rounded-lg border border-slate-700/70 bg-slate-900/85 p-3">
        <div className="flex h-12 w-20 items-center justify-center rounded-xl border-2 border-dashed border-emerald-500/40">
          <div className="h-5 w-4 rounded-sm bg-emerald-500/35" />
        </div>
        <div className="w-full">
          <div className="h-2 w-full rounded-full bg-slate-800"><div className="h-2 w-4/5 rounded-full bg-emerald-500/70" /></div>
        </div>
        <div className="w-full space-y-1">
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" /><div className="h-1.5 w-3/4 rounded-full bg-slate-700" /></div>
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" /><div className="h-1.5 w-[85%] rounded-full bg-slate-700" /></div>
        </div>
      </div>
    )
    if (title === 'Lab Results') return (
      <div className="h-36 rounded-lg border border-slate-700/70 bg-slate-900/85 p-2.5">
        <div className="mb-2 h-1.5 w-16 rounded-full bg-slate-700" />
        <div className="mb-1.5 flex items-center gap-2"><div className="h-2 w-2 shrink-0 rounded-full bg-rose-400/80" /><div className="h-1.5 w-[78%] rounded-full bg-slate-700" /><div className="ml-auto h-4 w-10 shrink-0 rounded-full border border-slate-700/50 bg-rose-500/20" /></div>
        <div className="mb-1.5 flex items-center gap-2"><div className="h-2 w-2 shrink-0 rounded-full bg-amber-400/80" /><div className="h-1.5 w-[60%] rounded-full bg-slate-700" /><div className="ml-auto h-4 w-10 shrink-0 rounded-full border border-slate-700/50 bg-amber-500/20" /></div>
        <div className="mb-1.5 flex items-center gap-2"><div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" /><div className="h-1.5 w-[90%] rounded-full bg-slate-700" /><div className="ml-auto h-4 w-10 shrink-0 rounded-full border border-slate-700/50 bg-emerald-500/20" /></div>
        <div className="flex items-center gap-2"><div className="h-2 w-2 shrink-0 rounded-full bg-sky-400/80" /><div className="h-1.5 w-[55%] rounded-full bg-slate-700" /><div className="ml-auto h-4 w-10 shrink-0 rounded-full border border-slate-700/50 bg-sky-500/20" /></div>
      </div>
    )
    if (title === 'Personalized Protocol') return (
      <div className="h-36 rounded-lg border border-slate-700/70 bg-slate-900/85 p-2.5">
        <div className="mb-2 h-1.5 w-20 rounded-full bg-slate-700" />
        <div className="mb-1.5 flex items-center gap-2 rounded-md bg-emerald-500/20 px-2 py-1.5"><span className="text-[8px] font-bold text-slate-400">01</span><div className="h-1.5 flex-1 rounded-full bg-slate-700/60" /><div className="h-3.5 w-9 shrink-0 rounded-full bg-slate-700/50" /></div>
        <div className="mb-1.5 flex items-center gap-2 rounded-md bg-sky-500/15 px-2 py-1.5"><span className="text-[8px] font-bold text-slate-400">02</span><div className="h-1.5 flex-1 rounded-full bg-slate-700/60" /><div className="h-3.5 w-9 shrink-0 rounded-full bg-slate-700/50" /></div>
        <div className="flex items-center gap-2 rounded-md bg-violet-500/15 px-2 py-1.5"><span className="text-[8px] font-bold text-slate-400">03</span><div className="h-1.5 flex-1 rounded-full bg-slate-700/60" /><div className="h-3.5 w-9 shrink-0 rounded-full bg-slate-700/50" /></div>
      </div>
    )
    if (title === 'Timeline') return (
      <div className="h-36 rounded-lg border border-slate-700/70 bg-slate-900/85 p-2.5">
        <div className="mb-2 h-1.5 w-14 rounded-full bg-slate-700" />
        <div className="flex h-20 items-end gap-[3px] px-1">
          <div className="flex-1 rounded-t-sm bg-sky-500/30" style={{ height: '30%' }} />
          <div className="flex-1 rounded-t-sm bg-sky-500/30" style={{ height: '50%' }} />
          <div className="flex-1 rounded-t-sm bg-sky-500/30" style={{ height: '38%' }} />
          <div className="flex-1 rounded-t-sm bg-sky-500/30" style={{ height: '62%' }} />
          <div className="flex-1 rounded-t-sm bg-sky-500/30" style={{ height: '48%' }} />
          <div className="flex-1 rounded-t-sm bg-emerald-500/55" style={{ height: '70%' }} />
          <div className="flex-1 rounded-t-sm bg-emerald-500/55" style={{ height: '58%' }} />
          <div className="flex-1 rounded-t-sm bg-emerald-500/55" style={{ height: '78%' }} />
          <div className="flex-1 rounded-t-sm bg-emerald-500/55" style={{ height: '65%' }} />
          <div className="flex-1 rounded-t-sm bg-emerald-500/70" style={{ height: '86%' }} />
        </div>
        <div className="mt-1.5 flex justify-between px-1">
          <div className="h-1.5 w-5 rounded-full bg-slate-700" />
          <div className="h-1.5 w-5 rounded-full bg-slate-700" />
          <div className="h-1.5 w-5 rounded-full bg-slate-700" />
        </div>
      </div>
    )
    if (title === 'Practitioner CRM') return (
      <div className="h-36 rounded-lg border border-slate-700/70 bg-slate-900/85 p-2.5">
        <div className="mb-2 h-1.5 w-16 rounded-full bg-slate-700" />
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-700/60 bg-slate-800/60"><div className="h-1.5 w-1.5 rounded-full bg-emerald-400" /></div>
          <div className="flex-1"><div className="mb-0.5 h-1.5 w-12 rounded-full bg-slate-700" /><div className="h-2 w-full rounded-full bg-slate-800"><div className="h-2 w-[85%] rounded-full bg-emerald-400/60" /></div></div>
        </div>
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-700/60 bg-slate-800/60"><div className="h-1.5 w-1.5 rounded-full bg-amber-400" /></div>
          <div className="flex-1"><div className="mb-0.5 h-1.5 w-12 rounded-full bg-slate-700" /><div className="h-2 w-full rounded-full bg-slate-800"><div className="h-2 w-[58%] rounded-full bg-amber-400/60" /></div></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-700/60 bg-slate-800/60"><div className="h-1.5 w-1.5 rounded-full bg-rose-400" /></div>
          <div className="flex-1"><div className="mb-0.5 h-1.5 w-12 rounded-full bg-slate-700" /><div className="h-2 w-full rounded-full bg-slate-800"><div className="h-2 w-[32%] rounded-full bg-rose-400/60" /></div></div>
        </div>
      </div>
    )
    return (
      <div className="grid h-36 grid-cols-[1.05fr_0.95fr] gap-2">
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/85 p-2">
          <div className="mb-2 h-2 w-24 rounded-full bg-slate-700" />
          <div className="grid gap-1.5">
            <div className="h-6 rounded-md bg-emerald-500/20" />
            <div className="h-6 rounded-md bg-sky-500/20" />
            <div className="h-6 rounded-md bg-violet-500/20" />
          </div>
        </div>
        <div className="grid gap-2">
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/85 p-2">
            <div className="mb-1.5 h-2 w-14 rounded-full bg-slate-700" />
            <div className="h-7 rounded-md bg-emerald-500/25" />
          </div>
          <div className="rounded-lg border border-slate-700/70 bg-slate-900/85 p-2">
            <div className="mb-1.5 h-2 w-12 rounded-full bg-slate-700" />
            <div className="h-7 rounded-md bg-sky-500/25" />
          </div>
        </div>
      </div>
    )
  })()

  return (
    <motion.article
      {...fadeUp(reduced, Math.min(index * 0.05, 0.25))}
      whileHover={reduced ? undefined : { y: -4, scale: 1.01 }}
      className={`group relative overflow-hidden rounded-3xl border p-4 backdrop-blur transition duration-300 ${
        isDark ? 'border-slate-800/80 bg-slate-950/70' : 'border-slate-200 bg-white/90'
      }`}
      style={{
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.32), 0 8px 10px -6px rgb(0 0 0 / 0.28), inset 0 1px 0 rgba(16,185,129,0.08)',
      }}
      aria-label={alt}
    >
      <div className={`pointer-events-none absolute inset-0 opacity-60 ${isDark ? 'bg-[radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.16),transparent_48%)]' : 'bg-[radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.12),transparent_52%)]'}`} />

      <div className={`relative mb-3 rounded-2xl border p-2 ${isDark ? 'border-slate-700/80 bg-slate-900/80' : 'border-slate-200 bg-slate-50'}`}>
        {!mobile ? (
          <div className="rounded-xl border border-slate-700/60 bg-[linear-gradient(150deg,#0e182c,#0f1d35_55%,#0b1326)] p-2">
            <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-700/70 bg-slate-900/80 px-2.5 py-1.5">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/75" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/75" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/75" />
              </div>
              <div className="h-1.5 w-20 rounded-full bg-slate-700" />
            </div>
            {desktopContent}
          </div>
        ) : (
          <div className="mx-auto w-[170px] rounded-[24px] border border-slate-700/80 bg-[linear-gradient(180deg,#0f172a,#0b1224)] p-2.5 shadow-[0_12px_30px_rgba(15,23,42,0.45)]">
            <div className="mx-auto mb-2 h-4 w-16 rounded-full bg-slate-800" />
            <div className="rounded-[18px] border border-slate-700/70 bg-slate-900/90 p-2">
              <div className="mb-2 h-1.5 w-10 rounded-full bg-slate-700" />
              <div className="grid gap-1.5">
                <div className="flex h-5 items-center gap-1.5 rounded-md bg-emerald-500/25 px-2"><div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" /><div className="h-1 flex-1 rounded-full bg-slate-700/60" /></div>
                <div className="flex h-5 items-center gap-1.5 rounded-md bg-sky-500/20 px-2"><div className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" /><div className="h-1 flex-1 rounded-full bg-slate-700/60" /></div>
                <div className="flex h-5 items-center gap-1.5 rounded-md bg-violet-500/15 px-2"><div className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" /><div className="h-1 flex-1 rounded-full bg-slate-700/60" /></div>
                <div className="h-5 rounded-md bg-slate-700/40" />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className={isDark ? 'text-sm font-semibold text-slate-100' : 'text-sm font-semibold text-slate-900'}>{title}</div>
      <p className={isDark ? 'mt-1 text-xs leading-relaxed text-slate-400' : 'mt-1 text-xs leading-relaxed text-slate-600'}>{alt}</p>
    </motion.article>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [pricingMode, setPricingMode] = useState('monthly')
  const [theme, setTheme] = useState('dark')
  const [demoOpen, setDemoOpen] = useState(false)
  const [loopActive, setLoopActive] = useState(false)

  const pricingCards = PRICING[pricingMode]

  const isDark = theme === 'dark'
  const rootClasses = isDark
    ? 'bg-[#0A0F1C] text-slate-100'
    : 'bg-slate-50 text-slate-900'

  const sectionCard = isDark
    ? 'border border-slate-800/80 bg-slate-900/55 backdrop-blur'
    : 'border border-slate-200 bg-white/85 backdrop-blur'

  const ctaBase = 'inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50'

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
              className={`hidden sm:inline-flex ${ctaBase} ${isDark ? 'border border-slate-700 bg-slate-900 text-slate-200' : 'border border-slate-300 bg-white text-slate-700'} px-3 py-2 text-xs`}
              aria-label="Toggle dark and light mode"
            >
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className={`${ctaBase} ${isDark ? 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400/60' : 'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}
            >
              Explore plans
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
                className={`${ctaBase} ${isDark ? 'bg-emerald-500 text-slate-950 shadow-[0_0_0_0_rgba(16,185,129,0.35)] hover:bg-emerald-400 hover:shadow-[0_0_0_6px_rgba(16,185,129,0.16)]' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
              >
                Start Free Account - No card required
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => setDemoOpen(true)}
                className={`${ctaBase} ${isDark ? 'border border-slate-700 bg-slate-900/80 text-slate-100 hover:border-emerald-400/50' : 'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'} `}
              >
                <CirclePlay className="mr-2 h-4 w-4" />
                Watch 45s Demo
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2">
              {HERO_TRUST_SIGNALS.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <span className="text-[13px] font-medium">{item.title}</span>
                  </div>
                )
              })}
            </div>
          </motion.div>

          <motion.div
            {...fadeUp(reduced, 0.12)}
            whileHover={reduced ? undefined : { y: -4 }}
            className={`rounded-3xl p-4 sm:p-5 ${sectionCard}`}
            style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.18), 0 8px 10px -6px rgb(0 0 0 / 0.16), inset 0 1px 0 rgba(16,185,129,0.12)' }}
          >
            <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-700 bg-slate-950/88' : 'border-slate-200 bg-slate-50'}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Your VITALOOP dashboard</div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>What you see after your first upload</div>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Preview</span>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2">
                {[
                  { label: 'Health score', value: '78/100', icon: TrendingUp },
                  { label: 'Open priorities', value: '3', icon: Shield },
                  { label: 'Last sync', value: '2h ago', icon: Clock3 },
                ].map((metric) => {
                  const Icon = metric.icon
                  return (
                    <div key={metric.label} className={`rounded-xl border p-2.5 ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-200 bg-white'}`}>
                      <div className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{metric.label}</div>
                      <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{metric.value}</div>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-200 bg-white'}`}>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Top priority</div>
                  <div className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Ferritin recovery protocol</div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-700/40">
                    <div className="h-1.5 w-[72%] rounded-full bg-emerald-500" />
                  </div>
                  <p className={`mt-2 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>3 actions due this week</p>
                </div>
                <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-200 bg-white'}`}>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Weekly adherence</div>
                  <div className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>4 / 5 habit targets complete</div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-700/40">
                    <div className="h-1.5 w-[80%] rounded-full bg-emerald-500" />
                  </div>
                  <p className={`mt-2 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Trend: +9% vs last cycle</p>
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
          <motion.div {...fadeUp(reduced)} className={`rounded-[32px] p-6 md:p-8 ${sectionCard}`}>
            <div className="mx-auto max-w-4xl text-center">
              <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Why standard reports fail</p>
              <h2 className="mt-3 text-[28px] font-semibold tracking-tight md:text-[34px]">Why Most People Get Zero Value From Their Blood Tests</h2>
              <p className={`mx-auto mt-4 max-w-3xl text-[17px] leading-[1.75] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                A traditional lab PDF gives you reference ranges, not decisions. It rarely explains what matters first, which markers connect to each other, or what to do in the next seven days. That leaves most people with expensive data and no operating system.
              </p>
            </div>

            <div className="mt-8 grid items-start gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="grid content-start gap-4 self-start md:grid-cols-3 md:auto-rows-min">
                {[
                  {
                    title: 'No prioritization',
                    body: 'You see ten abnormal markers, but no clue which two are driving the most downstream symptoms.',
                  },
                  {
                    title: 'No longitudinal memory',
                    body: 'Each retest is treated like a fresh document instead of part of a trend that should change your interpretation.',
                  },
                  {
                    title: 'No execution layer',
                    body: 'Even when something is obviously off, there is no protocol, no weekly loop, and no accountability to act on it.',
                  },
                ].map((item, idx) => (
                  <motion.article
                    key={item.title}
                    {...fadeUp(reduced, idx * 0.05)}
                    className={`rounded-3xl border p-5 text-left ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-white/90'}`}
                  >
                    <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl ${isDark ? 'bg-rose-500/12 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>
                      0{idx + 1}
                    </div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.body}</p>
                  </motion.article>
                ))}
              </div>

              <motion.div
                {...fadeUp(reduced, 0.16)}
                className={`self-start rounded-3xl border p-5 ${isDark ? 'border-emerald-400/20 bg-[linear-gradient(180deg,rgba(5,15,28,0.98),rgba(9,23,35,0.82))]' : 'border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#edfdf5)]'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.16em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>What VITALOOP changes</p>
                    <h3 className="mt-2 text-xl font-semibold">From numbers to a living health system</h3>
                  </div>
                  <Shield className={`h-8 w-8 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`} />
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    'Ranks the highest-leverage biomarker issues first',
                    'Tracks whether changes are improving, flat, or regressing',
                    'Turns interpretation into an action protocol you can actually follow',
                  ].map((line) => (
                    <div key={line} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${isDark ? 'border-slate-800 bg-slate-900/65' : 'border-slate-200 bg-white/90'}`}>
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span className={`text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{line}</span>
                    </div>
                  ))}
                </div>
                <div className={`mt-5 rounded-2xl border px-4 py-4 ${isDark ? 'border-slate-800 bg-slate-950/70 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Outcome</div>
                  <p className="mt-2 text-sm leading-relaxed">
                    Instead of asking “What do all these numbers mean?”, users get a ranked explanation, a protocol, and a repeatable loop for the next cycle.
                  </p>
                </div>
              </motion.div>
            </div>
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
              Four premium layers work together to turn one upload into a compounding health intelligence system rather than a one-time report review.
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PREMIUM_FEATURES.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.article
                  key={feature.title}
                  {...fadeUp(reduced, index * 0.05)}
                  whileHover={reduced ? undefined : { y: -5, scale: 1.01 }}
                  className={`flex min-h-[320px] flex-col rounded-[30px] border p-6 ${isDark ? 'border-slate-800 bg-[linear-gradient(180deg,rgba(8,15,30,0.92),rgba(12,24,38,0.72))]' : 'border-slate-200 bg-white'}`}
                  style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.1), inset 0 1px 0 rgba(16,185,129,0.08)' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? 'bg-emerald-500/14 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${isDark ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                      Premium
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold leading-snug">{feature.title}</h3>
                  <p className={`mt-3 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{feature.body}</p>
                  <div className={`mt-auto rounded-2xl border px-4 py-4 text-sm leading-relaxed ${isDark ? 'border-slate-800 bg-slate-950/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                    {feature.detail}
                  </div>
                </motion.article>
              )
            })}
          </div>

          <motion.div {...fadeUp(reduced, 0.12)} className="mt-12">
            <div className="mb-5 flex items-center gap-3">
              <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Platform walkthrough</p>
              <div className={`h-px flex-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {MOCKUPS.map((m, i) => (
                <MockupCard key={m.title} title={m.title} alt={m.alt} device={m.device} index={i} reduced={reduced} isDark={isDark} />
              ))}
            </div>
          </motion.div>
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
                  whileHover={reduced ? undefined : { y: -4, scale: 1.01, boxShadow: '0 0 0 4px rgba(16,185,129,0.12)' }}
                  className={`rounded-3xl border p-6 min-h-[208px] ${isDark ? 'border-slate-800 bg-slate-900/55' : 'border-slate-200 bg-white'}`}
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
              <p className={`mt-3 max-w-3xl text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Entry-level access for your first report, a real premium layer for longitudinal self-optimization, and an operations plan for practitioners who need client visibility and workflow control.
              </p>
            </div>
            <div className={`relative inline-flex rounded-2xl border p-1 ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-300 bg-white'}`}>
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                className="absolute inset-y-1 w-[calc(50%-4px)] rounded-xl bg-emerald-500"
                style={{ left: pricingMode === 'monthly' ? 4 : 'calc(50% + 0px)' }}
              />
              {['monthly', 'yearly'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPricingMode(mode)}
                  className={`relative z-10 rounded-xl px-5 py-2 text-sm font-semibold capitalize transition ${pricingMode === mode ? 'text-slate-950' : isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
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
                whileHover={reduced ? undefined : { y: -4, scale: 1.01 }}
                className={`flex h-full flex-col rounded-3xl border p-6 ${plan.featured ? 'border-emerald-300 bg-emerald-500/10' : isDark ? 'border-slate-800 bg-slate-900/55' : 'border-slate-200 bg-white'}`}
                style={{ boxShadow: plan.featured ? '0 0 0 4px rgba(16,185,129,0.12), 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)' }}
              >
                <div className="mb-3 flex min-h-[28px] items-start justify-between gap-3">
                  <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${plan.featured ? 'text-emerald-200' : isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {PLAN_DETAILS[plan.name]?.eyebrow}
                  </p>
                  {plan.featured && (
                    <span className="shrink-0 rounded-full border border-emerald-300 bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-950 shadow-[0_6px_16px_rgba(16,185,129,0.35)]">
                      Most popular
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className={`pb-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{plan.period}</span>
                </div>
                <p className={`mt-4 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {PLAN_DETAILS[plan.name]?.description}
                </p>
                <ul className="mt-5 space-y-2">
                  {plan.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{point}</span>
                    </li>
                  ))}
                </ul>
                <div className={`mt-5 rounded-2xl border px-4 py-4 text-sm leading-relaxed ${isDark ? 'border-slate-800 bg-slate-950/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                  {PLAN_DETAILS[plan.name]?.idealFor}
                </div>
                <button onClick={() => {
                  if (plan.name === 'Enterprise') {
                    window.location.href = 'mailto:info@softdab.tech?subject=Vitaloop%20Enterprise'
                    return
                  }
                  navigate('/login?signup=true')
                }} className={`mt-6 w-full ${ctaBase} mt-auto ${plan.featured ? isDark ? 'border border-emerald-400/60 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15' : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : isDark ? 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400/60' : 'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}>
                  {plan.cta}
                </button>
                {plan.name === 'Enterprise' && (
                  <p className={`mt-3 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Custom seats, onboarding, and workflow setup are scoped with your team.</p>
                )}
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
                {item.result && (
                  <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-semibold ${isDark ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    {item.result}
                  </div>
                )}
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
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Health Intelligence Hub</p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Guides on Biomarker Interpretation & Biohacking</h2>
                <p className={`mt-2 max-w-xl text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Deep dives on reading blood test results, optimizing ferritin, testosterone, cortisol, and building a sustainable biohacking protocol. The guides page now acts like an extension of the product, not a disconnected document dump.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate('/how-it-works')}
                    className={`${ctaBase} shrink-0 ${isDark ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
                  >
                    Explore guides
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                  <button
                    onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                    className={`${ctaBase} shrink-0 ${isDark ? 'border border-slate-700 bg-slate-900/80 text-slate-100 hover:border-emerald-400/60' : 'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}
                  >
                    Compare plans
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {HUB_GUIDES.map((guide, idx) => {
                  const Icon = guide.icon
                  return (
                    <motion.article
                      key={guide.title}
                      {...fadeUp(reduced, idx * 0.05)}
                      className={`rounded-3xl border p-5 ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-white/90'}`}
                    >
                      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${isDark ? 'bg-emerald-500/14 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <h3 className="mt-4 text-base font-semibold">{guide.title}</h3>
                      <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{guide.body}</p>
                    </motion.article>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div
            {...fadeUp(reduced)}
            onMouseEnter={() => setLoopActive(true)}
            onMouseLeave={() => setLoopActive(false)}
            className={`rounded-3xl border p-6 md:p-8 ${sectionCard}`}
          >
            <h2 className="text-[28px] font-semibold tracking-tight">The Biohacking Feedback Loop: How Longitudinal Lab Tracking Works</h2>
            <p className={`mt-3 max-w-3xl text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Biohacking is not a one-time blood test — it is a continuous feedback cycle. VITALOOP makes that loop automatic: data → AI insight → action protocol → weekly check-in → next lab upload. Each cycle makes the next one smarter.
            </p>
            <div className="mt-6 grid gap-4 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
              {LOOP_FLOW.map((item, idx) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="relative">
                    {idx < LOOP_FLOW.length - 1 && (
                      <motion.div
                        aria-hidden="true"
                        animate={loopActive && !reduced ? { opacity: [0.25, 1, 0.4], scaleX: [0.92, 1, 0.96] } : { opacity: 0.28, scaleX: 1 }}
                        transition={{ duration: 0.8, delay: idx * 0.14, ease: 'easeInOut' }}
                        className={`absolute left-[calc(50%+36px)] top-9 hidden h-px w-[calc(100%-12px)] origin-left xl:block ${isDark ? 'bg-gradient-to-r from-emerald-400/80 to-slate-700/20' : 'bg-gradient-to-r from-emerald-500/80 to-slate-300/20'}`}
                      />
                    )}
                    <motion.article
                      animate={loopActive && !reduced ? { y: [0, -8, 0], scale: [1, 1.02, 1] } : { y: 0, scale: 1 }}
                      transition={{ duration: 0.75, delay: idx * 0.14, ease: 'easeInOut' }}
                      className={`relative h-full rounded-[28px] border px-4 py-5 ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? 'bg-emerald-500/14 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>0{idx + 1}</span>
                      </div>
                      <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                      <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.body}</p>
                    </motion.article>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-10 sm:px-6 md:pb-28 md:pt-16">
          <motion.div {...fadeUp(reduced)} className={`rounded-3xl border p-6 text-center md:p-10 ${sectionCard}`}>
            <h2 className="text-[28px] font-semibold tracking-tight">Start Interpreting Your Blood Tests With AI Today</h2>
            <p className={`mx-auto mt-3 max-w-2xl text-[17px] leading-[1.7] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Replace guesswork with AI-powered biomarker analysis and personalized protocols. Free to start, no credit card required.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => navigate('/login?signup=true')} className={`${ctaBase} ${isDark ? 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400/60' : 'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}>
                Create free account
              </button>
              <button onClick={() => navigate('/how-it-works')} className={`${ctaBase} ${isDark ? 'border border-slate-700 bg-slate-900/80 text-slate-100 hover:border-emerald-400/60' : 'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}>
                Explore product
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      <CabinetPreviewModal open={demoOpen} onClose={() => setDemoOpen(false)} reduced={reduced} />

      <footer className={`border-t ${isDark ? 'border-slate-800 bg-[#070b15]' : 'border-slate-200 bg-white'} py-10`}>
        <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 text-sm sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/90 text-white">
                <HeartPulse className="h-5 w-5" />
              </span>
              <span className="text-base font-semibold tracking-tight">VITALOOP</span>
            </div>
            <p className={`mt-4 max-w-md leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              AI lab analysis, personalized protocols, and longitudinal biomarker tracking for people who want a repeatable health system instead of one-off interpretations.
            </p>
            <p className={`mt-4 text-xs uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Not medical advice. Always work with a qualified clinician for diagnosis and treatment decisions.</p>
          </div>

          <div>
            <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Product</div>
            <div className="mt-4 flex flex-col gap-3">
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className={`text-left underline-offset-2 hover:underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>How it works</button>
              <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className={`text-left underline-offset-2 hover:underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pricing</button>
              <button onClick={() => navigate('/how-it-works')} className={`text-left underline-offset-2 hover:underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Health Intelligence Hub</button>
            </div>
          </div>

          <div>
            <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Company</div>
            <div className="mt-4 flex flex-col gap-3">
              <button
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                className={`inline-flex w-fit items-center justify-center rounded-2xl border px-3 py-2 text-xs font-semibold transition ${isDark ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-400/50' : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-300'}`}
                aria-label="Toggle dark and light mode"
              >
                {isDark ? 'Light mode' : 'Dark mode'}
              </button>
              <button onClick={() => navigate('/terms')} className={`text-left underline-offset-2 hover:underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Terms</button>
              <button onClick={() => navigate('/privacy')} className={`text-left underline-offset-2 hover:underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Privacy</button>
              <a href="mailto:info@softdab.tech" className={`underline-offset-2 hover:underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>info@softdab.tech</a>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>© {new Date().getFullYear()} VITALOOP</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
