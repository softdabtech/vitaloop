import { motion } from 'framer-motion'
import { Heart, CreditCard, Upload, Clock, Target, TrendingUp } from 'lucide-react'

export default function MetricBar({ stats, uploadCount, uploadLimit, subStatus, isPremium, latestCheckin }) {

  const getPlanName = (plan) => {
    if (plan === 'active' || plan === 'personal_pro') return 'Premium'
    if (plan === 'enterprise') return 'Enterprise'
    return 'Free'
  }

  const getCheckInStatus = (latestCheckin) => {
    if (!latestCheckin) return { label: 'No check-in', color: 'bg-amber-100 text-amber-700' }
    if (!latestCheckin.week_start) return { label: 'No check-in', color: 'bg-amber-100 text-amber-700' }

    const weekStart = new Date(latestCheckin.week_start)
    if (Number.isNaN(weekStart.getTime())) return { label: 'No check-in', color: 'bg-amber-100 text-amber-700' }

    const now = new Date()
    const daysAgo = Math.floor((now - weekStart) / (1000 * 60 * 60 * 24))
    if (daysAgo > 7) return { label: 'Check-in overdue', color: 'bg-red-100 text-red-700' }
    return { label: `Week ${Math.floor(daysAgo / 7) + 1}`, color: 'bg-emerald-100 text-emerald-700' }
  }

  const checkInStatus = getCheckInStatus(latestCheckin)
  const effectivePlan = String(subStatus || stats.subscription || 'free').toLowerCase()
  const uploadDisplayLimit = uploadLimit == null || isPremium ? '∞' : uploadLimit

  const streakDays = stats.streak_days || 0
  const goalsAchieved = stats.goals_achieved || 0

  const metrics = [
    { id: 'health', icon: Heart, label: 'Health Score', value: stats.health_score ?? 0, color: 'emerald', delay: 0 },
    { id: 'plan', icon: CreditCard, label: 'Plan', value: getPlanName(effectivePlan), color: 'blue', delay: 0.1 },
    { id: 'uploads', icon: Upload, label: 'Uploads', value: `${uploadCount}/${uploadDisplayLimit}`, color: 'blue', delay: 0.2 },
    { id: 'checkin', icon: Clock, label: 'Check-in', value: checkInStatus.label, color: 'amber', delay: 0.3 },
    { id: 'streak', icon: Target, label: 'Streak', value: `${streakDays}d`, color: 'orange', delay: 0.4 },
    { id: 'goals', icon: TrendingUp, label: 'Goals', value: goalsAchieved, color: 'purple', delay: 0.5 },
  ]

  const colorMap = {
    emerald: 'from-emerald-50 to-white border-emerald-200 text-emerald-600',
    blue: 'from-blue-50 to-white border-blue-200 text-blue-600',
    purple: 'from-purple-50 to-white border-purple-200 text-purple-600',
    orange: 'from-orange-50 to-white border-orange-200 text-orange-600',
    amber: 'from-amber-50 to-white border-amber-200 text-amber-600',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6 }}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8"
    >
      {metrics.map((metric) => {
        const Icon = metric.icon
        const colorClass = colorMap[metric.color] || colorMap.blue

        return (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: metric.delay }}
            whileHover={{ y: -4, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
            className={`flex items-center gap-2 rounded-2xl bg-gradient-to-br ${colorClass} border p-4 transition-all cursor-default`}
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: metric.delay }}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-current/15 flex-shrink-0"
            >
              <Icon className="w-5 h-5" />
            </motion.div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{metric.label}</div>
              <div className="text-lg font-bold text-current truncate">{metric.value}</div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
