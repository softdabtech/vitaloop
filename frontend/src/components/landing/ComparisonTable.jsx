import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'

const COMPARISON_ROWS = [
  {
    feature: 'Prioritization',
    doctor: 'Lists all results. Says "looks normal." No ranking of what matters most.',
    vitaloop: 'Analyzes all 54 biomarkers. Shows your top 3 critical problems ranked by impact.',
  },
  {
    feature: 'Historical context',
    doctor: 'Sees only today\'s snapshot. Doesn\'t compare to previous tests.',
    vitaloop: 'Compares every test. Shows if Ferritin is rising, stagnant, or falling. Trends matter.',
  },
  {
    feature: 'Actionable protocol',
    doctor: '"Take iron." Which form? With food? Morning or night? When to retest? You figure it out.',
    vitaloop: 'Iron bisglycinate 36mg, mornings with Vitamin C. Retest week 8. Exact dosage & timing.',
  },
  {
    feature: 'Accountability',
    doctor: 'Appointment in 3 months. Hope you remember what to do.',
    vitaloop: 'Weekly check-ins every Monday. "Taking iron? Energy better? Adjusting protocol."',
  },
  {
    feature: 'Speed',
    doctor: 'Appointment wait: 2 months. Visit time: 5 minutes. Answers: unclear.',
    vitaloop: 'Upload your PDF today. Receive a full protocol with prioritized guidance and clear next actions.',
  },
  {
    feature: 'Cost',
    doctor: '$200-500 for test + consultation time + multiple appointments.',
    vitaloop: 'You already paid for the test. $4.99/mo unlocks full protocol & accountability.',
  },
]

export function ComparisonTable() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-12 text-center"
      >
        <h2 className="text-[32px] md:text-[40px] font-bold tracking-tight mb-3">
          Your Doctor{' '}
          <span className="relative">
            <span className="bg-gradient-to-r from-rose-600 to-orange-600 bg-clip-text text-transparent">vs</span>
          </span>{' '}
          VITALOOP
        </h2>
        <p className="text-lg text-slate-600">
          Clear comparison of what you actually need
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="overflow-x-auto rounded-3xl border border-slate-200 bg-white"
      >
        <table className="w-full">
          <caption className="sr-only">Comparison of the VITALOOP workflow with conventional health tracking</caption>
          {/* Header */}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-6 py-5 text-left text-sm font-semibold text-slate-900">
                What matters
              </th>
              <th className="px-6 py-5 text-left text-sm font-semibold text-rose-700">
                Traditional doctor
              </th>
              <th className="px-6 py-5 text-left text-sm font-semibold text-emerald-700">
                VITALOOP
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {COMPARISON_ROWS.map((row, idx) => (
              <motion.tr
                key={row.feature}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                }`}
              >
                {/* Feature name */}
                <td className="px-6 py-5 text-sm font-semibold text-slate-900">
                  {row.feature}
                </td>

                {/* Doctor side */}
                <td className="px-6 py-5">
                  <div className="flex gap-3 items-start">
                    <X className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {row.doctor}
                    </p>
                  </div>
                </td>

                {/* VITALOOP side */}
                <td className="px-6 py-5">
                  <div className="flex gap-3 items-start">
                    <Check className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700 font-medium leading-relaxed">
                      {row.vitaloop}
                    </p>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Bottom callout */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="mt-10 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-6"
      >
        <p className="text-center text-sm text-emerald-900">
          <span className="font-semibold">The real difference:</span> Your doctor has 5 minutes. VITALOOP has unlimited time to analyze your specific situation and hold you accountable every single week.
        </p>
      </motion.div>
    </div>
  )
}
