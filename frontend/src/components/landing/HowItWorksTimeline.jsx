import PropTypes from 'prop-types'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const STEPS = [
  {
    icon: '📄',
    title: 'Upload PDF',
    body: 'Start by uploading your lab report.',
    detail: 'VITALOOP extracts biomarkers, ranges, flags, and baseline context from the report.',
  },
  {
    icon: '🔎',
    title: 'Identify problems',
    body: 'See what needs attention first.',
    detail: 'Priority issues are ranked so you can understand what matters most before taking action.',
  },
  {
    icon: '⚙️',
    title: 'Execute protocol',
    body: 'Turn analysis into structured action.',
    detail: 'Use personalized supplement, nutrition, and lifestyle steps instead of generic advice.',
  },
  {
    icon: '📅',
    title: 'Weekly check-in',
    body: 'Track how you respond week by week.',
    detail: 'Log symptoms, adherence, and feedback so execution quality is visible between lab cycles.',
  },
  {
    icon: '🔁',
    title: 'Retest 12 weeks later',
    body: 'Measure what changed and refine the next cycle.',
    detail: 'See measurable change and make each cycle smarter than the last.',
  },
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-14 md:mb-20"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">The Feedback Loop: One Test is a Snapshot. Three is a System.</h2>
          <p className="text-base text-slate-600 max-w-3xl mx-auto leading-relaxed">Upload PDF -&gt; identify problems -&gt; execute protocol -&gt; weekly check-in -&gt; retest 12 weeks later -&gt; see measurable change. Each cycle is smarter than the last.</p>
        </motion.div>

        <div className="relative">
          <div className="absolute left-4 sm:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-emerald-300 to-emerald-500/10 sm:-translate-x-1/2">
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-emerald-400 via-emerald-300 to-transparent"
              style={{ scaleY, transformOrigin: 'top' }}
            />
          </div>

          <div className="space-y-6 md:space-y-8">
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
      className={`relative flex items-center gap-4 sm:gap-8 ${isLeft ? '' : 'sm:flex-row-reverse'}`}
    >
      <div className={`pl-12 sm:pl-0 sm:w-1/2 ${isLeft ? 'sm:text-right' : 'sm:text-left'}`}>
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 hover:border-emerald-400 hover:shadow-lg transition-all"
        >
          <div className="text-[10px] font-semibold text-emerald-600 mb-2 uppercase tracking-widest">Step {index + 1}</div>
          <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{step.body}</p>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">{step.detail}</p>
        </motion.div>
      </div>

      <div className="absolute left-4 z-10 -translate-x-1/2 sm:static sm:translate-x-0 sm:flex-shrink-0">
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
          viewport={{ once: true }}
          className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-lg sm:text-2xl border-4 border-white shadow-lg shadow-emerald-500/30"
        >
          {step.icon}
        </motion.div>
      </div>

      <div className="hidden sm:block sm:w-1/2" />
    </motion.div>
  )
}

TimelineStep.propTypes = {
  step: PropTypes.shape({
    icon: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    detail: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
}
