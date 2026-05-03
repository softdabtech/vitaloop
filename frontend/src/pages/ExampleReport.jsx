import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BiomarkerMap from '../components/BiomarkerMap.jsx'
import { motion } from 'framer-motion'
import { CheckCircle, Zap, TrendingUp } from 'lucide-react'
import Seo from '../components/Seo.jsx'

// Sample biomarker data for demo
const DEMO_BIOMARKERS = [
  { id: 1, name: 'Vitamin B12', value: 850, unit: 'pg/mL', status: 'OPTIMAL', ref_low: 200, ref_high: 900 },
  { id: 2, name: 'Vitamin D3', value: 38, unit: 'ng/mL', status: 'BORDERLINE', ref_low: 30, ref_high: 100 },
  { id: 3, name: 'Iron (Ferritin)', value: 45, unit: 'ng/mL', status: 'OPTIMAL', ref_low: 24, ref_high: 336 },
  { id: 4, name: 'Magnesium', value: 2.1, unit: 'mg/dL', status: 'BORDERLINE', ref_low: 1.7, ref_high: 2.2 },
  { id: 5, name: 'Cholesterol (Total)', value: 185, unit: 'mg/dL', status: 'OPTIMAL', ref_low: 0, ref_high: 200 },
  { id: 6, name: 'HDL Cholesterol', value: 52, unit: 'mg/dL', status: 'OPTIMAL', ref_low: 40, ref_high: 999 },
  { id: 7, name: 'Triglycerides', value: 95, unit: 'mg/dL', status: 'OPTIMAL', ref_low: 0, ref_high: 150 },
  { id: 8, name: 'TSH', value: 1.8, unit: 'mIU/L', status: 'OPTIMAL', ref_low: 0.4, ref_high: 4.0 },
  { id: 9, name: 'Zinc', value: 75, unit: 'mcg/dL', status: 'BORDERLINE', ref_low: 60, ref_high: 120 },
  { id: 10, name: 'Selenium', value: 135, unit: 'ng/mL', status: 'OPTIMAL', ref_low: 70, ref_high: 150 },
]

