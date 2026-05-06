import { motion } from 'framer-motion'
import { DollarSign, Calendar, TrendingUp, Zap } from 'lucide-react'

const STATS = [
  {
    icon: DollarSign,
    number: '$400 → $10/mo',
    label: 'Lab cost vs protocol'
  },
  {
    icon: Calendar,
    number: '12 weeks',
    label: 'See real results'
  },
  {
    icon: TrendingUp,
    number: '25%',
    label: 'Free-to-paid conversion'
  },
  {
    icon: Zap,
    number: '<60s',
    label: 'Upload to protocol'
  }
]

export function StatsBar() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {STATS.map((stat, idx) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                className="flex flex-col items-center text-center"
              >
                {/* Icon */}
                <motion.div
                  className="mb-6"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <Icon className="w-8 h-8 text-teal-500" />
                </motion.div>

                {/* Number */}
                <div className="text-2xl lg:text-3xl font-bold text-slate-900 mb-3 leading-snug">
                  {stat.number}
                </div>

                {/* Label */}
                <div className="text-sm text-slate-600">
                  {stat.label}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
