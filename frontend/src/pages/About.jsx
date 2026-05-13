import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Lock,
  Users,
  Zap,
  Microscope,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import Seo from '../components/Seo.jsx'

const VALUES = [
  {
    icon: Microscope,
    title: 'Evidence-first',
    description: 'Every recommendation is grounded in published research and lab data — never guesswork.',
  },
  {
    icon: Lock,
    title: 'Privacy by design',
    description: 'Your health data is yours. We never sell it, never share it, never use it to train models without consent.',
  },
  {
    icon: Users,
    title: 'Accessible by default',
    description: 'We price Vitaloop so that cost is never the reason someone can\'t understand their own health.',
  },
  {
    icon: Zap,
    title: 'Built with urgency',
    description: 'Health problems compound over time. We move fast because waiting has real consequences.',
  },
]

const ROADMAP = [
  {
    icon: CheckCircle2,
    title: 'Today',
    subtitle: 'An AI-powered platform that reads your lab results, identifies imbalances across 85+ biomarkers, and delivers a personalized protocol: exact supplements, dosages, dietary shifts, and lifestyle recommendations.',
  },
  {
    icon: TrendingUp,
    title: 'Next 6 months',
    subtitle: 'Longitudinal tracking — upload labs over time and watch your biomarkers move. Integration with nutritionists and functional medicine practitioners who use Vitaloop as their clinical tool.',
  },
  {
    icon: Sparkles,
    title: 'Our vision',
    subtitle: 'A world where every person — regardless of income or geography — has access to the same quality of health guidance that today is reserved for those who can afford a functional medicine doctor.',
  },
]

export default function About() {
  const navigate = useNavigate()
  const [imageError, setImageError] = useState(false)

  const FounderAvatarFallback = () => (
    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 border-4 border-emerald-200">
      <span className="text-3xl font-bold text-emerald-700">AB</span>
    </div>
  )

  return (
    <>
      <Seo
        title="About VITALOOP - Our Mission & Team"
        description="Learn about VITALOOP's mission to make evidence-based health accessible to everyone, and meet the team behind the platform."
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

        {/* SECTION 1: HERO */}
        <div className="bg-gradient-to-b from-slate-50 to-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-16 sm:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                We're on a mission to make your health data work for you
              </h1>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
                Vitaloop was built by people who were tired of spending hundreds on lab tests — and getting nothing actionable in return.
              </p>
              <button
                onClick={() => navigate('/login?signup=true')}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-lg font-bold text-white hover:bg-emerald-700 transition shadow-lg"
              >
                Upload your labs free
                <span>→</span>
              </button>
            </motion.div>
          </div>
        </div>

        {/* SECTION 2: OUR STORY / THE PROBLEM */}
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-12">Why we built Vitaloop</h2>

            <div className="prose prose-lg max-w-none text-slate-700 space-y-6">
              <p>
                Every year, millions of people invest in blood tests hoping to take control of their health. They get a PDF. They get reference ranges. They get told "everything looks normal" — even when it doesn't.
              </p>
              <p>
                Doctors have 7 minutes per visit. Nutritionists cost $150/hour. And Google gives you anxiety, not answers.
              </p>
              <p>
                We built Vitaloop because we believe that having your labs analyzed shouldn't require a medical degree or a large budget. Your health data belongs to you — and it should actually tell you something useful.
              </p>
            </div>
          </motion.div>
        </div>

        {/* SECTION 3: WHAT WE'RE BUILDING */}
        <div className="bg-slate-50">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-16 sm:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="mb-12"
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 text-center">
                What we're building — and where we're going
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {ROADMAP.map((item, idx) => {
                const Icon = item.icon
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    viewport={{ once: true }}
                    className="rounded-[28px] border border-slate-200 bg-white p-8 hover:shadow-lg hover:border-slate-300 transition"
                  >
                    <div className="mb-4 inline-flex rounded-2xl bg-emerald-100 p-4 text-emerald-600">
                      <Icon size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">{item.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{item.subtitle}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>

        {/* SECTION 4: FOUNDER */}
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900">The people behind Vitaloop</h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-12 sm:p-16 max-w-2xl mx-auto text-center"
          >
            {/* Founder Photo/Avatar */}
            <div className="mb-8 flex justify-center">
              {!imageError ? (
                <img
                  src="/images/alex-bombela.jpg"
                  alt="Alex Bombela"
                  onError={() => setImageError(true)}
                  className="h-32 w-32 rounded-full border-4 border-emerald-200 object-cover"
                />
              ) : (
                <FounderAvatarFallback />
              )}
            </div>

            {/* Founder Info */}
            <h3 className="text-3xl font-bold text-slate-900 mb-2">Alex Bombela</h3>
            <p className="text-lg font-semibold text-emerald-600 mb-6">Founder & CEO</p>

            {/* Bio */}
            <div className="text-slate-700 space-y-4 mb-8 text-left leading-relaxed">
              <p>
                Alex is a Senior Project Manager with 8+ years of experience leading complex technology projects — from AI platforms to deep-tech R&D. He has worked with engineering and executive teams at Nokia, Intel, IBM, and Intel Capital, and led initiatives in water treatment technology and optical computing.
              </p>
              <p>
                He built Vitaloop after experiencing the same problem firsthand: expensive lab tests, confusing numbers, and no clear path to action. His background at the intersection of technology, strategy, and executive communication drives how Vitaloop is built — precise, trustworthy, and built for real people.
              </p>
              <p>
                Holds a Master's Degree from Odessa Polytechnic University.
              </p>
            </div>

            {/* LinkedIn Button */}
            <a
              href="https://www.linkedin.com/in/aleksey-bombela/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
                <ExternalLink size={18} />
              Connect on LinkedIn
            </a>

            {/* Hiring note */}
            <div className="mt-10 pt-10 border-t border-slate-200">
              <p className="text-sm text-slate-600 mb-3">
                Vitaloop is actively growing its team. We're looking for people who care deeply about health, data, and impact.
              </p>
              <a
                href="mailto:careers@vitaloop.today"
                className="text-emerald-600 hover:text-emerald-700 font-semibold text-sm"
              >
                See open roles →
              </a>
            </div>
          </motion.div>
        </div>

        {/* SECTION 5: VALUES */}
        <div className="bg-slate-900 text-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-16 sm:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl sm:text-5xl font-bold mb-6">What we stand for</h2>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {VALUES.map((value, idx) => {
                const Icon = value.icon
                return (
                  <motion.div
                    key={value.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    viewport={{ once: true }}
                    className="flex gap-4"
                  >
                    <div className="flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                        <Icon size={24} className="text-emerald-400" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{value.title}</h3>
                      <p className="text-slate-300">{value.description}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>

        {/* SECTION 6: CLOSING CTA */}
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="rounded-[34px] bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 p-12 sm:p-16 text-center"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Join us on this mission
            </h2>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Start with your own labs — free, no credit card required. See what Vitaloop finds in under 2 minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/login?signup=true')}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-lg font-bold text-white hover:bg-emerald-700 transition shadow-lg"
              >
                Upload your labs free
                <span>→</span>
              </button>
              <a
                href="mailto:alex@vitaloop.today"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-8 py-4 text-lg font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Talk to the founder
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
}
