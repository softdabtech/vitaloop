import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
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
    title: 'Smart Protocol Engine',
    description: 'Get personalized supplement, nutrition, and lifestyle recommendations ranked by predicted impact on your specific biomarkers.',
    details: ['Personalized rankings', 'Evidence-based recs', 'Adherence tracking', 'Protocol adaptation'],
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
    title: 'AI Health Coaching',
    description: 'Chat with AI-powered guidance personalized to your biomarkers. Get answers to questions about your results in real-time.',
    details: ['Natural language Q&A', 'Biomarker context', 'Evidence-based answers', 'Protocol guidance'],
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Deep dive into your biomarker correlations, patterns, and predictive indicators. Understand what drives your health outcomes.',
    details: ['Correlation analysis', 'Predictive scoring', 'Pattern detection', 'Risk assessment'],
  },
  {
    icon: Lock,
    title: 'Clinician Sharing',
    description: 'Securely share your results with practitioners. They can add annotations and collaborate on protocol adjustments.',
    details: ['Token-based access', 'Expiring links', 'Comment threads', 'Audit logs'],
  },
  {
    icon: FileText,
    title: 'Clinical Reports',
    description: 'Generate beautiful, practitioner-ready PDF reports of your results, trends, and protocol recommendations.',
    details: ['Auto-generated PDFs', 'FHIR export', 'Trending visualizations', 'Professional formatting'],
  },
  {
    icon: Users,
    title: 'Practitioner Tools',
    description: 'Manage multiple patients in one dashboard. Annotate results, batch-send recommendations, and track adherence easily.',
    details: ['Patient management', 'Batch operations', 'Annotation system', 'Performance metrics'],
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'HIPAA-compliant, encrypted storage. Control who accesses your data with granular permissions and audit logs.',
    details: ['HIPAA compliance', 'AES-256 encryption', 'Access controls', 'Compliance audits'],
  },
  {
    icon: CheckCircle2,
    title: 'Social Sharing',
    description: 'Share your health wins with friends. Track streaks, earn achievements, and stay motivated with the community.',
    details: ['Social cards', 'Achievement badges', 'Streak tracking', 'Friend comparison'],
  },
]

export default function Features() {
  const navigate = useNavigate()

  return (
    <>
      <Seo
        title="Features - Symptom-First Health Workflow | VITALOOP"
        description="Explore how VITALOOP connects symptom intake, lab interpretation, protocol execution, and weekly adaptation in one continuous workflow."
      />

      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-6">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <ArrowLeft size={16} />
              Back to home
            </button>
          </div>
        </div>

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
              <span className="text-sm font-semibold text-slate-900">12 Powerful Features</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Everything You Need for a Symptom-First Health Loop
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              From guided symptom intake to lab interpretation and adaptive protocol execution, VITALOOP keeps your health workflow structured and consistent.
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
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
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
              Ready to take control of your health?
            </h2>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Start with a free account and upload your first lab report. No credit card required.
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
