import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function AnimatedHero() {
  const prefersReducedMotion = useReducedMotion()
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <ParticleField />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start lg:items-center">
          {/* Left: Headline + CTA */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              className="inline-flex flex-col items-start gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 rounded-full mb-6"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-sm font-semibold text-rose-400 tracking-wider">YOU SPENT $400+ ON LABS</span>
              </div>
              <span className="text-xs text-rose-300/70 tracking-wide ml-4">Now stop guessing what to do</span>
            </motion.div>

            <h1 className="text-4xl lg:text-5xl font-bold mb-6 leading-[1.1]">
              <span className="block text-white">Spent $400 on blood tests.</span>
              <span className="block bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
                Don't know what to do?
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-10 leading-relaxed max-w-lg">
              Upload your PDF. Get a protocol with dosages in 60 seconds. Not interpretation. Execution.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/upload')}
                className="group px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                Upload lab PDF (free)
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
                onClick={() => navigate('/#traction')}
                className="px-8 py-3 border-2 border-slate-600 hover:border-emerald-400 text-slate-100 hover:text-white rounded-full font-semibold transition-all whitespace-nowrap"
              >
                Invest in us
              </motion.button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8 border-t border-slate-700">
              <StatBox value="Ferritin" label="14 → 68 in 12 weeks" delay={0.5} />
              <StatBox value="$19.99" label="/mo vs $400 spent" delay={0.6} />
              <StatBox value="7 days" label="until first check-in" delay={0.7} />
              <StatBox value="Free" label="first result analysis" delay={0.8} />
            </div>
          </motion.div>

          {/* Right: Static visualization */}
          <div className="relative h-[600px] flex items-center justify-center">
            <StageUpload />
          </div>
        </div>
      </div>
    </section>
  )
}

function StatBox({ value, label, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="text-center flex flex-col items-center justify-center min-h-[90px]"
    >
      <div className="text-2xl lg:text-3xl font-bold text-emerald-400 mb-2 leading-tight">
        {value}
      </div>
      <div className="text-xs lg:text-sm text-slate-400 leading-snug">{label}</div>
    </motion.div>
  )
}

// Stage 1: Lab Upload
function StageUpload() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 0.6 }}
    >
      <div className="relative w-80 h-96">
        {/* Background blurred biomarker list */}
        <div className="absolute inset-0 bg-white rounded-2xl shadow-2xl p-8 opacity-20 blur-sm pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <div
              key={`bg-${i}`}
              className="h-3 bg-slate-300 rounded mb-3"
              style={{ width: `${60 + Math.random() * 40}%` }}
            />
          ))}
        </div>

        {/* PDF */}
        <motion.div
          className="absolute inset-0 w-80 h-96 bg-white rounded-2xl shadow-2xl p-8 relative overflow-hidden"
          animate={{
            y: [0, -4, 0],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="h-3 bg-slate-200 rounded mb-3"
              style={{ width: `${60 + Math.random() * 40}%` }}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: i * 0.05 }}
            />
          ))}

          {/* Subtle glow */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-teal-400/40 to-transparent"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </motion.div>

        {/* Floating biomarkers - subtle */}
        {['VitD', 'TSH', 'CRP'].map((marker, i) => (
          <motion.div
            key={marker}
            className="absolute w-12 h-12 bg-emerald-500/15 backdrop-blur-sm border border-emerald-400/40 rounded-lg flex items-center justify-center text-xs font-semibold text-emerald-600"
            style={{
              top: `${25 + i * 35}%`,
              left: `${75}%`,
            }}
            animate={{
              y: [0, -6, 0],
              opacity: [0.7, 0.9, 0.7],
            }}
            transition={{ delay: i * 0.3, duration: 3, repeat: Infinity }}
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
    >
      <svg className="w-full h-full max-w-sm" viewBox="0 0 400 400" style={{ filter: 'drop-shadow(0 0 40px rgba(20, 184, 166, 0.2))' }}>
        {/* Input nodes - PDF document symbols */}
        {[...Array(5)].map((_, i) => (
          <g key={`input-${i}`}>
            <motion.rect
              x={30}
              y={60 + i * 70}
              width={24}
              height={30}
              rx={3}
              fill="none"
              stroke="#14b8a6"
              strokeWidth={1.5}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            />
            <motion.line
              x1={35}
              y1={70 + i * 70}
              x2={48}
              y2={70 + i * 70}
              stroke="#14b8a6"
              strokeWidth={1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 + 0.05 }}
            />
          </g>
        ))}

        {/* Processing nodes - animated */}
        {[...Array(6)].map((_, i) => (
          <motion.g key={`process-${i}`}>
            <motion.circle
              cx={200}
              cy={40 + i * 60}
              r={10}
              fill="#0d9488"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: [1, 1.2, 1] }}
              transition={{ delay: 0.3 + i * 0.1, duration: 1.5, repeat: Infinity }}
            />
            {/* Connecting lines */}
            <motion.line
              x1={54}
              y1={75 + i * 70}
              x2={190}
              y2={40 + i * 60}
              stroke="#14b8a6"
              strokeWidth={1}
              opacity={0.3}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ delay: 0.3 + i * 0.1, duration: 1.5, repeat: Infinity }}
            />
          </motion.g>
        ))}

        {/* Output nodes - biomarker results */}
        {[...Array(5)].map((_, i) => (
          <g key={`output-${i}`}>
            <motion.circle
              cx={350}
              cy={80 + i * 70}
              r={8}
              fill="#06b6d4"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + i * 0.12 }}
            />
            <motion.line
              x1={210}
              y1={40 + i * 60}
              x2={342}
              y2={80 + i * 70}
              stroke="#06b6d4"
              strokeWidth={1}
              opacity={0.4}
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: [0.4, 0.7, 0.4], pathLength: 1 }}
              transition={{ delay: 0.8 + i * 0.12, duration: 1.2, repeat: Infinity }}
            />
          </g>
        ))}
      </svg>

      {/* Stats panel */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 border border-teal-500/30 shadow-2xl w-80"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.div
          className="text-4xl font-bold text-teal-400 mb-3"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 150 }}
        >
          85+
        </motion.div>
        <div className="text-sm text-slate-400 mb-4">Biomarkers extracted</div>

        <div className="space-y-2">
          {['Vitamin D', 'Ferritin', 'TSH', 'CRP'].map((marker, i) => (
            <motion.div
              key={marker}
              className="flex items-center gap-2 text-xs text-slate-300"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.15 }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-teal-400"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
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
