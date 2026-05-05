import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const TESTIMONIALS = [
  {
    quote: 'I stopped guessing. VITALOOP gave me a clear sequence and my energy stabilized in six weeks.',
    author: 'Nora, 34',
    role: 'Product lead, Berlin',
    result: 'Ferritin: 14 to 68 ng/mL in 12 weeks',
    before: 14,
    after: 68,
    label: 'Ferritin (ng/mL)',
    color: 'from-red-500 to-orange-500',
  },
  {
    quote: 'The weekly check-ins made me actually follow the plan. My ferritin trend finally moved in the right direction.',
    author: 'Alex, 41',
    role: 'Founder, London',
    result: 'CRP: 5.2 to 1.8 mg/L in 8 weeks',
    before: 5.2,
    after: 1.8,
    label: 'CRP (mg/L)',
    color: 'from-amber-500 to-yellow-500',
  },
  {
    quote: 'As a clinician, I value how quickly I can see risk patterns and adherence context in one place.',
    author: 'Dr. Sam R.',
    role: 'Functional medicine practitioner',
    result: 'Client review prep: 45 min to 12 min',
    before: 45,
    after: 12,
    label: 'Review time (minutes)',
    color: 'from-emerald-500 to-teal-500',
  },
]

export function TestimonialsCarousel() {
  const [active, setActive] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true)

  useEffect(() => {
    if (!autoPlay) return
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % TESTIMONIALS.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [autoPlay])

  const next = () => {
    setActive((prev) => (prev + 1) % TESTIMONIALS.length)
    setAutoPlay(false)
  }

  const prev = () => {
    setActive((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
    setAutoPlay(false)
  }

  const testimonial = TESTIMONIALS[active]

  return (
    <section id="testimonials" className="relative py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Real results</h2>
          <p className="text-lg text-slate-600">From users who transformed their health with VITALOOP</p>
        </motion.div>

        {/* Carousel */}
        <div className="relative pb-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start lg:items-center"
            >
              {/* Before/After Chart */}
              <BeforeAfterChart testimonial={testimonial} />

              {/* Quote */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-white border border-slate-200 rounded-2xl p-8"
              >
                <div className="text-5xl text-emerald-400 mb-4">"</div>
                <p className="text-xl text-slate-900 mb-6 leading-relaxed">{testimonial.quote}</p>

                <div className="border-t border-slate-200 pt-6">
                  <div className="font-semibold text-slate-900">{testimonial.author}</div>
                  <div className="text-sm text-slate-600">{testimonial.role}</div>
                  <div className="text-sm text-emerald-700 mt-2">{testimonial.result}</div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="absolute -bottom-16 left-0 right-0 flex items-center justify-between gap-4 px-4 sm:px-0">
            <div className="flex gap-2 flex-1">
              {TESTIMONIALS.map((_, i) => (
                <motion.button
                  key={i}
                  onClick={() => {
                    setActive(i)
                    setAutoPlay(false)
                  }}
                  className={`h-2 rounded-full transition-all ${
                    i === active ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                  whileHover={{ scale: 1.2 }}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <motion.button
                onClick={prev}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 text-emerald-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
              <motion.button
                onClick={next}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 text-emerald-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function BeforeAfterChart({ testimonial }) {
  const { before, after, label, color } = testimonial
  const improvement = ((after - before) / before * 100).toFixed(0)
  const isPositive = after > before

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="relative bg-white border border-slate-200 rounded-2xl p-6 sm:p-8"
    >
      <div className="text-center mb-8">
        <h3 className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide">{label}</h3>
      </div>

      <div className="flex items-end justify-around gap-3 sm:gap-4 mb-8" style={{ height: '140px' }}>
        {/* Before bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center flex-1"
        >
          <div className="text-2xl font-bold text-slate-700 mb-3">{before}</div>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(before / Math.max(before, after)) * 100}px` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
            className="w-full bg-gradient-to-t from-slate-300 to-slate-400 rounded-lg opacity-60"
          />
          <div className="text-xs text-slate-600 mt-3">Before</div>
        </motion.div>

        {/* Arrow */}
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-xl text-emerald-500"
        >
          →
        </motion.div>

        {/* After bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center flex-1"
        >
          <div className={`text-2xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent mb-3`}>
            {after}
          </div>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(after / Math.max(before, after)) * 100}px` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
            className={`w-full bg-gradient-to-t ${color} rounded-lg`}
          />
          <div className="text-xs text-slate-400 mt-3">After</div>
        </motion.div>
      </div>

      {/* Improvement badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className={`text-center py-2 px-4 rounded-lg font-semibold ${
          isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}
      >
        {isPositive ? '↑' : '↓'} {Math.abs(improvement)}% improvement
      </motion.div>
    </motion.div>
  )
}
