import { useEffect, useMemo, useState } from 'react'

import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Lock,
  Menu,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'
import { LightHero } from '../components/landing/LightHero.jsx'
import { StatsBar } from '../components/landing/StatsBar.jsx'
import { TrustedServicesSection } from '../components/landing/TrustedServicesSection.jsx'
import { TestimonialsCarousel } from '../components/landing/TestimonialsCarousel.jsx'
import { InteractivePricing } from '../components/landing/InteractivePricing.jsx'
import { AnimatedFAQ } from '../components/landing/AnimatedFAQ.jsx'
import { HowItWorksTimeline } from '../components/landing/HowItWorksTimeline.jsx'
import Footer from '../components/landing/Footer.jsx'
import BrandMark from '../components/landing/BrandMark.jsx'

const NAV_LINKS = [
  { id: 'why-vitaloop', label: 'How it helps' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'about', label: 'About', route: '/about' },
  { id: 'for-nutritionists', label: 'For Practitioners', route: '/for-nutritionists' },
]

// S7764 helper functions for safe window access
function scrollToTop() {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const STEPS = [
  { icon: HeartPulse, title: 'Start with symptoms', body: 'Describe what you feel and for how long' },
  { icon: BrainCircuit, title: 'Answer follow-ups', body: 'Smart questions organize your context' },
  { icon: FlaskConical, title: 'Get lab direction', body: 'See what may be useful to check next' },
  { icon: Upload, title: 'Upload results', body: 'Analyze 85+ biomarkers after testing' },
  { icon: Sparkles, title: 'Run and refine', body: 'Weekly check-ins adapt your protocol' },
]

const BENEFITS = [
  {
    title: 'Your Protocol',
    body: 'Not generic advice',
    icon: Sparkles,
    stat: '100%',
    label: 'Personalized'
  },
  {
    title: 'Track Progress',
    body: 'See trends over time',
    icon: TrendingUp,
    stat: '5+',
    label: 'Test cycles'
  },
  {
    title: 'AI Powered',
    body: 'Smart recommendations',
    icon: BrainCircuit,
    stat: 'Deep AI',
    label: 'Comprehensive analysis'
  },
  {
    title: 'Secure',
    body: 'Privacy-first design',
    icon: ShieldCheck,
    stat: '🔒',
    label: 'Encrypted'
  },
]

const PREMIUM_FEATURES = [
  {
    title: 'Symptom check-ins and trend overlays',
    body: 'Track weekly symptom changes next to biomarker movement to understand what is actually improving.',
    icon: HeartPulse,
  },
  {
    title: 'Priority ranking by impact',
    body: 'See the highest-leverage issues first with a clear order of execution instead of scattered suggestions.',
    icon: TrendingUp,
  },
  {
    title: 'Lab discussion prep',
    body: 'Bring structured notes and focused questions to your clinician conversations.',
    icon: Stethoscope,
  },
  {
    title: 'Protocol adaptation across cycles',
    body: 'Move from one-off interpretation to an iterative loop with retests and weekly adjustments.',
    icon: Upload,
  },
]

const PLAN_DETAILS = {
  Free: {
    eyebrow: 'Validate the experience',
    description: 'For first-time users who want to upload one report, see the dashboard structure, and understand how VITALOOP turns raw biomarker values into usable context.',
    idealFor: 'Best for: trying your first blood test interpretation without commitment.',
  },
  'Premium': {
    eyebrow: 'Most chosen plan',
    description: 'For users actively running a health protocol who need unlimited uploads, longitudinal tracking, weekly adaptation, and comprehensive feedback between lab cycles.',
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
    title: 'How symptoms can map to systems',
    body: 'A practical guide to connecting fatigue, mood, sleep, and recovery signals to biomarker categories.',
    icon: FileText,
  },
  {
    title: 'How to prepare for lab discussions',
    body: 'Use structured context and focused questions to make clinician conversations more productive.',
    icon: BrainCircuit,
  },
  {
    title: 'Building a repeatable feedback loop',
    body: 'How to combine symptoms, labs, and weekly adherence into a system that improves over time.',
    icon: LayoutDashboard,
  },
]

const LOOP_FLOW = [
  {
    title: 'Capture symptoms',
    body: 'Start with what you feel and what changed.',
    detail: 'Context includes symptom duration, severity, and relevant lifestyle factors.',
    icon: HeartPulse,
  },
  {
    title: 'Set direction',
    body: 'Use follow-ups to shape what to check next.',
    detail: 'You get a structured list of biomarker categories and discussion points for clinical review.',
    icon: FlaskConical,
  },
  {
    title: 'Upload lab data',
    body: 'Map test results to your context.',
    detail: 'VITALOOP normalizes markers and links patterns to symptoms and goals.',
    icon: BrainCircuit,
  },
  {
    title: 'Run protocol',
    body: 'You execute the highest-leverage actions.',
    detail: 'Dosage, timing, and nutrition actions are structured into a weekly plan.',
    icon: Sparkles,
  },
  {
    title: 'Check weekly response',
    body: 'Symptoms and adherence explain what changed.',
    detail: 'Weekly logs capture energy, sleep, side effects, and protocol consistency.',
    icon: HeartPulse,
  },
  {
    title: 'Adapt the next cycle',
    body: 'The next upload becomes more precise than the last.',
    detail: 'Each completed cycle updates recommendations before the next lab retest.',
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
    quote: 'As a clinician, I value how clearly I can see risk patterns and adherence context in one place.',
    author: 'Dr. Sam R.',
    role: 'Functional medicine practitioner',
    result: 'Client review prep: 45 min to 12 min',
  },
]

const MOCKUPS = [
  { title: 'Dashboard', alt: 'Health Score 78/100 with biomarker priority flags and weekly adherence trend.', device: 'desktop' },
  { title: 'Lab Upload', alt: 'Upload workspace with PDF intake, AI analysis progress, and 54 biomarkers analyzed.', device: 'desktop' },
  { title: 'Lab Results', alt: 'Structured biomarker table with severity chips, reference ranges, and trend arrows.', device: 'desktop' },
  { title: 'Personalized Protocol', alt: 'AI protocol plan with ranked supplements, nutrition targets, and weekly tasks.', device: 'desktop' },
  { title: 'Timeline', alt: 'Longitudinal trend chart showing ferritin, CRP, and vitamin D across 5 test cycles.', device: 'desktop' },
  { title: 'Practitioner CRM', alt: 'Practitioner CRM with 3 client panels, adherence bars, and assignment overview.', device: 'desktop' },
  { title: 'Weekly Check-in', alt: 'Mobile weekly check-in with energy, sleep, and symptom sliders plus streak badge.', device: 'mobile' },
]

const HERO_TRUST_SIGNALS = [
  {
    title: 'Symptom-first workflow',
    body: 'Start with how you feel before deciding what to test next.',
    icon: FileText,
  },
  {
    title: 'Privacy-first architecture',
    body: 'Strict auth controls and secure processing for sensitive lab data.',
    icon: Lock,
  },
  {
    title: 'Continuous adaptation',
    body: 'From symptom intake to protocol refinement through weekly feedback.',
    icon: Clock3,
  },
]

const FAQ_ITEMS = [
  {
    question: 'Can I start with symptoms even without lab results?',
    answer: 'Yes. You can begin with symptom intake and guided follow-up questions. VITALOOP helps you organize context and identify what may be useful to discuss and test next.',
  },
  {
    question: 'Does VITALOOP diagnose conditions?',
    answer: 'No. VITALOOP is a wellness support and organization platform. It provides educational insights and protocol suggestions, not medical diagnosis or treatment.',
  },
  {
    question: 'Will this replace my doctor?',
    answer: 'No. It is designed to make your discussions with a qualified clinician more focused by organizing symptoms, lab context, and next-step questions.',
  },
  {
    question: 'What do I get after uploading lab results?',
    answer: 'You receive normalized biomarker interpretation, prioritized issues, and a structured protocol you can follow and refine over time.',
  },
  {
    question: 'Can practitioners use VITALOOP with clients?',
    answer: 'Yes. Practitioner workflows support client context review, progress monitoring, and clearer communication around protocol execution.',
  },
  {
    question: 'How is this different from generic AI chat?',
    answer: 'VITALOOP keeps your structured health context over time and connects symptom intake, lab normalization, and weekly feedback into one continuous workflow.',
  },
  {
    question: 'How much does VITALOOP cost?',
    answer: 'VITALOOP offers a free plan and paid plans for continuous tracking and practitioner workflows. Pricing details are available in the Pricing section.',
  },
]

const SCHEMA_HOWTO = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Use VITALOOP From Symptoms to Action',
  description: 'Start with symptom intake, organize follow-up context, upload labs, and run a structured weekly protocol loop.',
  estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: '0' },
  step: [
    { '@type': 'HowToStep', name: 'Start with symptoms', text: 'Document symptoms, timing, and context so your case starts from what you actually feel.', position: 1 },
    { '@type': 'HowToStep', name: 'Answer targeted follow-up questions', text: 'Use guided intake to organize factors that may influence your health patterns.', position: 2 },
    { '@type': 'HowToStep', name: 'Get lab direction and upload results', text: 'Review suggested biomarker categories, then upload your lab report for structured interpretation.', position: 3 },
    { '@type': 'HowToStep', name: 'Receive prioritized protocol actions', text: 'Get a ranked action plan mapped to your context and biomarker patterns.', position: 4 },
    { '@type': 'HowToStep', name: 'Track weekly and adapt', text: 'Use weekly check-ins and retests to refine your protocol over time.', position: 5 },
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
      name: 'Premium',
      price: '$19.99',
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
      name: 'Premium',
      price: '$199',
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

// ── Rich screen mockup content per card ─────────────────────────────────────
function MockupScreenContent({ title }) {
  if (title === 'Dashboard') return (
    <div className="grid grid-cols-[0.9fr_1.1fr] gap-2" style={{ height: 168 }}>
      {/* Left — health score ring */}
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/85 p-3">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <svg viewBox="0 0 80 80" className="absolute inset-0" aria-hidden="true">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(16,185,129,0.12)" strokeWidth="7" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="url(#hsGrad)" strokeWidth="7"
              strokeDasharray="213" strokeDashoffset="54" strokeLinecap="round"
              transform="rotate(-90 40 40)" />
            <defs>
              <linearGradient id="hsGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
          <div className="text-center">
            <div className="text-lg font-bold leading-none text-emerald-300">78</div>
            <div className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">score</div>
          </div>
        </div>
        <div className="text-[10px] font-semibold text-emerald-400">↑ +5 this cycle</div>
      </div>
      {/* Right — flags + adherence */}
      <div className="grid gap-2">
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/85 p-2.5">
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Priority flags</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" /><span className="text-[10px] text-slate-300">Ferritin — Low (14 ng/mL)</span></div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" /><span className="text-[10px] text-slate-400">Vitamin D — Borderline</span></div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" /><span className="text-[10px] text-slate-400">CRP — Normalizing ↓</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/85 p-2.5">
          <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Weekly adherence</div>
          <div className="mb-1.5 flex items-end gap-1" style={{ height: 28 }}>
            {[55, 70, 60, 80, 68, 90, 85].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, backgroundColor: i >= 5 ? 'rgba(16,185,129,0.7)' : 'rgba(71,85,105,0.5)' }} />
            ))}
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800">
            <div className="h-1.5 w-[78%] rounded-full bg-emerald-500/70" />
          </div>
        </div>
      </div>
    </div>
  )

  if (title === 'Lab Upload') return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-700/70 bg-slate-900/85 p-3" style={{ height: 168 }}>
      {/* Drop zone */}
      <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5" style={{ height: 56 }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-7 flex-col items-center justify-end rounded-md bg-rose-400/20 p-1">
            <div className="h-1 w-5 rounded-full bg-rose-300/60 mb-0.5" />
            <div className="h-1 w-3 rounded-full bg-rose-300/40" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-emerald-300">bloodtest_2024.pdf</div>
            <div className="text-[9px] text-slate-500">Analyzing biomarkers…</div>
          </div>
        </div>
      </div>
      {/* Analysis progress */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[9px] text-slate-500">Biomarkers found</span>
          <span className="text-[9px] font-bold text-emerald-400">54 / 54</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-800">
          <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: '100%' }} />
        </div>
      </div>
      {/* Result chips */}
      <div className="flex flex-wrap gap-1">
        {[['CBC', 'emerald'], ['Iron panel', 'sky'], ['Thyroid', 'violet'], ['Lipids', 'amber'], ['Metabolic', 'emerald']].map(([label, c]) => (
          <span key={label} className={'rounded-full border px-1.5 py-0.5 text-[8px] font-semibold'} style={{ borderColor: `var(--${c}-400, #34d399)30`, background: `var(--${c}-500, #10b981)12`, color: `var(--${c}-300, #6ee7b7)` }}>{label}</span>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-[9px] text-slate-400">3 red flags detected — protocol generating…</span>
      </div>
    </div>
  )

  if (title === 'Lab Results') return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/85 p-2.5" style={{ height: 168 }}>
      <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">54 biomarkers · 3 flagged</div>
      <div className="space-y-1.5">
        {[
          { name: 'Ferritin', value: '14', unit: 'ng/mL', ref: '13–150', color: 'rose', pct: 8, label: 'Low' },
          { name: 'CRP', value: '3.2', unit: 'mg/L', ref: '<1.0', color: 'amber', pct: 72, label: 'High' },
          { name: 'Vitamin D', value: '28', unit: 'ng/mL', ref: '30–100', color: 'amber', pct: 28, label: 'Border' },
          { name: 'TSH', value: '2.1', unit: 'mIU/L', ref: '0.4–4.0', color: 'emerald', pct: 50, label: 'Normal' },
          { name: 'Glucose', value: '88', unit: 'mg/dL', ref: '70–99', color: 'emerald', pct: 55, label: 'Normal' },
        ].map((row) => (
          <div key={row.name} className="flex items-center gap-2">
            <div className={`h-2 w-2 shrink-0 rounded-full bg-${row.color}-400`} style={{ background: row.color === 'rose' ? '#f87171' : row.color === 'amber' ? '#fbbf24' : '#34d399' }} />
            <span className="w-16 shrink-0 text-[9px] text-slate-300">{row.name}</span>
            <div className="flex-1 rounded-full bg-slate-800" style={{ height: 5 }}>
              <div className="rounded-full" style={{ width: `${row.pct}%`, height: 5, background: row.color === 'rose' ? '#f87171aa' : row.color === 'amber' ? '#fbbf24aa' : '#34d399aa' }} />
            </div>
            <span className="w-10 shrink-0 text-right text-[9px] font-semibold text-slate-300">{row.value}</span>
            <span className="w-10 shrink-0 rounded-full border px-1.5 text-center text-[8px] font-bold" style={{ borderColor: row.color === 'rose' ? '#f87171' : row.color === 'amber' ? '#fbbf24' : '#34d399', color: row.color === 'rose' ? '#fca5a5' : row.color === 'amber' ? '#fde68a' : '#6ee7b7', background: row.color === 'rose' ? '#f8717120' : row.color === 'amber' ? '#fbbf2420' : '#34d39920' }}>{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  )

  if (title === 'Personalized Protocol') return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/85 p-2.5" style={{ height: 168 }}>
      <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Your protocol · 7 actions</div>
      <div className="space-y-1.5">
        {[
          { rank: '01', label: 'Iron bisglycinate 36mg with Vit C', cat: 'Supplement', prio: 'Critical', bg: '#f8717120', border: '#f87171', col: '#fca5a5', bar: '#f87171aa', pct: 92 },
          { rank: '02', label: 'Reduce inflammatory foods 4× week', cat: 'Nutrition', prio: 'High', bg: '#fbbf2420', border: '#fbbf24', col: '#fde68a', bar: '#fbbf24aa', pct: 78 },
          { rank: '03', label: 'Vitamin D3 4000 IU daily with K2', cat: 'Supplement', prio: 'High', bg: '#60a5fa20', border: '#60a5fa', col: '#93c5fd', bar: '#60a5faaa', pct: 70 },
          { rank: '04', label: 'Weekly check-in — track fatigue', cat: 'Lifestyle', prio: 'Medium', bg: '#34d39920', border: '#34d399', col: '#6ee7b7', bar: '#34d399aa', pct: 55 },
        ].map((item) => (
          <div key={item.rank} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: item.bg, border: `1px solid ${item.border}35` }}>
            <span className="text-[8px] font-bold" style={{ color: item.col }}>{item.rank}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-semibold text-slate-200 truncate">{item.label}</div>
              <div className="text-[8px] text-slate-500">{item.cat}</div>
            </div>
            <div className="w-10 rounded-full" style={{ height: 4, background: 'rgba(71,85,105,0.5)' }}>
              <div className="rounded-full" style={{ width: `${item.pct}%`, height: 4, background: item.bar }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (title === 'Timeline') return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/85 p-2.5" style={{ height: 168 }}>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Biomarker trends · 5 cycles</div>
        <div className="flex items-center gap-2 text-[8px]">
          <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-rose-400/70" />Ferritin</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-sky-400/70" />Vit D</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-emerald-400/70" />CRP</span>
        </div>
      </div>
      {/* Simple SVG sparkline chart */}
      <svg viewBox="0 0 200 90" preserveAspectRatio="none" className="w-full" style={{ height: 90 }} aria-hidden="true">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" y1={f * 90} x2="200" y2={f * 90} stroke="rgba(71,85,105,0.25)" strokeWidth="0.5" />
        ))}
        {/* Ferritin line */}
        <polyline points="20,78 60,72 100,65 140,50 180,32" fill="none" stroke="rgba(248,113,113,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="180" cy="32" r="3.5" fill="#f87171" />
        {/* Vitamin D line */}
        <polyline points="20,70 60,60 100,55 140,48 180,40" fill="none" stroke="rgba(56,189,248,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="180" cy="40" r="3.5" fill="#38bdf8" />
        {/* CRP line — improving (going down) */}
        <polyline points="20,28 60,34 100,40 140,52 180,62" fill="none" stroke="rgba(52,211,153,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="180" cy="62" r="3.5" fill="#34d399" />
      </svg>
      <div className="mt-1.5 flex justify-between text-[8px] text-slate-600 px-1">
        {['Jan', 'Mar', 'May', 'Aug', 'Nov'].map((m) => <span key={m}>{m}</span>)}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">↑ Ferritin recovering</span>
        <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[8px] font-bold text-sky-300">↓ CRP normalizing</span>
      </div>
    </div>
  )

  if (title === 'Practitioner CRM') return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/85 p-2.5" style={{ height: 168 }}>
      <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">3 active clients</div>
      <div className="space-y-2">
        {[
          { init: 'NA', name: 'Nora A.', tag: 'Iron recovery', pct: 85, col: '#34d399', bg: '#34d39920', status: 'On track' },
          { init: 'MS', name: 'Mark S.', tag: 'Thyroid + CRP', pct: 52, col: '#fbbf24', bg: '#fbbf2420', status: 'Needs review' },
          { init: 'JR', name: 'Julia R.', tag: 'Hormone panel', pct: 34, col: '#f87171', bg: '#f8717120', status: 'Flagged' },
        ].map((client) => (
          <div key={client.init} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: client.bg, border: `1px solid ${client.col}25` }}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold text-slate-300" style={{ borderColor: `${client.col}50`, background: `${client.col}18` }}>{client.init}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-200">{client.name}</span>
                <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold" style={{ background: `${client.col}20`, color: client.col }}>{client.status}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="flex-1 rounded-full bg-slate-800" style={{ height: 4 }}>
                  <div className="rounded-full" style={{ width: `${client.pct}%`, height: 4, background: client.col + 'bb' }} />
                </div>
                <span className="text-[8px] text-slate-500">{client.pct}%</span>
              </div>
            </div>
            <span className="text-[8px] text-slate-500 truncate max-w-[52px]">{client.tag}</span>
          </div>
        ))}
      </div>
    </div>
  )

  // Weekly Check-in (mobile — rendered differently by parent)
  return null
}

