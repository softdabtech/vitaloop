import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageHeader } from '../components/landing/PageHeader.jsx'
import {
  BrainCircuit,
  TrendingUp,
  Sparkles,
  HeartPulse,
  Lock,
  Clock3,
  LayoutDashboard,
  CheckCircle2,
  Zap,
  BarChart3,
  Users,
  Shield,
  FileText,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'

const FEATURES = [
  {
    icon: BrainCircuit,
    title: 'Symptom-First Intake',
    description: 'Begin with symptoms, timing, and context before reviewing labs so your plan starts from what you actually feel.',
    details: ['Guided symptom intake', 'Focused follow-up questions', 'Context-first workflow', 'Structured case notes'],
  },
  {
    icon: TrendingUp,
    title: 'Lab Direction Framework',
    description: 'Get a practical map of what may be useful to check next and why it matters before your next discussion with a clinician.',
    details: ['Biomarker category guidance', 'Priority ordering', 'Question prep for appointments', 'Action-ready summaries'],
  },
  {
    icon: Sparkles,
    title: 'Personalized Action Plan',
    description: 'Turn symptom and biomarker context into organized nutrition, supplement, lifestyle, and retest discussion points.',
    details: ['Prioritized actions', 'Plain-language rationale', 'Adherence tracking', 'Retest planning'],
  },
  {
    icon: HeartPulse,
    title: 'Weekly Check-ins',
    description: 'Stay connected with weekly prompts on energy, sleep, mood, and adherence. Your responses refine the protocol between lab tests.',
    details: ['Symptom logging', 'Lifestyle tracking', 'Progress monitoring', 'Engagement gamification'],
  },
  {
    icon: LayoutDashboard,
    title: 'Personal Dashboard',
    description: 'Central hub for your health data. See your health score, latest biomarkers, current protocol, and upcoming milestones at a glance.',
    details: ['Health score', 'Biomarker cards', 'Protocol overview', 'Insights & alerts'],
  },
  {
    icon: Zap,
    title: 'Contextual AI Guidance',
    description: 'Ask questions about your results and receive educational explanations grounded in your available symptom and lab context.',
    details: ['Natural-language Q&A', 'Biomarker context', 'Educational explanations', 'Safety reminders'],
  },
  {
    icon: BarChart3,
    title: 'Trends and Progress',
    description: 'Compare repeated uploads and weekly check-ins to see how biomarkers, symptoms, and adherence change over time.',
    details: ['Timeline views', 'Retest comparisons', 'Symptom tracking', 'Progress summaries'],
  },
  {
    icon: Lock,
    title: 'Practitioner Collaboration',
    description: 'Keep results and progress organized so a qualified practitioner can review the same structured context with you.',
    details: ['Readable summaries', 'Client workspaces', 'Progress context', 'Clear follow-up'],
  },
  {
    icon: FileText,
    title: 'Structured Reports',
    description: 'Review normalized values, priority markers, explanations, and next-step questions in a consistent report format.',
    details: ['Normalized values', 'Priority findings', 'Trend visualizations', 'Discussion points'],
  },
  {
    icon: Users,
    title: 'Practitioner Tools',
    description: 'Manage client workspaces, review symptom and lab context, assign actions, and monitor follow-up progress.',
    details: ['Client management', 'Assignment workflows', 'Progress review', 'Workspace controls'],
  },
  {
    icon: Shield,
    title: 'Privacy and Access Controls',
    description: 'Sensitive information is protected with encrypted transport, access controls, and isolated user workspaces.',
    details: ['TLS in transit', 'Encrypted storage', 'Access controls', 'Audit visibility'],
  },
  {
    icon: CheckCircle2,
    title: 'Repeatable Health Loop',
    description: 'Keep symptoms, lab uploads, action plans, check-ins, and retests connected instead of starting over each time.',
    details: ['Persistent context', 'Weekly check-ins', 'Retest cycles', 'Next-step continuity'],
  },
]

export default function Features() {
  const navigate = useNavigate()

  return (
    <>
      <Seo
        title="AI Blood Test Analysis Features | VITALOOP"
        description="Explore symptom intake, AI blood test analysis, biomarker explanations, personalized action plans, weekly check-ins, and progress tracking."
        path="/features"
      />

      <div className="min-h-screen bg-white">
        <PageHeader />

        {/* Hero Section */}
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
              <Sparkles size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-slate-900">One Connected Health Workflow</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Understand Symptoms and Blood Tests in One Place
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Organize how you feel, understand blood test results, prepare better questions, and track what changes over time.
            </p>
          </motion.div>
        </div>

        {/* Features Grid */}
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-12">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                  viewport={{ once: true }}
                  className="rounded-[28px] border border-slate-200 bg-white p-8 hover:shadow-lg hover:border-slate-300 transition"
                >
                  <div className="mb-4 inline-flex rounded-2xl bg-emerald-100 p-4 text-emerald-600">
                    <Icon size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h2>
                  <p className="text-slate-600 mb-6">{feature.description}</p>
                  <ul className="space-y-2">
                    {feature.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="rounded-[34px] bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 p-12 sm:p-16 text-center"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Ready for a clearer next step?
            </h2>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Start with symptoms or upload a blood test report. No credit card required.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-lg font-bold text-white hover:bg-emerald-700 transition shadow-lg"
            >
              Get Started Free
              <span>→</span>
            </button>
          </motion.div>
        </div>
      </div>
    </>
  )
}