export default function ExampleReport() {
  const navigate = useNavigate()
  const [showProtocol, setShowProtocol] = useState(false)

  const optimalCount = DEMO_BIOMARKERS.filter(b => b.status === 'OPTIMAL').length
  const borderlineCount = DEMO_BIOMARKERS.filter(b => b.status === 'BORDERLINE').length

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--gray-950, #0a0a0a)',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Premium Display", sans-serif',
    }}>
      <Seo
        title="Blood Test Analysis Example Report | VITALOOP"
        description="Preview a real AI blood test interpretation with biomarker flags, protocol actions, and trend tracking. Then upload your own labs and start free."
        path="/example-report"
      />
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-900/40 to-teal-800/30 border-b px-6 py-16" style={{ borderColor: 'var(--teal-500)' }}>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-5xl font-bold text-white mb-4">
            See Your Health in 3D
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl">
            This is a sample report showing how Vitaloop transforms lab data into an interactive visual guide for your health. Upload your own tests to get your personalized avatar.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/login?signup=true')}
              style={{ background: 'var(--teal-500, #1D9E75)', color: 'white', border: 'none', borderRadius: 980, padding: '12px 28px', fontWeight: 600, cursor: 'pointer' }}
            >
              Try It Live →
            </button>
            <button onClick={() => navigate('/how-it-works')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition border border-white/20">
              Learn More
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6 py-16">
        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <span className="text-green-300 font-semibold">Optimal</span>
            </div>
            <p className="text-3xl font-bold text-white">{optimalCount}/10</p>
            <p className="text-sm text-gray-400 mt-1">Key biomarkers in healthy range</p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              <span className="text-yellow-300 font-semibold">Borderline</span>
            </div>
            <p className="text-3xl font-bold text-white">{borderlineCount}/10</p>
            <p className="text-sm text-gray-400 mt-1">Room for optimization</p>
          </div>

          <div className="bg-teal-500/10 border rounded-xl p-6" style={{ borderColor: 'var(--teal-500)' }}>
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6" style={{ color: 'var(--teal-400)' }} />
              <span className="font-semibold" style={{ color: 'var(--teal-400)' }}>Insights</span>
            </div>
            <p className="text-3xl font-bold text-white">3</p>
            <p className="text-sm text-gray-400 mt-1">Personalized recommendations</p>
          </div>
        </motion.div>

        {/* Avatar Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-6">Your Interactive Biomarker Map</h2>
          <BiomarkerMap biomarkers={DEMO_BIOMARKERS} />
        </motion.div>

        {/* Features Highlight */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-semibold text-white mb-2">Interactive Zones</h3>
            <p className="text-gray-400 text-sm">Click any body zone to see related biomarkers, their health impact, and personalized supplement recommendations.</p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-semibold text-white mb-2">Real-Time Data</h3>
            <p className="text-gray-400 text-sm">Your avatar updates instantly when you upload new tests. Watch your health progress over months and years.</p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <div className="text-4xl mb-3">💡</div>
            <h3 className="font-semibold text-white mb-2">Smart Protocols</h3>
            <p className="text-gray-400 text-sm">Get AI-generated protocols with exact supplement doses, timing, and lifestyle changes tailored to your unique biomarker pattern.</p>
          </div>
        </motion.div>

        {/* Sample Protocol */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-gradient-to-br from-teal-900/20 to-teal-800/10 border rounded-xl p-8 mb-12" style={{ borderColor: 'var(--teal-500)' }}>
          <h3 className="text-2xl font-bold text-white mb-4">Sample Protocol Generated from This Avatar</h3>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-3" style={{ color: 'var(--teal-400)' }}>🧠 Brain & Cognition Protocol</h4>
              <div className="space-y-2 text-sm text-gray-300">
                <p>✓ <span className="font-semibold" style={{ color: 'var(--teal-400)' }}>Methylcobalamin 2mg sublingual</span> — Daily (B12 optimization)</p>
                <p>✓ <span className="font-semibold" style={{ color: 'var(--teal-400)' }}>Omega-3 2000mg EPA/DHA</span> — With meals, 2x daily</p>
                <p>✓ <span className="font-semibold" style={{ color: 'var(--teal-400)' }}>Magnesium Glycinate 300mg</span> — Before bed (sleep quality)</p>
                <p className="text-gray-500 text-xs mt-2">💡 Retest: 8 weeks to assess B12 absorption & cognitive improvements</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3" style={{ color: 'var(--teal-400)' }}>❤️ Cardiovascular Protocol</h4>
              <div className="space-y-2 text-sm text-gray-300">
                <p>✓ <span className="font-semibold" style={{ color: 'var(--teal-400)' }}>CoQ10 Ubiquinol 200mg</span> — 2x daily (heart mitochondria)</p>
                <p>✓ <span className="font-semibold" style={{ color: 'var(--teal-400)' }}>Berberine 500mg</span> — Before meals, 2x daily (cholesterol support)</p>
                <p>✓ <span className="font-semibold" style={{ color: 'var(--teal-400)' }}>Garlic Extract (Kyolic) 2 caps</span> — 2x daily (arterial health)</p>
                <p className="text-gray-500 text-xs mt-2">💡 Retest: 12 weeks for lipid panel reassessment</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3" style={{ color: 'var(--teal-400)' }}>🔄 Liver Detox Protocol</h4>
              <div className="space-y-2 text-sm text-gray-300">
                <p>✓ <span className="font-semibold" style={{ color: 'var(--teal-400)' }}>NAC (N-Acetyl Cysteine) 1000mg</span> — 2x daily</p>
                <p>✓ <span className="font-semibold" style={{ color: 'var(--teal-400)' }}>Milk Thistle 300mg silymarin</span> — 2x daily</p>
                <p>✓ <span className="font-semibold" style={{ color: 'var(--teal-400)' }}>Alpha-Lipoic Acid 300mg</span> — 2 hours before meals (antioxidant)</p>
                <p className="text-gray-500 text-xs mt-2">💡 Lifestyle: 8-10 hours sleep, hydrate 2L+ water daily, limit alcohol</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="rounded-xl p-12 text-center" style={{ background: 'linear-gradient(135deg, rgba(29,158,117,0.9), rgba(8,80,65,0.95))' }}>
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Map Your Health?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto" style={{ color: 'rgba(226, 255, 246, 0.9)' }}>
            Upload your own lab results to get your personalized biomarker map, avatar, and AI-generated protocol.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => navigate('/login?signup=true')}
              style={{ background: 'var(--teal-500, #1D9E75)', color: 'white', border: 'none', borderRadius: 980, padding: '12px 28px', fontWeight: 600, cursor: 'pointer' }}
            >
              Get Started Free
            </button>
            <button onClick={() => navigate('/how-it-works')} className="px-8 py-4 bg-white/20 text-white font-bold rounded-lg hover:bg-white/30 transition border border-white/40">
              Explore How It Works
            </button>
          </div>
        </motion.div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-800/30 border-y border-gray-700/50 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">Common Questions</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--teal-400)' }}>How accurate is the analysis?</h3>
              <p className="text-gray-400 text-sm">Our analysis is powered by Claude AI trained on 15+ years of clinical nutrition research. Protocols are recommendations only — always consult your healthcare provider.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--teal-400)' }}>Where do I get lab tests?</h3>
              <p className="text-gray-400 text-sm">Use services like Quest Diagnostics, LabCorp, or EverlyWell to order tests. Upload PDFs directly to Vitaloop to get your avatar and protocol.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--teal-400)' }}>Can I track progress over time?</h3>
              <p className="text-gray-400 text-sm">Yes! Upload tests every 6-12 weeks to track biomarker trends. Premium users get charts comparing your metrics across time.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--teal-400)' }}>Are the recommendations personalized?</h3>
              <p className="text-gray-400 text-sm">Completely. Our AI generates protocols based on YOUR specific biomarker patterns, lifestyle, and health goals.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
