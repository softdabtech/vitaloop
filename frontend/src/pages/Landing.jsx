import { useMemo, useState } from 'react'

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
  Users,
  X,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'
import { AnimatedHero } from '../components/landing/AnimatedHero.jsx'
import { TrustedServicesSection } from '../components/landing/TrustedServicesSection.jsx'
import { HowItWorksTimeline } from '../components/landing/HowItWorksTimeline.jsx'
import { TestimonialsCarousel } from '../components/landing/TestimonialsCarousel.jsx'
import { InteractivePricing } from '../components/landing/InteractivePricing.jsx'
import { AnimatedFAQ } from '../components/landing/AnimatedFAQ.jsx'

const NAV_LINKS = [
  { id: 'how-it-works', label: 'Product' },
  { id: 'why-vitaloop', label: 'Features' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'testimonials', label: 'Stories' },
  { id: 'traction', label: 'Investors' },
  { id: 'faq', label: 'FAQ' },
  { id: 'for-nutritionists', label: 'For Nutritionists', route: '/for-nutritionists' },
]

const STEPS = [
  { icon: Upload, title: 'Upload', body: 'Drop your lab PDF' },
  { icon: BrainCircuit, title: 'AI Analysis', body: '85+ biomarkers extracted' },
  { icon: Sparkles, title: 'Get Protocol', body: 'Personalized action plan' },
  { icon: HeartPulse, title: 'Track Progress', body: 'Weekly check-ins' },
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
    stat: '<60s',
    label: 'Analysis'
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
    title: 'Biomarker Timeline',
    body: 'Track all markers over time',
    icon: TrendingUp,
  },
  {
    title: 'AI Protocol',
    body: 'Ranked action items',
    icon: Sparkles,
  },
  {
    title: 'Weekly Check-ins',
    body: 'Adaptive adjustments',
    icon: HeartPulse,
  },
  {
    title: 'Practitioner CRM',
    body: 'Client management',
    icon: Users,
  },
]

const PLAN_DETAILS = {
  Free: {
    eyebrow: 'Validate the experience',
    description: 'For first-time users who want to upload one report, see the dashboard structure, and understand how VITALOOP turns raw biomarker values into usable context.',
    idealFor: 'Best for: trying your first blood test interpretation without commitment.',
  },
  'Personal Premium': {
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
  { title: 'Dashboard', alt: 'Health Score 78/100 with biomarker priority flags and weekly adherence trend.', device: 'desktop' },
  { title: 'Lab Upload', alt: 'Upload workspace with PDF intake, OCR progress, and 54 biomarkers extracted.', device: 'desktop' },
  { title: 'Lab Results', alt: 'Structured biomarker table with severity chips, reference ranges, and trend arrows.', device: 'desktop' },
  { title: 'Personalized Protocol', alt: 'AI protocol plan with ranked supplements, nutrition targets, and weekly tasks.', device: 'desktop' },
  { title: 'Timeline', alt: 'Longitudinal trend chart showing ferritin, CRP, and vitamin D across 5 test cycles.', device: 'desktop' },
  { title: 'Practitioner CRM', alt: 'Practitioner CRM with 3 client panels, adherence bars, and assignment overview.', device: 'desktop' },
  { title: 'Weekly Check-in', alt: 'Mobile weekly check-in with energy, sleep, and symptom sliders plus streak badge.', device: 'mobile' },
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
    question: 'How does VITALOOP compare with LabCorp MyChart, Everlywell, Levels, and Function Health?',
    answer: 'Those platforms focus on record delivery, diagnostics access, or single-domain tracking. VITALOOP focuses on longitudinal decision-making and execution: prioritized protocol actions, weekly adherence loops, and practitioner workflows in one operating system.',
  },
  {
    question: 'Can practitioners use VITALOOP for client management?',
    answer: 'Yes. The Enterprise plan includes a full Practitioner CRM with multi-client dashboards, assignment workflows, protocol templates, and trend visibility — enabling functional medicine practitioners and health coaches to manage dozens of clients efficiently.',
  },
  {
    question: 'How much does VITALOOP cost?',
    answer: 'VITALOOP offers a free plan with 1 active upload and a core dashboard. Personal Premium is $9.99/month (or $95/year) and includes unlimited uploads, personalized AI protocols, and weekly check-ins. Enterprise plans start at $99/month for practitioner teams.',
  },
]

