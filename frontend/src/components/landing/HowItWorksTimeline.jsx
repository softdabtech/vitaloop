import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const STEPS = [
  { icon: '📤', title: 'Upload', body: 'Drop your lab PDF' },
  { icon: '🧠', title: 'AI Analysis', body: '85+ biomarkers extracted' },
  { icon: '✨', title: 'Get Protocol', body: 'Personalized action plan' },
  { icon: '❤️', title: 'Track Progress', body: 'Weekly check-ins' },
]

export function HowItWorksTimeline() {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  })

  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section ref={containerRef} id="how-it-works" className="relative py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">How it works</h2>
          <p className="text-lg text-slate-400">From PDF to personalized protocol in 4 steps</p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-500 via-teal-400 to-teal-500/20 transform -translate-x-1/2">
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-teal-400 via-teal-300 to-transparent"
              style={{ scaleY, transformOrigin: 'top' }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-12">
            {STEPS.map((step, i) => (
              <TimelineStep key={step.title} step={step} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function TimelineStep({ step, index }) {
  const isLeft = index % 2 === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true, margin: '-100px' }}
      className={`flex items-center gap-8 relative ${isLeft ? '' : 'flex-row-reverse'}`}
    >
      {/* Content */}
      <div className={`w-1/2 ${isLeft ? 'text-right' : 'text-left'}`}>
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6 hover:border-teal-500/50 transition-colors"
        >
          <div className="text-sm font-semibold text-teal-400 mb-2">Step {index + 1}</div>
          <h3 className="text-2xl font-bold text-white mb-2">{step.title}</h3>
          <p className="text-slate-400">{step.body}</p>
        </motion.div>
      </div>

      {/* Center node */}
      <div className="relative z-10 flex-shrink-0">
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
          viewport={{ once: true }}
          className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-3xl border-4 border-slate-900 shadow-lg shadow-teal-500/50"
        >
          {step.icon}
        </motion.div>
      </div>

      {/* Empty space for opposite side */}
      <div className="w-1/2" />
    </motion.div>
  )
}
