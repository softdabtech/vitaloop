import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function AnimatedHero() {
  const [stage, setStage] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  const navigate = useNavigate()

  useEffect(() => {
    if (prefersReducedMotion) return

    // Auto-progress stages based on animation duration
    // Stage 0 (Upload): ~2.5s, Stage 1 (Extract): ~2s, Stage 2 (Protocol): ~1.5s
    const durations = [2800, 2500, 2200]
    const timer = setTimeout(() => {
      setStage(prev => (prev + 1) % 3)
    }, durations[stage])

    return () => clearTimeout(timer)
  }, [stage, prefersReducedMotion])

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <ParticleField />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start lg:items-center">
          {/* Left: Headline + CTA */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-6"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-emerald-400 tracking-wider">AI LAB INTELLIGENCE</span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl lg:text-5xl font-bold mb-6 leading-[1.1]">
              <span className="block text-white">Blood test →</span>
              <span className="block bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
                Living protocol
              </span>
            </h1>

            {/* Value prop */}
            <p className="text-xl text-slate-300 mb-10 leading-relaxed max-w-lg">
              Upload any lab PDF. Get AI-powered protocol in 60 seconds. Track progress weekly.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/upload')}
                className="group px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                Try with your lab
                <motion.span
                  className="inline-block"
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  →
                </motion.span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 border-2 border-slate-600 hover:border-emerald-400 text-slate-100 hover:text-white rounded-full font-semibold transition-all whitespace-nowrap"
              >
                Watch 60s demo
              </motion.button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8 border-t border-slate-700">
              <StatBox value="85+" label="Biomarker types tracked" delay={0.5} />
              <StatBox value="<60s" label="From upload to protocol" delay={0.6} />
              <StatBox value="$9.99" label="Personal Premium per month" delay={0.7} />
              <StatBox value="3 plans" label="Free, Premium, Enterprise" delay={0.8} />
            </div>
          </motion.div>

          {/* Right: 3-stage animation */}
          <div className="relative h-[600px]">
            <AnimatePresence mode="wait">
              {stage === 0 && <StageUpload key="upload" />}
              {stage === 1 && <StageExtract key="extract" />}
              {stage === 2 && <StageProtocol key="protocol" />}
            </AnimatePresence>

            {/* Stage dots */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2">
              {['Upload', 'Extract', 'Protocol'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => {
                    setStage(i)
                    // Reset auto-progression after manual click
                  }}
                  className="group flex flex-col items-center gap-2 cursor-pointer"
                >
                  <div className={`transition-all rounded-full ${
                    stage === i ? 'w-8 h-2 bg-emerald-400' : 'w-2 h-2 bg-slate-700 group-hover:bg-slate-600'
                  }`} />
                  <span className={`text-xs transition-colors ${
                    stage === i ? 'text-emerald-400' : 'text-slate-600 group-hover:text-slate-500'
                  }`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Stat box with animation
function StatBox({ value, label, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="text-center"
    >
      <div className="text-2xl lg:text-3xl font-bold text-emerald-400 mb-2">
        {value}
      </div>
      <div className="text-xs lg:text-sm text-slate-400">{label}</div>
    </motion.div>
  )
}

// Stage 1: Lab Upload
function StageUpload() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 0.6 }}
    >
      <div className="relative">
        {/* PDF */}
        <motion.div
          className="w-80 h-96 bg-white rounded-2xl shadow-2xl p-8 relative overflow-hidden"
          animate={{
            rotateY: [0, 5, -5, 0],
            rotateX: [0, 2, -2, 0],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="h-3 bg-slate-200 rounded mb-3"
              style={{ width: `${60 + Math.random() * 40}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0.3] }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            />
          ))}

          {/* Scanning line */}
          <motion.div
            className="absolute left-0 right-0 h-1 bg-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.8)]"
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>

        {/* Floating biomarkers */}
        {['VitD', 'TSH', 'CRP', 'Fe', 'Mg', 'B12'].map((marker, i) => (
          <motion.div
            key={marker}
            className="absolute w-16 h-16 bg-teal-500/20 backdrop-blur-sm border border-teal-400/30 rounded-lg flex items-center justify-center text-xs font-mono text-teal-300"
            style={{
              top: `${20 + (i % 3) * 30}%`,
              left: `${85 + (i % 2) * 15}%`,
            }}
            initial={{ opacity: 0, x: -50, scale: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [0, 50 + i * 10, 100 + i * 15],
              y: [-20, -30 - i * 5, -40 - i * 10],
              scale: [0, 1, 0.8],
            }}
            transition={{ delay: i * 0.15, duration: 2, repeat: Infinity }}
          >
            {marker}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// Stage 2: AI Extraction
function StageExtract() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <svg className="w-full h-full" viewBox="0 0 600 600">
        {/* Input nodes */}
        {[...Array(5)].map((_, i) => (
          <g key={`input-${i}`}>
            <motion.circle
              cx={50}
              cy={100 + i * 100}
              r={8}
              fill="#14b8a6"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
            />
          </g>
        ))}

        {/* Hidden nodes */}
        {[...Array(8)].map((_, i) => (
          <motion.circle
            key={`hidden-${i}`}
            cx={250}
            cy={50 + i * 70}
            r={12}
            fill="#0d9488"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: [1, 1.3, 1] }}
            transition={{ delay: 0.5 + i * 0.08, repeat: Infinity, duration: 2 }}
          />
        ))}

        {/* Output nodes */}
        {[...Array(3)].map((_, i) => (
          <g key={`output-${i}`}>
            <motion.circle
              cx={450}
              cy={150 + i * 150}
              r={10}
              fill="#06b6d4"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1 + i * 0.15 }}
            />
          </g>
        ))}
      </svg>

      {/* Stats panel */}
      <motion.div
        className="absolute top-12 right-12 bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-teal-500/30 shadow-2xl"
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="text-5xl font-bold text-teal-400 mb-2">85</div>
        <div className="text-sm text-slate-400">Biomarkers detected</div>

        <div className="mt-4 space-y-2">
          {['Vitamin D', 'Ferritin', 'TSH', 'CRP'].map((marker, i) => (
            <motion.div
              key={marker}
              className="flex items-center gap-2 text-xs text-slate-300"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 + i * 0.2 }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-teal-400"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
              {marker}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

// Stage 3: Protocol
function StageProtocol() {
  const supplements = [
    { name: 'Vitamin D3', dose: '5000 IU', priority: 'HIGH' },
    { name: 'Magnesium Glycinate', dose: '400mg', priority: 'MEDIUM' },
    { name: 'Omega-3 EPA/DHA', dose: '2g', priority: 'MEDIUM' },
  ]

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.h3
        className="text-2xl font-bold mb-8 text-center text-white"
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        Your personalized protocol
      </motion.h3>

      <div className="space-y-4 w-full max-w-md">
        {supplements.map((sup, i) => (
          <motion.div
            key={sup.name}
            className="bg-gradient-to-br from-teal-500/10 to-teal-500/5 border border-teal-500/30 rounded-2xl p-6 backdrop-blur-sm"
            initial={{
              x: i % 2 === 0 ? -300 : 300,
              opacity: 0,
              rotate: i % 2 === 0 ? -20 : 20,
            }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            transition={{ delay: i * 0.2, type: 'spring', stiffness: 100 }}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-lg text-white">{sup.name}</div>
                <div className="text-slate-400 text-sm mt-1">{sup.dose} daily</div>
              </div>
              <motion.div
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  sup.priority === 'HIGH'
                    ? 'bg-red-500/30 text-red-300'
                    : 'bg-amber-500/30 text-amber-300'
                }`}
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {sup.priority === 'HIGH' ? 'Critical' : 'Support'}
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-8 flex items-center gap-2 text-sm text-slate-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className="w-4 h-4 text-teal-400" />
        </motion.div>
        Protocol generated in 47 seconds
      </motion.div>
    </motion.div>
  )
}

// Particle background
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-teal-400/30 rounded-full"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  )
}