const SCHEMA_HOWTO = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Analyze Blood Test Results With AI Using VITALOOP',
  description: 'Upload your lab report and receive AI-powered biomarker analysis in under 60 seconds. Full personalized protocol and weekly adaptive loop are available on paid plans.',
  totalTime: 'PT1M',
  estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: '0' },
  step: [
    { '@type': 'HowToStep', name: 'Upload your lab report', text: 'Drop a PDF or image of your blood test results into VITALOOP. Supported formats include any standard laboratory PDF or photo.', position: 1 },
    { '@type': 'HowToStep', name: 'AI extracts and normalizes biomarkers', text: 'Our AI engine uses OCR to extract all biomarker values and normalizes them across units and reference ranges automatically.', position: 2 },
    { '@type': 'HowToStep', name: 'Signal mapping and pattern detection', text: 'Deficiencies, elevations, and cross-biomarker correlations are surfaced and ranked by clinical significance.', position: 3 },
    { '@type': 'HowToStep', name: 'Unlock your personalized protocol', text: 'Paid plans unlock a targeted protocol with supplement recommendations, nutrition actions, and weekly assignments tied to your biomarkers.', position: 4 },
    { '@type': 'HowToStep', name: 'Track progress with adaptive check-ins', text: 'Paid plans include weekly AI check-ins and adaptation between lab cycles based on adherence and biomarker trends.', position: 5 },
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
      name: 'Personal Premium',
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
      name: 'Personal Premium',
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
            <div className="text-[9px] text-slate-500">Extracting biomarkers…</div>
          </div>
        </div>
      </div>
      {/* OCR progress */}
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
  const [pricingMode, setPricingMode] = useState('monthly')
  const [loopActive, setLoopActive] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user } = useAuth()

  const closeMobileMenu = () => setMobileMenuOpen(false)
  const navAction = (item) => {
    closeMobileMenu()
    if (item.route) {
      navigate(item.route)
      return
    }
    setTimeout(() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }), mobileMenuOpen ? 280 : 0)
  }

  const pricingCards = PRICING[pricingMode]

  const rootClasses = 'bg-white text-slate-900'
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
        title="Interpret Blood Test Results with AI | VITALOOP"
        description="Analyze blood test results with AI in under 60 seconds. Upload your lab PDF, see prioritized biomarkers, and start a personalized weekly protocol for free."
        path="/"
        schemas={[SCHEMA_HOWTO, SCHEMA_FAQ]}
      />


      {/* Animated hero background */}
      <motion.div
        className="pointer-events-none fixed inset-0 -z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(16,185,129,0.18),transparent_42%)]"
          initial={{ scale: 0.98, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2 }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_90%_2%,rgba(59,130,246,0.12),transparent_38%)]"
          initial={{ scale: 1.04, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.4 }}
        />
      </motion.div>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
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
                onClick={() => navAction(item)}
                className={`text-sm transition ${navTextClass}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Log in link — only for non-authenticated visitors */}
            {!user && (
              <button
                onClick={() => navigate('/login')}
                className="hidden sm:inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Log in
              </button>
            )}

            {/* Cabinet / Sign Up button */}
            <button
              onClick={() => navigate(user ? '/dashboard' : '/login?signup=true')}
              className={`${ctaBase} border border-slate-300 bg-white text-slate-900 hover:border-emerald-300`}
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
        <AnimatedHero />

        <section id="problem" className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
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
              What they say vs what you actually need
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2 mb-12">
            {/* Traditional Problems */}
            <div className="space-y-4">
              <motion.div
                {...fadeUp(reduced, 0.1)}
                className="text-center mb-6"
              >
                <span className="inline-flex rounded-full bg-rose-100 px-4 py-2 text-sm font-bold uppercase tracking-wider text-rose-700">
                  ❌ Traditional Labs
                </span>
              </motion.div>

              {[
                { icon: X, title: 'No priority', stat: '0', label: 'Which marker to fix first?' },
                { icon: X, title: 'No history', stat: '0', label: 'No trend tracking' },
                { icon: X, title: 'No execution', stat: '0', label: 'Just reference ranges' },
              ].map((item, idx) => {
                const Icon = item.icon
                return (
                  <motion.article
                    key={item.title}
                    {...fadeUp(reduced, idx * 0.08 + 0.2)}
                    whileHover={reduced ? undefined : { scale: 1.02, x: -4 }}
                    className={`group relative overflow-hidden rounded-2xl border bg-white p-6 ${'border-rose-200'}`}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-orange-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />

                    <div className="relative flex items-start gap-4">
                      <motion.div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-rose-50"
                        whileHover={reduced ? {} : { rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        <Icon className="h-7 w-7 text-rose-500" />
                      </motion.div>

                      <div className="flex-1 pt-1">
                        <div className="text-2xl font-bold text-rose-600">{item.stat}</div>
                        <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                        <p className="mt-1 text-xs text-slate-600">{item.label}</p>
                      </div>
                    </div>
                  </motion.article>
                )
              })}
            </div>

            {/* VITALOOP Solutions */}
            <div className="space-y-4">
              <motion.div
                {...fadeUp(reduced, 0.1)}
                className="text-center mb-6"
              >
                <span className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold uppercase tracking-wider text-emerald-700">
                  ✅ VITALOOP
                </span>
              </motion.div>

              {[
                { icon: TrendingUp, title: 'Clear priorities', stat: '01', label: 'Top 3 problems ranked by impact' },
                { icon: Clock3, title: 'Trends over time', stat: '5+', label: 'Every test compared to previous' },
                { icon: Sparkles, title: 'Exact protocol', stat: '7 dy', label: 'Know what to do and when' },
              ].map((item, idx) => {
                const Icon = item.icon
                return (
                  <motion.article
                    key={item.title}
                    {...fadeUp(reduced, idx * 0.08 + 0.2)}
                    whileHover={reduced ? undefined : { scale: 1.02, x: 4 }}
                    className={`group relative overflow-hidden rounded-2xl border bg-white p-6 ${'border-emerald-200'}`}
                    style={{ boxShadow: '0 0 0 1px rgba(16,185,129,0.1)' }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-sky-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />

                    <div className="relative flex items-start gap-4">
                      <motion.div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50"
                        whileHover={reduced ? {} : { rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                      >
                        <motion.div
                          className="absolute inset-0 rounded-xl bg-emerald-400/20 blur-xl"
                          animate={reduced ? {} : { scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                        />
                        <Icon className="relative h-7 w-7 text-emerald-600" />
                      </motion.div>

                      <div className="flex-1 pt-1">
                        <div className="text-2xl font-bold text-emerald-600">{item.stat}</div>
                        <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                        <p className="mt-1 text-xs text-slate-600">{item.label}</p>
                      </div>
                    </div>
                  </motion.article>
                )
              })}
            </div>
          </div>

          <motion.div {...fadeUp(reduced)} className="mb-12 text-center">
            <motion.h2
              className="text-[32px] font-bold tracking-tight md:text-[40px]"
              initial={reduced ? false : { opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              From PDF to personalized protocol in{' '}
              <span className="relative">
                <span className="bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">4 steps</span>
              </span>
            </motion.h2>
            <p className={`mx-auto mt-4 max-w-2xl text-lg ${'text-slate-600'}`}>
              Upload your lab report, get AI analysis, execute protocol, track weekly progress
            </p>
          </motion.div>

          <motion.div variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-10% 0px -10% 0px' }} className="relative">
            {/* Visual timeline connector */}
            <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-1 -translate-x-1/2 md:block">
              <motion.div
                className="h-full w-full rounded-full bg-gradient-to-b from-emerald-400 via-sky-400 to-violet-400 opacity-20"
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
              />
            </div>

            <div className="grid gap-6 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, idx) => {
                const Icon = step.icon
                return (
                  <motion.article
                    key={step.title}
                    variants={fadeUp(reduced, idx * 0.04)}
                    whileHover={reduced ? undefined : { y: -8, scale: 1.05 }}
                    className={`group relative z-10 overflow-hidden rounded-2xl border p-6 text-center transition ${'border-slate-200 bg-white'}`}
                    style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08), inset 0 1px 0 rgba(16,185,129,0.08)' }}
                  >
                    {/* Step number badge */}
                    <motion.div
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-400 text-[10px] font-bold text-white shadow-lg"
                      whileHover={reduced ? {} : { rotate: 360 }}
                      transition={{ duration: 0.5 }}
                    >
                      {idx + 1}
                    </motion.div>

                    {/* Animated gradient background on hover */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-sky-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />

                    {/* Icon with pulse effect */}
                    <motion.div
                      className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center"
                      whileHover={reduced ? {} : { scale: 1.1 }}
                      transition={{ duration: 0.4 }}
                    >
                      <motion.div
                        className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl"
                        animate={reduced ? {} : { scale: [1, 1.15, 1], opacity: [0.5, 0.7, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                      />
                      <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50">
                        <Icon className="h-6 w-6 text-emerald-600" />
                      </div>
                    </motion.div>

                    <h3 className="relative text-base font-bold">{step.title}</h3>
                    <p className={`relative mt-2 text-xs ${'text-slate-600'}`}>{step.body}</p>

                    {/* Animated arrow for non-last items */}
                    {idx < STEPS.length - 1 && (
                      <motion.div
                        className="absolute -right-4 top-1/2 hidden -translate-y-1/2 lg:block"
                        animate={reduced ? {} : { x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowRight className="h-8 w-8 text-emerald-400/50" />
                      </motion.div>
                    )}
                  </motion.article>
                )
              })}
            </div>
          </motion.div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
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

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PREMIUM_FEATURES.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.article
                  key={feature.title}
                  {...fadeUp(reduced, index * 0.05)}
                  whileHover={reduced ? undefined : { y: -12, scale: 1.05, rotate: index % 2 === 0 ? 1 : -1 }}
                  className={`group relative flex flex-col items-center overflow-hidden rounded-3xl border p-8 text-center ${'border-slate-200 bg-white'}`}
                  style={{ boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.1), inset 0 1px 0 rgba(16,185,129,0.08)' }}
                >
                  {/* Animated gradient background */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-sky-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
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

                  <h3 className="relative text-xl font-bold">{feature.title}</h3>
                  <p className={`relative mt-3 text-sm ${'text-slate-600'}`}>{feature.body}</p>
                </motion.article>
              )
            })}
          </div>


        </section>

        <HowItWorksTimeline />

        <section id="why-vitaloop" className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
          <motion.div {...fadeUp(reduced)} className="mb-7">
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

        <section id="traction" className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 md:py-10">
          <motion.div {...fadeUp(reduced)} className={`rounded-3xl border p-6 md:p-8 ${sectionCard}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${'text-emerald-700'}`}>Traction</p>
              <button
                onClick={() => navigate('/for-investors')}
                className={`text-xs font-semibold uppercase tracking-[0.16em] ${'text-emerald-700 hover:text-emerald-600'}`}
              >
                Open full investor page
              </button>
            </div>

            <div className={`mt-4 rounded-3xl border p-5 md:p-6 ${'border-slate-200 bg-white'}`}>
              <p className={`text-sm leading-relaxed ${'text-slate-700'}`}>
                Built by Alex Bombela - founder at SoftDAB Tech, building AI infrastructure products and leading VITALOOP execution.
                {' '}
                <a
                  href="https://www.linkedin.com/in/aleksey-bombela/"
                  target="_blank"
                  rel="noreferrer"
                  className={`${'text-emerald-700 hover:text-emerald-600'} font-semibold`}
                >
                  LinkedIn
                </a>
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-2xl border px-4 py-3 ${'border-slate-200 bg-slate-50'}`}>
                  <div className={`text-[11px] uppercase tracking-[0.16em] ${'text-slate-500'}`}>Early access</div>
                  <div className="mt-1 text-sm font-semibold">10 users</div>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${'border-slate-200 bg-slate-50'}`}>
                  <div className={`text-[11px] uppercase tracking-[0.16em] ${'text-slate-500'}`}>Lab integrations</div>
                  <div className="mt-1 text-sm font-semibold">Quest, LabCorp, +50 formats</div>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${'border-slate-200 bg-slate-50'}`}>
                  <div className={`text-[11px] uppercase tracking-[0.16em] ${'text-slate-500'}`}>Launch and stack</div>
                  <div className="mt-1 text-sm font-semibold">Launch: May 2026 · FastAPI + Claude AI + Supabase</div>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${'border-slate-200 bg-slate-50'}`}>
                  <div className={`text-[11px] uppercase tracking-[0.16em] ${'text-slate-500'}`}>Contact</div>
                  <a href="mailto:bombela@softdab.tech" className={`mt-1 inline-flex text-sm font-semibold ${'text-emerald-700 hover:text-emerald-600'}`}>
                    bombela@softdab.tech
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <TestimonialsCarousel />

        <AnimatedFAQ />

        {/* === Blog teaser === */}
        <section aria-label="Health intelligence resources" className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6">
          <motion.div {...fadeUp(reduced)} className={`rounded-3xl border p-6 md:p-8 ${sectionCard}`}>
            <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${'text-emerald-700'}`}>Health Intelligence Hub</p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Guides on Biomarker Interpretation & Biohacking</h2>
                <p className={`mt-2 max-w-xl text-sm leading-relaxed ${'text-slate-600'}`}>
                  Deep dives on reading blood test results, optimizing ferritin, testosterone, cortisol, and building a sustainable biohacking protocol. The guides page now acts like an extension of the product, not a disconnected document dump.
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
            <h2 className="text-[28px] font-semibold tracking-tight">The Biohacking Feedback Loop: How Longitudinal Lab Tracking Works</h2>
            <p className={`mt-3 max-w-3xl text-[17px] leading-[1.7] ${'text-slate-600'}`}>
              Biohacking is not a one-time blood test — it is a continuous feedback cycle. VITALOOP makes that loop automatic: data → AI insight → action protocol → weekly check-in → next lab upload. Each cycle makes the next one smarter.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
              {LOOP_FLOW.map((item, idx) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="relative">
                    {idx < LOOP_FLOW.length - 1 && (
                      <motion.div
                        aria-hidden="true"
                        animate={loopActive && !reduced ? { opacity: [0.25, 1, 0.4], scaleX: [0.92, 1, 0.96] } : { opacity: 0.28, scaleX: 1 }}
                        transition={{ duration: 0.8, delay: idx * 0.14, ease: 'easeInOut' }}
                        className={`absolute left-[calc(50%+36px)] top-9 hidden h-px w-[calc(100%-12px)] origin-left xl:block ${'bg-gradient-to-r from-emerald-500/80 to-slate-300/20'}`}
                      />
                    )}
                    <motion.article
                      animate={loopActive && !reduced ? { y: [0, -8, 0], scale: [1, 1.02, 1] } : { y: 0, scale: 1 }}
                      transition={{ duration: 0.75, delay: idx * 0.14, ease: 'easeInOut' }}
                      className={`relative h-full rounded-[28px] border px-4 py-5 ${'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${'bg-emerald-50 text-emerald-700'}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${'text-emerald-700'}`}>0{idx + 1}</span>
                      </div>
                      <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                      <p className={`mt-2 text-sm leading-relaxed ${'text-slate-600'}`}>{item.body}</p>
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
            <p className={`mx-auto mt-3 max-w-2xl text-[17px] leading-[1.7] ${'text-slate-600'}`}>
              Replace guesswork with AI-powered biomarker analysis and personalized protocols. Free to start, no credit card required.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => navigate('/login?signup=true')} className={`${ctaBase} ${'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}>
                Create free account
              </button>
              <button onClick={() => navigate('/how-it-works')} className={`${ctaBase} ${'border border-slate-300 bg-white text-slate-900 hover:border-emerald-300'}`}>
                Explore product
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className={`border-t ${'border-slate-200 bg-white'} py-10`}>
        <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 text-sm sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/90 text-white">
                <HeartPulse className="h-5 w-5" />
              </span>
              <span className="text-base font-semibold tracking-tight">VITALOOP</span>
            </div>
            <p className={`mt-4 max-w-md leading-relaxed ${'text-slate-500'}`}>
              AI lab analysis, personalized protocols, and longitudinal biomarker tracking for people who want a repeatable health system instead of one-off interpretations.
            </p>
            <p className={`mt-4 text-xs uppercase tracking-[0.16em] ${'text-slate-400'}`}>Not medical advice. Always work with a qualified clinician for diagnosis and treatment decisions.</p>
            <div className="mt-6 flex flex-col items-start gap-2">
              <a
                href="mailto:info@softdab.tech"
                className={`text-left underline-offset-2 hover:underline ${'text-slate-500'}`}
              >
                info@softdab.tech
              </a>
              <p className={`text-left ${'text-slate-400'}`}>
                © 2026 VITALOOP. Made by{' '}
                <a
                  href="https://softdab.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${'text-emerald-700 hover:text-emerald-600'} underline-offset-2 hover:underline`}
                >
                  SoftDAB
                </a>
              </p>
            </div>
          </div>

          <div>
            <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${'text-emerald-700'}`}>Product</div>
            <div className="mt-4 flex flex-col gap-3">
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className={`text-left underline-offset-2 hover:underline ${'text-slate-500'}`}>How it works</button>
              <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className={`text-left underline-offset-2 hover:underline ${'text-slate-500'}`}>Pricing</button>
              <button onClick={() => navigate('/how-it-works')} className={`text-left underline-offset-2 hover:underline ${'text-slate-500'}`}>Health Intelligence Hub</button>
            </div>
          </div>

          <div>
            <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${'text-emerald-700'}`}>Company</div>
            <div className="mt-4 flex flex-col items-start gap-3 text-left">
              <button onClick={() => navigate('/for-nutritionists')} className={`text-left underline-offset-2 hover:underline ${'text-slate-500'}`}>For Nutritionists</button>
              <button onClick={() => navigate('/terms')} className={`text-left underline-offset-2 hover:underline ${'text-slate-500'}`}>Terms</button>
              <button onClick={() => navigate('/privacy')} className={`text-left underline-offset-2 hover:underline ${'text-slate-500'}`}>Privacy</button>
              <button onClick={() => navigate('/for-investors')} className={`text-left underline-offset-2 hover:underline ${'text-slate-500'}`}>For Investors</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