// Mobile-specific check-in content
function MockupMobileContent() {
  return (
    <div className="rounded-[18px] border border-slate-700/70 bg-slate-900/90 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold text-slate-200">Weekly check-in</div>
        <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">🔥 7-day streak</span>
      </div>
      <div className="space-y-2">
        {[
          { label: 'Energy', val: 7, col: '#34d399' },
          { label: 'Sleep quality', val: 5, col: '#60a5fa' },
          { label: 'Fatigue', val: 4, col: '#fbbf24' },
        ].map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-[9px]">
              <span className="text-slate-400">{item.label}</span>
              <span className="font-bold" style={{ color: item.col }}>{item.val}/10</span>
            </div>
            <div className="relative h-4 rounded-full bg-slate-800">
              <div className="h-4 rounded-full" style={{ width: `${item.val * 10}%`, background: `${item.col}70` }} />
              <div className="absolute top-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 shadow" style={{ left: `calc(${item.val * 10}% - 6px)`, borderColor: item.col, background: '#0f172a' }} />
            </div>
          </div>
        ))}
      </div>
      <button className="mt-3 w-full rounded-xl bg-emerald-500/20 py-2 text-[9px] font-bold text-emerald-300" style={{ border: '1px solid rgba(52,211,153,0.3)' }}>
        Submit check-in →
      </button>
    </div>
  )
}

