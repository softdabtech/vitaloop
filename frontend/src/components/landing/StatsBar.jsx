import { ClipboardList, FileSearch, FlaskConical, Repeat2 } from 'lucide-react'

const STATS = [
  {
    icon: ClipboardList,
    number: 'Symptoms',
    label: 'Structured intake before testing'
  },
  {
    icon: FlaskConical,
    number: 'Labs',
    label: 'Useful marker direction before upload'
  },
  {
    icon: FileSearch,
    number: '85+',
    label: 'Biomarkers normalized after upload'
  },
  {
    icon: Repeat2,
    number: 'Weekly loop',
    label: 'Check-ins connect symptoms to progress'
  },
]

export function StatsBar() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {STATS.map((stat, idx) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className="mb-6 transition-transform duration-200 hover:scale-105">
                  <Icon className="w-8 h-8 text-teal-500" />
                </div>

                {/* Number */}
                <div className="text-2xl lg:text-3xl font-bold text-slate-900 mb-3 leading-snug">
                  {stat.number}
                </div>

                {/* Label */}
                <div className="text-sm text-slate-600">
                  {stat.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
