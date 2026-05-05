import { motion } from 'framer-motion'
import { FlaskConical, Beaker, Heart, TrendingUp, Target, Activity } from 'lucide-react'

const SERVICES = [
  { name: 'Quest Diagnostics', Icon: FlaskConical, color: '#0066CC' },
  { name: 'LabCorp', Icon: Beaker, color: '#1E40AF' },
  { name: 'Everlywell', Icon: Activity, color: '#059669' },
  { name: 'Function Health', Icon: Heart, color: '#DC2626' },
  { name: 'Levels', Icon: TrendingUp, color: '#7C3AED' },
  { name: 'InsideTracker', Icon: Target, color: '#EA580C' },
]

export function TrustedServicesSection() {
  return (
    <section className="mx-auto w-full max-w-[1240px] px-4 py-10 sm:px-6 md:py-14">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 mb-8">
          Works with any lab. Analyzes any format.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6 items-center justify-center">
          {SERVICES.map((service, idx) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all"
            >
              <service.Icon size={32} style={{ color: service.color }} strokeWidth={1.5} />
              <span className="text-xs md:text-sm font-medium text-slate-700 text-center line-clamp-2">
                {service.name}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
