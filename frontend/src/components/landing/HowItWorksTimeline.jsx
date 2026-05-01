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
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">How it works</h2>
          <p className="text-lg text-slate-600">From PDF to personalized protocol in 4 steps</p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 via-emerald-300 to-emerald-500/10 transform -translate-x-1/2">
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-emerald-400 via-emerald-300 to-transparent"
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
          className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-emerald-300 transition-colors hover:shadow-md"
        >
          <div className="text-sm font-semibold text-emerald-700 mb-2">Step {index + 1}</div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">{step.title}</h3>
          <p className="text-slate-600">{step.body}</p>
        </motion.div>
      </div>

      {/* Center node */}
      <div className="relative z-10 flex-shrink-0">
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
          viewport={{ once: true }}
          className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-3xl border-4 border-white shadow-lg shadow-emerald-500/30"
        >
          {step.icon}
        </motion.div>
      </div>

      {/* Empty space for opposite side */}
      <div className="w-1/2" />
    </motion.div>
  )
}
