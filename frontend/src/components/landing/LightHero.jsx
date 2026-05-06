import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function LightHero() {
  const navigate = useNavigate()

  return (
    <section className="relative bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Two-column grid */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* LEFT: Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            {/* Eyebrow badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-full"
            >
              <span className="text-teal-600 font-semibold text-sm">✨ AI LAB INTELLIGENCE</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-5xl lg:text-6xl font-bold text-slate-900 leading-tight"
            >
              Spent $400 on blood tests.
              <br />
              <span className="bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">
                Don't know what to do?
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-lg text-slate-600 leading-relaxed max-w-xl space-y-3"
            >
              <span className="block">Upload your PDF. Get a protocol with dosages in 60 seconds.</span>
              <span className="block font-semibold text-slate-900">Not interpretation. Execution.</span>
              <span className="block text-base text-slate-500">
                Stop wasting time decoding lab results. Get a personalized action plan ranked by priority, with exact supplement dosages, meal timing, and weekly milestones to track real progress.
              </span>
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              <button
                onClick={() => navigate('/upload')}
                className="group px-8 py-4 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                Upload Lab PDF (Free)
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => navigate('/for-nutritionists')}
                className="px-8 py-4 border-2 border-teal-500 text-teal-600 hover:bg-teal-50 rounded-lg font-semibold transition-all"
              >
                Стать партнёром
              </button>
            </motion.div>

            {/* Quick stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="grid grid-cols-2 gap-6 pt-8 border-t border-slate-200"
            >
              <div>
                <div className="text-2xl font-bold text-slate-900">$9.99/mo</div>
                <div className="text-sm text-slate-600">vs $400 spent</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">12 weeks</div>
                <div className="text-sm text-slate-600">See real results</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">68 ng/mL</div>
                <div className="text-sm text-slate-600">Ferritin: 14 → 68 in 12 weeks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">100%</div>
                <div className="text-sm text-slate-600">Personalized to your labs</div>
              </div>
            </motion.div>
          </motion.div>

          {/* RIGHT: Illustration */}
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="flex justify-center lg:justify-end"
          >
            <div className="relative w-full max-w-lg">
              <img
                src="/images/woman-health-dashboard.webp"
                alt="Woman reviewing health improvement dashboard"
                className="w-full h-auto rounded-2xl shadow-2xl"
              />
              {/* Subtle glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-500/20 to-transparent pointer-events-none" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Background accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-50 rounded-full opacity-30 blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-50 rounded-full opacity-20 blur-3xl -z-10" />
    </section>
  )
}
