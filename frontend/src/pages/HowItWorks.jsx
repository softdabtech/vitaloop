import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Upload, Sparkles, Eye, CheckCircle } from 'lucide-react'
import Seo from '../components/Seo.jsx'

export default function HowItWorks() {
  const navigate = useNavigate()
  const steps = [
    {
      icon: Upload,
      title: 'Upload Your Lab Results',
      description: 'Get a test from Quest, LabCorp, or any provider. Upload the PDF to Vitaloop — we handle the rest.',
      code: '01',
      color: 'from-teal-600 to-teal-500'
    },
    {
      icon: Sparkles,
      title: 'AI Analyzes Your Data',
      description: 'Claude AI scans your biomarkers against clinical research. Creates a personalized health map in seconds.',
      code: '02',
      color: 'from-teal-700 to-teal-500'
    },
    {
      icon: Eye,
      title: 'Explore Your Avatar',
      description: 'Click zones on your interactive 3D avatar. See which supplements you need, what impacts your health.',
      code: '03',
      color: 'from-teal-600 to-teal-400'
    },
    {
      icon: CheckCircle,
      title: 'Get Smart Protocols',
      description: 'Receive AI-generated supplement stacks + lifestyle changes. Track progress as you retest in 90 days.',
      code: '04',
      color: 'from-teal-800 to-teal-600'
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--gray-950, #0a0a0a)',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      <Seo
        title="How It Works"
        description="Understand VITALOOP in 4 steps: upload labs, AI analysis, interactive avatar insights, and personalized protocols."
        path="/how-it-works"
      />
      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 py-24 text-center">
        <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl md:text-6xl font-bold text-white mb-6">
          How It Works
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-xl text-gray-400 max-w-2xl mx-auto">
          Transform lab data into actionable health insights in 4 simple steps.
        </motion.p>
      </div>

      {/* Steps */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {steps.map((step, idx) => {
            const Icon = step.icon
            const isEven = idx % 2 === 0
            
            return (
              <motion.div
                key={step.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.2 }}
                className={`grid md:grid-cols-2 gap-8 items-center ${!isEven ? 'md:[&>*:first-child]:order-2' : ''}`}
              >
                {/* Content */}
                <div>
                  <div className="flex items-end gap-4 mb-4">
                    <span className={`text-6xl font-bold bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}>
                      {step.code}
                    </span>
                    <Icon className="w-12 h-12 text-gray-400 mb-2" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">{step.title}</h2>
                  <p className="text-lg text-gray-400 mb-6">{step.description}</p>
                  <button style={{ background: 'var(--teal-500, #1D9E75)', color: 'white', border: 'none', borderRadius: 980, padding: '12px 28px', fontWeight: 600, cursor: 'pointer' }}>
                    Learn More →
                  </button>
                </div>

                {/* Visual */}
                <div className={`h-64 rounded-xl bg-gradient-to-br ${step.color} opacity-20 border border-white/10 flex items-center justify-center`}>
                  <Icon className="w-24 h-24 text-white opacity-30" />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Key Features */}
      <div className="bg-gray-800/50 border-y border-gray-700/50 py-16 mt-12">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">Why Vitaloop?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/50">
              <div className="text-4xl mb-3">🧠</div>
              <h3 className="font-semibold text-white mb-2">AI-Powered</h3>
              <p className="text-gray-400 text-sm">Claude AI understands your biomarkers in context of clinical research, not just raw numbers.</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/50">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="font-semibold text-white mb-2">Personalized</h3>
              <p className="text-gray-400 text-sm">No generic protocols. Your supplements and dosages are calculated for YOUR unique biomarker pattern.</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/50">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="font-semibold text-white mb-2">Trackable</h3>
              <p className="text-gray-400 text-sm">Upload tests every 90 days to see your progress. Your avatar updates in real-time.</p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h2 className="text-4xl font-bold text-white mb-6">Ready to map your health?</h2>
        <div className="flex gap-4 justify-center flex-wrap">
          <button onClick={() => navigate('/example-report')} style={{ background: 'var(--teal-500, #1D9E75)', color: 'white', border: 'none', borderRadius: 980, padding: '12px 28px', fontWeight: 600, cursor: 'pointer' }}>
            See Example Report
          </button>
          <button onClick={() => navigate('/login')} className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold rounded-lg transition">
            Get Started Free
          </button>
        </div>
      </motion.div>
    </div>
  )
}
