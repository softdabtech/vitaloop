import { Heart, CreditCard, Upload, Clock, Target, TrendingUp } from 'lucide-react'

export default function MetricBar({ stats, uploadCount, uploadLimit, subStatus, isPremium, latestCheckin }) {
  const getPlanColor = (plan) => {
    if (plan === 'active' || plan === 'personal_pro') return 'bg-emerald-100 text-emerald-700'
    if (plan === 'enterprise') return 'bg-blue-100 text-blue-700'
    return 'bg-slate-100 text-slate-700'
  }

  const getPlanName = (plan) => {
    if (plan === 'active' || plan === 'personal_pro') return 'Personal Premium'
    if (plan === 'enterprise') return 'Enterprise'
    return 'Free'
  }

  const getCheckInStatus = (latestCheckin) => {
    if (!latestCheckin) return { label: 'No check-in', color: 'bg-amber-100 text-amber-700' }
    const weekStart = new Date(latestCheckin.week_start)
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {/* Health Score */}
      <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 p-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/15">
          <Heart className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Health Score</div>
          <div className="text-2xl font-bold text-emerald-700">{stats.health_score ?? 0}</div>
          {stats.health_score_change !== undefined && stats.health_score_change !== 0 && (
            <div className={`text-xs font-semibold ${stats.health_score_change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.health_score_change > 0 ? '+' : ''}{stats.health_score_change}%
            </div>
          )}
        </div>
      </div>

      {/* Plan */}
      <div className={`flex items-center gap-2 rounded-2xl border p-4 ${getPlanColor(effectivePlan)}`}>
        <div className={'flex items-center justify-center w-10 h-10 rounded-xl bg-current/15'}>
          <CreditCard className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Plan</div>
          <div className="text-xl font-bold">{getPlanName(effectivePlan)}</div>
        </div>
      </div>

      {/* Uploads */}
      <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-200 p-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/15">
          <Upload className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Uploads</div>
          <div className="text-xl font-bold text-blue-700">{uploadCount}/{uploadDisplayLimit}</div>
        </div>
      </div>

      {/* Check-in */}
      <div className={`flex items-center gap-2 rounded-2xl border p-4 ${checkInStatus.color}`}>
        <div className={'flex items-center justify-center w-10 h-10 rounded-xl bg-current/15'}>
          <Clock className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Status</div>
          <div className="text-sm font-bold truncate">{checkInStatus.label}</div>
        </div>
      </div>

      {/* Streak */}
      <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-orange-50 to-white border border-orange-200 p-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500/15">
          <TrendingUp className="w-5 h-5 text-orange-600" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Streak</div>
          <div className="text-2xl font-bold text-orange-700">{streakDays}</div>
          <div className="text-xs text-slate-500">days</div>
        </div>
      </div>

      {/* Goals Achieved */}
      <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-purple-50 to-white border border-purple-200 p-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/15">
          <Target className="w-5 h-5 text-purple-600" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Goals</div>
          <div className="text-2xl font-bold text-purple-700">{goalsAchieved}</div>
          <div className="text-xs text-slate-500">achieved</div>
        </div>
      </div>
    </div>
  )
}
