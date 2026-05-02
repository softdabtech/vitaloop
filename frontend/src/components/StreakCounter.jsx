import { Flame, Target, Calendar } from 'lucide-react'

function StreakBadge({ icon: Icon, label, count, color = 'emerald', subtext }) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', text: 'text-emerald-900' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', text: 'text-orange-900' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', text: 'text-blue-900' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', text: 'text-purple-900' },
  }
  const colors = colorMap[color]

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-4`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-6 w-6 ${colors.icon}`} />
        <div className="flex-1">
          <p className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>{label}</p>
          <p className={`text-2xl font-bold ${colors.text} mt-1`}>{count}</p>
          {subtext && <p className="text-xs mt-1 opacity-75">{subtext}</p>}
        </div>
      </div>
    </div>
  )
}

export default function StreakCounter({ checkInStreak = 0, adherenceStreak = 0, uploadStreak = 0 }) {
  const totalStreak = Math.max(checkInStreak, adherenceStreak)
  const isOnFire = totalStreak > 7

  return (
    <div className="space-y-4">
      {/* Main Streak Display */}
      {totalStreak > 0 && (
        <div className={`rounded-2xl border-2 ${isOnFire ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-red-50' : 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50'} p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                {isOnFire ? '🔥 ON FIRE!' : '✨ STREAK ACTIVE'}
              </p>
              <p className={`text-4xl font-bold ${isOnFire ? 'text-orange-600' : 'text-emerald-600'}`}>
                {totalStreak} day{totalStreak > 1 ? 's' : ''}
              </p>
              <p className={`text-sm mt-2 ${isOnFire ? 'text-orange-700' : 'text-emerald-700'}`}>
                {isOnFire ? '🎯 Amazing consistency! Keep it up!' : '👍 Great momentum going!'}
              </p>
            </div>
            <div className={`text-6xl ${isOnFire ? 'animate-bounce' : ''}`}>
              {isOnFire ? '🔥' : '⭐'}
            </div>
          </div>
        </div>
      )}

      {/* Streak Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {checkInStreak > 0 && (
          <StreakBadge
            icon={Calendar}
            label="Check-in Streak"
            count={`${checkInStreak}w`}
            color="purple"
            subtext="Weekly consistency"
          />
        )}
        {adherenceStreak > 0 && (
          <StreakBadge
            icon={Target}
            label="Protocol Streak"
            count={`${adherenceStreak}d`}
            color="blue"
            subtext="Tasks completed"
          />
        )}
        {uploadStreak > 0 && (
          <StreakBadge
            icon={Flame}
            label="Testing Active"
            count={`${uploadStreak}m`}
            color="orange"
            subtext="Months tracking"
          />
        )}
      </div>

      {/* Motivational Message */}
      {totalStreak > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-sm text-slate-700">
            {totalStreak === 1 ? '🌱 One day builds a habit!' :
             totalStreak < 7 ? '📈 Almost a week! Keep going!' :
             totalStreak < 30 ? '🎯 A month of consistency! You\'re a legend!' :
             totalStreak < 90 ? '👑 Three months strong! This is your new lifestyle!' :
             '🏆 90+ days! You\'ve mastered this!'}
          </p>
        </div>
      )}

      {/* Empty State */}
      {totalStreak === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
          <p className="text-sm text-slate-600">
            🎯 Start a streak by completing your first check-in or task today!
          </p>
        </div>
      )}
    </div>
  )
}