function MockupCard({ title, alt, index, reduced, device = 'desktop' }) {
  const mobile = device === 'mobile'

  return (
    <motion.article
      {...fadeUp(reduced, Math.min(index * 0.05, 0.25))}
      whileHover={reduced ? undefined : { y: -6, scale: 1.015, boxShadow: '0 32px 56px -8px rgba(15,23,42,0.5), 0 0 0 1px rgba(16,185,129,0.18), inset 0 1px 0 rgba(16,185,129,0.14)' }}
      className={`group relative overflow-hidden rounded-3xl border p-4 backdrop-blur transition duration-300 ${
        'border-slate-200 bg-white/90'
      }`}
      style={{
        boxShadow: '0 20px 40px -8px rgba(15,23,42,0.45), 0 8px 16px -6px rgba(15,23,42,0.3), inset 0 1px 0 rgba(16,185,129,0.08)',
      }}
      aria-label={alt}
    >
      {/* Ambient corner glow */}
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: 'radial-gradient(circle at 90% 8%, rgba(16,185,129,0.18) 0%, transparent 50%)' }} />
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 10% 90%, rgba(14,165,233,0.1) 0%, transparent 50%)' }} />

      {/* Device chrome */}
      <div className={`relative mb-3 rounded-2xl border ${'border-slate-200 bg-white/95'}`} style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(14,165,233,0.06), rgba(168,85,247,0.08))' }}>
        {!mobile ? (
          <div className="rounded-xl border border-slate-700/60 bg-[linear-gradient(150deg,#0c1628,#0e1e38_48%,#0d2236_72%,#0c1d2c)] p-2.5">
            {/* Browser chrome bar */}
            <div className="mb-2.5 flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-1.5">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-slate-900/60 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
                <div className="h-1.5 w-24 rounded-full bg-gradient-to-r from-emerald-400/60 via-sky-400/50 to-violet-400/50" />
              </div>
            </div>
            <MockupScreenContent title={title} />
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <div className="w-[175px] rounded-[26px] border border-slate-700/80 bg-[linear-gradient(180deg,#0e1e38,#0c1628)] p-3 shadow-[0_16px_48px_rgba(15,23,42,0.6)]">
              {/* Phone notch */}
              <div className="mx-auto mb-2.5 h-4 w-20 rounded-full bg-gradient-to-r from-emerald-400/50 to-sky-400/40" />
              <MockupMobileContent />
            </div>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-sm font-semibold ${'text-slate-900'}`}>{title}</div>
          <p className={`mt-0.5 text-xs leading-relaxed ${'text-slate-600'}`}>{alt}</p>
        </div>
        <div className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {mobile ? 'Mobile' : 'Preview'}
        </div>
      </div>
    </motion.article>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [loopActive, setLoopActive] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, loading: authLoading } = useAuth()

  const closeMobileMenu = () => setMobileMenuOpen(false)
  const navAction = (item) => {
    closeMobileMenu()
    if (item.route) {
      navigate(item.route)
      return
    }
    setTimeout(() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }), mobileMenuOpen ? 280 : 0)
  }

  const rootClasses = 'overflow-x-hidden bg-white text-slate-900'
  const sectionCard = 'border border-slate-200 bg-white/85 backdrop-blur'
  const ctaBase = 'inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50'
  const navTextClass = 'text-slate-600 hover:text-slate-900'

  const staggerParent = useMemo(() => ({
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.08 } },
  }), [reduced])

  return (
    <div className={rootClasses}>
      <Seo
        title="Start with Symptoms, Then Understand Your Labs | VITALOOP"
        description="VITALOOP starts with symptom intake, guides what to check next, and connects lab results to a practical weekly protocol and feedback loop."
        path="/"
        schemas={[SCHEMA_HOWTO, SCHEMA_FAQ]}
      />


      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(16,185,129,0.18),transparent_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_2%,rgba(59,130,246,0.12),transparent_38%)]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-4 sm:px-6">
          <button onClick={() => scrollToTop()} className="flex items-center gap-2">
            <BrandMark />
          </button>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((item) => (
              <button
                key={item.id}
                onClick={() => navAction(item)}
                className={`text-sm transition ${navTextClass}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Log in link — only for non-authenticated visitors; visibility keeps space reserved during auth check */}
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              style={{ visibility: (!authLoading && user) ? 'hidden' : 'visible' }}
              tabIndex={(!authLoading && user) ? -1 : 0}
              aria-hidden={(!authLoading && user) ? true : undefined}
            >
              Log in
            </button>

            {/* Cabinet / Sign Up button */}
            <button
              onClick={() => navigate(user ? '/dashboard' : '/login?signup=true')}
              className={`hidden sm:inline-flex ${ctaBase} border border-slate-300 bg-white text-slate-900 hover:border-emerald-300`}
            >
              {user ? 'Cabinet' : 'Sign Up'}
            </button>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Open navigation menu"
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile slide-down menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className={`border-t md:hidden ${'border-slate-200 bg-white'}`}
            >
              <div className="mx-auto flex max-w-[1240px] flex-col gap-1 px-4 py-4">
                {NAV_LINKS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navAction(item)}
                    className="rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {item.label}
                  </button>
                ))}
                <div className="my-2 h-px bg-slate-100" />
                {user ? (
                  <button
                    onClick={() => { closeMobileMenu(); navigate('/dashboard') }}
                    className="mt-1 w-full rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-400"
                  >
                    Cabinet
                  </button>
                ) : (
                  <div className="mt-1 flex flex-col gap-2">
                    <button
                      onClick={() => { closeMobileMenu(); navigate('/login?signup=true') }}
                      className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-400"
                    >
                      Sign Up — Free
                    </button>
                    <button
                      onClick={() => { closeMobileMenu(); navigate('/login') }}
                      className={`w-full rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      Log in
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        <LightHero />
        <StatsBar />

        <section className="mx-auto w-full max-w-[990px] px-4 pb-4 pt-10 sm:px-6 md:pt-14">
          <motion.div
            {...fadeUp(reduced)}
            className="overflow-hidden rounded-3xl border border-emerald-200 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,#ecfdf5,#ffffff_50%,#f8fafc)] p-6 md:p-8"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
              <Shield className="h-3.5 w-3.5" />
              Data safety
            </div>
            <h2 className="text-[26px] font-semibold tracking-tight text-slate-900 md:text-[32px]">
              How we store your data
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 md:text-base">
              VITALOOP applies HIPAA Security Rule-aligned safeguards across data storage, transmission, and access management. Controls are organized to mirror administrative, technical, and operational best practices used in healthcare workflows.
            </p>

            <div className="mt-4 inline-flex items-start gap-2 rounded-2xl border border-emerald-200/80 bg-white/90 px-4 py-3 text-sm text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                We do not sell, rent, or broker personal health data to advertisers or data marketplaces.
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: 'Technical safeguards',
                  body: 'Encryption in transit (TLS) and encrypted storage at rest for sensitive health records.',
                  icon: Lock,
                  tone: 'from-emerald-500/20 to-teal-500/10 text-emerald-700',
                },
                {
                  title: 'Access controls',
                  body: 'Role-based access and workspace isolation limit data visibility to authorized users only.',
                  icon: ShieldCheck,
                  tone: 'from-cyan-500/20 to-sky-500/10 text-cyan-700',
                },
                {
                  title: 'Audit controls',
                  body: 'System events are logged for traceability, review, and security investigations.',
                  icon: FileText,
                  tone: 'from-indigo-500/20 to-blue-500/10 text-indigo-700',
                },
                {
                  title: 'Administrative safeguards',
                  body: 'Documented security procedures, access governance, and periodic control reviews.',
                  icon: Clock3,
                  tone: 'from-amber-500/20 to-orange-500/10 text-amber-700',
                },
                {
                  title: 'Integrity and recovery',
                  body: 'Backups, reliability controls, and incident-response processes protect data continuity.',
                  icon: CheckCircle2,
                  tone: 'from-violet-500/20 to-fuchsia-500/10 text-violet-700',
                },
                {
                  title: 'Data subject rights',
                  body: 'Users can request data export or deletion and review policy terms at any time.',
                  icon: Shield,
                  tone: 'from-rose-500/20 to-pink-500/10 text-rose-700',
                },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <motion.div
                    key={item.title}
                    whileHover={reduced ? undefined : { y: -3, scale: 1.01 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="group relative overflow-hidden rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-[0_1px_0_rgba(16,185,129,0.08)]"
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_45%)]" />
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.tone} ring-1 ring-black/5`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 tracking-tight">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <div className="mt-5 inline-flex items-start gap-2 rounded-2xl border border-emerald-200/80 bg-white/90 px-4 py-3 text-sm text-slate-700">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Read our full Privacy Policy{' '}
                <a href="/privacy-policy" className="font-semibold text-emerald-700 underline-offset-2 hover:text-emerald-600 hover:underline">
                  here
                </a>
                .
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900">
              <p>VITALOOP is a wellness tool, not a medical device.</p>
              <p>We implement HIPAA-aligned safeguards; formal HIPAA obligations apply when required by customer context and agreements.</p>
              <p>Always consult qualified healthcare providers for medical decisions.</p>
            </div>
          </motion.div>
        </section>

        <section id="problem" className="mx-auto w-full max-w-[990px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className="mb-12 text-center">
            <motion.h2
              className="text-[32px] font-bold tracking-tight md:text-[40px]"
              initial={reduced ? false : { opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Your Doctor{' '}
              <span className="relative">
                <span className="bg-gradient-to-r from-rose-600 to-orange-600 bg-clip-text text-transparent">vs</span>
              </span>{' '}
              VITALOOP
            </motion.h2>
            <p className={`mx-auto mt-4 max-w-2xl text-lg ${'text-slate-600'}`}>
              Why this complements, not replaces, medical care
            </p>
            <p className={`mx-auto mt-6 max-w-3xl text-base ${'text-slate-600'}`}>
              VITALOOP is built to help you prepare better context, ask better questions, and follow a clearer execution loop between appointments. The goal is informed collaboration with your healthcare team.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2 mb-12">
            {/* Traditional Lab Report */}
            <div className="space-y-3">
              <motion.div
                {...fadeUp(reduced, 0.1)}
                className="text-center mb-6"
              >
                <span className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-bold uppercase tracking-wider text-slate-700">
                  📄 Lab Report
                </span>
              </motion.div>

              {[
                { icon: X, title: 'Time-limited context', stat: '•', label: 'Short visits can miss longitudinal patterns' },
                { icon: X, title: 'Fragmented information', stat: '•', label: 'Symptoms, labs, and habits often stay disconnected' },
                { icon: X, title: 'Unstructured follow-through', stat: '•', label: 'It is easy to leave without a clear weekly plan' },
              ].map((item, idx) => {
                const Icon = item.icon
                return (
                  <motion.article
                    key={item.title}
                    {...fadeUp(reduced, idx * 0.08 + 0.2)}
                    whileHover={reduced ? undefined : { scale: 1.02, x: -4 }}
                    className={`group relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5 ${'border-slate-200'}`}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />

                    <div className="relative grid grid-cols-[72px_1fr] items-center gap-4 sm:grid-cols-[88px_1fr]">
                      <motion.div
                        className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100"
                        whileHover={reduced ? {} : { rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        <Icon className="h-6 w-6 text-slate-400" />
                      </motion.div>

                      <div className="min-w-0 text-left">
                        <div className="flex items-baseline gap-2">
                          <div className="inline-flex w-4 shrink-0 justify-center text-lg font-bold text-slate-400">{item.stat}</div>
                          <h3 className="text-base font-bold leading-tight text-slate-900">{item.title}</h3>
                        </div>
                        <p className="mt-1 pl-6 text-sm text-slate-600">{item.label}</p>
                      </div>
                    </div>
                  </motion.article>
                )
              })}
            </div>

            {/* VITALOOP Solutions */}
            <div className="space-y-3">
              <motion.div
                {...fadeUp(reduced, 0.1)}
                className="text-center mb-6"
              >
                <span className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold uppercase tracking-wider text-emerald-700">
                  ✅ VITALOOP
                </span>
              </motion.div>

              {[
                { icon: TrendingUp, title: 'Structured intake', stat: '✓', label: 'Symptoms and context captured before analysis' },
                { icon: Clock3, title: 'Connected tracking', stat: '✓', label: 'Labs and weekly response stay in one timeline' },
                { icon: Sparkles, title: 'Execution clarity', stat: '✓', label: 'Prioritized actions you can actually follow' },
              ].map((item, idx) => {
                const Icon = item.icon
                return (
                  <motion.article
                    key={item.title}
                    {...fadeUp(reduced, idx * 0.08 + 0.2)}
                    whileHover={reduced ? undefined : { scale: 1.02, x: 4 }}
                    className={`group relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5 ${'border-emerald-200'}`}
                    style={{ boxShadow: '0 0 0 1px rgba(16,185,129,0.1)' }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-sky-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />

                    <div className="relative grid grid-cols-[72px_1fr] items-center gap-4 sm:grid-cols-[88px_1fr]">
                      <motion.div
                        className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-50 to-sky-50"
                        whileHover={reduced ? {} : { rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                      >
                        <motion.div
                          className="absolute inset-0 rounded-lg bg-emerald-400/20 blur-xl"
                          animate={reduced ? {} : { scale: [1, 1.15, 1], opacity: [0.5, 0.7, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                        />
                        <Icon className="relative h-6 w-6 text-emerald-600" />
                      </motion.div>

                      <div className="min-w-0 text-left">
                        <div className="flex items-baseline gap-2">
                          <div className="inline-flex w-4 shrink-0 justify-center text-xl font-bold text-emerald-500">{item.stat}</div>
                          <h3 className="text-base font-bold leading-tight text-slate-900">{item.title}</h3>
                        </div>
                        <p className="mt-1 pl-6 text-sm text-slate-600">{item.label}</p>
                      </div>
                    </div>
                  </motion.article>
                )
              })}
            </div>
          </div>

          <HowItWorksTimeline />
        </section>

        <section className="mx-auto w-full max-w-[990px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className="mb-7 text-center">
            <motion.h2
              className="text-[28px] font-semibold tracking-tight md:text-[34px]"
              initial={reduced ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Premium Features
            </motion.h2>
            <p className={`mt-3 text-[17px] leading-[1.7] ${'text-slate-600'}`}>
              Everything you need to optimize your health
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PREMIUM_FEATURES.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.article
                  key={feature.title}
                  {...fadeUp(reduced, index * 0.05)}
                  whileHover={reduced ? undefined : { y: -12, scale: 1.05, rotate: index % 2 === 0 ? 1 : -1 }}
                  className={`group relative flex h-full flex-col items-center overflow-hidden rounded-3xl border p-6 text-center sm:p-7 md:p-8 ${'border-slate-200 bg-white'}`}
                  style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.1), inset 0 1px 0 rgba(16,185,129,0.08)' }}
                >
                  {/* Animated gradient background */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-sky-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />

                  {/* Premium badge */}
                  <motion.span
                    className={`absolute right-4 top-4 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
                    whileHover={reduced ? {} : { scale: 1.1 }}
                  >
                    ✨ Premium
                  </motion.span>

                  {/* Large rotating icon */}
                  <motion.div
                    className="relative mb-6 flex h-24 w-24 items-center justify-center"
                    whileHover={reduced ? {} : { rotate: 360, scale: 1.2 }}
                    transition={{ duration: 0.8 }}
                  >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/20 to-sky-400/20 blur-2xl" />
                    <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl ${'bg-emerald-50'}`}>
                      <Icon className="h-8 w-8 text-emerald-600" />
                    </div>
                  </motion.div>

                  <h3 className="relative text-xl font-bold md:min-h-[96px]">{feature.title}</h3>
                  <p className={`relative mt-3 text-sm leading-6 md:min-h-[88px] ${'text-slate-600'}`}>{feature.body}</p>
                </motion.article>
              )
            })}
          </div>


        </section>

        <section id="why-vitaloop" className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className="mb-7 text-center">
            <motion.h2
              className="text-[28px] font-semibold tracking-tight md:text-[34px]"
              initial={reduced ? false : { opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Why{' '}
              <span className="relative">
                <span className="bg-gradient-to-r from-emerald-600 via-sky-600 to-violet-600 bg-clip-text text-transparent">
                  VITALOOP
                </span>
                <motion.span
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/20 via-sky-500/20 to-violet-500/20 blur-lg"
                  animate={reduced ? {} : { opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </span>
            </motion.h2>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit, idx) => {
              const Icon = benefit.icon
              return (
                <motion.article
                  key={benefit.title}
                  {...fadeUp(reduced, idx * 0.06)}
                  whileHover={reduced ? undefined : { y: -12, scale: 1.05, boxShadow: '0 0 0 4px rgba(16,185,129,0.15), 0 28px 48px -10px rgba(0,0,0,0.25)' }}
                  className={`group relative min-h-[240px] overflow-hidden rounded-3xl border p-8 text-center ${'border-slate-200 bg-white'}`}
                  style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08), inset 0 1px 0 rgba(16,185,129,0.08)' }}
                >
                  {/* Animated gradient on hover */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-sky-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />

                  {/* Large animated icon */}
                  <motion.div
                    className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center"
                    whileHover={reduced ? {} : { rotate: [0, -10, 10, -5, 5, 0], scale: 1.15 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/20 to-sky-400/20 blur-xl" />
                    <Icon className="relative h-10 w-10 text-emerald-500" />
                  </motion.div>

                  {/* Large stat */}
                  <motion.div
                    className="relative mb-3 text-4xl font-bold text-emerald-600"
                    initial={reduced ? false : { opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                  >
                    {benefit.stat}
                  </motion.div>

                  <div className="relative text-xs font-semibold uppercase tracking-wider text-emerald-700">{benefit.label}</div>
                  <h3 className="relative mt-3 text-lg font-semibold">{benefit.title}</h3>
                  <p className={`relative mt-2 text-sm ${'text-slate-600'}`}>{benefit.body}</p>
                </motion.article>
              )
            })}
          </div>
        </section>

        <InteractivePricing />

        <TestimonialsCarousel />

        {/* === Blog teaser === */}
        <section aria-label="Health intelligence resources" className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6">
          <motion.div {...fadeUp(reduced)} className={`rounded-3xl border p-6 md:p-8 ${sectionCard}`}>
            <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${'text-emerald-700'}`}>Health Intelligence Hub</p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Guides for symptom-first health decisions</h2>
                <p className={`mt-2 max-w-xl text-sm leading-relaxed ${'text-slate-600'}`}>
                  Learn how to frame symptoms, prepare for lab discussions, and turn results into a repeatable protocol loop. The hub extends product logic into practical education.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate('/how-it-works')}
                    className={`${ctaBase} shrink-0 ${'bg-slate-900 text-white hover:bg-slate-700'}`}
                  >
                    Explore guides
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                  <button
                    onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                    className={`${ctaBase} shrink-0 ${'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}
                  >
                    Compare plans
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {HUB_GUIDES.map((guide, idx) => {
                  const Icon = guide.icon
                  return (
                    <motion.article
                      key={guide.title}
                      {...fadeUp(reduced, idx * 0.05)}
                      className={`rounded-3xl border p-6 ${'border-slate-200 bg-white/90'}`}
                    >
                      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${'bg-emerald-50 text-emerald-700'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <h3 className="mt-4 text-base font-semibold">{guide.title}</h3>
                      <p className={`mt-2 text-sm leading-relaxed ${'text-slate-600'}`}>{guide.body}</p>
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
            className={`rounded-3xl border p-6 text-center md:p-10 ${sectionCard}`}
          >
            <h2 className="text-[28px] font-semibold tracking-tight">The Adaptive Health Loop</h2>
            <p className={`mx-auto mt-3 max-w-3xl text-[17px] leading-[1.7] ${'text-slate-600'}`}>
              Health optimization is a continuous cycle, not a one-time interpretation. VITALOOP connects symptoms, labs, protocol actions, and weekly feedback so each cycle becomes more informed than the previous one.
            </p>
            <ol className="mx-auto mt-7 max-w-5xl space-y-3 text-left">
              {LOOP_FLOW.map((item, idx) => {
                const Icon = item.icon
                return (
                  <motion.li
                    key={item.title}
                    animate={loopActive && !reduced ? { x: [0, 6, 0] } : { x: 0 }}
                    transition={{ duration: 0.55, delay: idx * 0.08, ease: 'easeInOut' }}
                    className={`rounded-2xl border px-4 py-4 sm:px-5 ${'border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-start gap-4">
                      <span className={`mt-0.5 inline-flex h-9 min-w-9 items-center justify-center rounded-full border text-sm font-semibold ${'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${'bg-emerald-50 text-emerald-700'}`}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <h3 className="text-base font-semibold leading-tight sm:text-lg">{item.title}</h3>
                        </div>
                        <p className={`mt-2 text-sm leading-relaxed ${'text-slate-600'}`}>{item.body}</p>
                        <p className={`mt-1 text-xs leading-relaxed ${'text-slate-500'}`}>{item.detail}</p>
                      </div>
                    </div>
                  </motion.li>
                )
              })}
            </ol>
          </motion.div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-10 sm:px-6 md:pb-28 md:pt-16">
          <motion.div {...fadeUp(reduced)} className={`rounded-3xl border p-6 text-center md:p-10 ${sectionCard}`}>
            <h2 className="text-[28px] font-semibold tracking-tight">Start with symptoms. Build your personalized loop.</h2>
            <p className={`mx-auto mt-3 max-w-2xl text-[17px] leading-[1.7] ${'text-slate-600'}`}>
              Move from uncertainty to a clear plan with symptom intake, lab interpretation, and adaptive weekly execution.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => navigate('/login?signup=true')} className={`${ctaBase} ${'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}>
                Start with symptoms
              </button>
              <button onClick={() => navigate('/upload')} className={`${ctaBase} ${'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}>
                Upload lab results
              </button>
              <a href="/help" className={`${ctaBase} ${'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}>
                Help Center
              </a>
            </div>
          </motion.div>
        </section>

        <AnimatedFAQ />
      </main>

      <Footer />
    </div>
  )
}
