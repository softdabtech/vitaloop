import { Trophy, Star, Zap, Heart, Target, Flame } from 'lucide-react'

const ACHIEVEMENTS = {
  first_upload: {
    id: 'first_upload',
    title: 'Lab Detective',
    description: 'Uploaded your first lab report',
    icon: '🔬',
    color: 'blue',
    condition: (stats) => stats.total_uploads >= 1,
  },
  health_profile: {
    id: 'health_profile',
    title: 'Know Thyself',
    description: 'Completed your health profile',
    icon: '👤',
    color: 'purple',
    condition: (stats) => stats.profile_complete,
  },
  week_consistency: {
    id: 'week_consistency',
    title: 'Weekly Warrior',
    description: '7-day streak of protocol adherence',
    icon: '⭐',
    color: 'emerald',
    condition: (stats) => stats.adherence_streak >= 7,
  },
  month_active: {
    id: 'month_active',
    title: 'Month Master',
    description: '30 days of consistent health tracking',
    icon: '🔥',
    color: 'orange',
    condition: (stats) => stats.adherence_streak >= 30,
  },
  checkin_master: {
    id: 'checkin_master',
    title: 'Check-in Champion',
    description: '10+ weekly check-ins completed',
    icon: '✅',
    color: 'cyan',
    condition: (stats) => stats.checkins_completed >= 10,
  },
  biomarker_tracker: {
    id: 'biomarker_tracker',
    title: 'Data Detective',
    description: '3+ lab uploads for biomarker tracking',
    icon: '📊',
    color: 'indigo',
    condition: (stats) => stats.total_uploads >= 3,
  },
  health_score_champion: {
    id: 'health_score_champion',
    title: 'Health Champion',
    description: 'Achieved health score of 80+',
    icon: '🏆',
    color: 'yellow',
    condition: (stats) => stats.health_score >= 80,
  },
  perfect_week: {
    id: 'perfect_week',
    title: 'Perfect Week',
    description: 'Completed all assignments in a week',
    icon: '💎',
    color: 'pink',
    condition: (stats) => stats.perfect_weeks >= 1,
  },
}

const COLOR_STYLES = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  pink: 'bg-pink-50 border-pink-200 text-pink-700',
}

function BadgeCard({ achievement, unlocked }) {
  return (
    <div
      className={`rounded-xl border-2 p-4 text-center transition ${
        unlocked
          ? `${COLOR_STYLES[achievement.color]} border-2`
          : 'bg-slate-50 border-slate-200 text-slate-400'
      } ${unlocked ? 'shadow-md' : 'opacity-60'}`}
    >
      <div className="text-4xl mb-2">{achievement.icon}</div>
      <p className="font-semibold text-sm">{achievement.title}</p>
      <p className="text-xs mt-1 opacity-75">{achievement.description}</p>
      {unlocked && <p className="text-xs font-bold mt-2">🎉 Unlocked!</p>}
    </div>
  )
}

export default function AchievementBadges({ stats = {} }) {
  const unlockedBadges = Object.values(ACHIEVEMENTS).filter((achievement) =>
    achievement.condition(stats)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Achievements</h3>
        <p className="text-sm text-slate-600">
          {unlockedBadges.length} of {Object.keys(ACHIEVEMENTS).length} unlocked
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${(unlockedBadges.length / Object.keys(ACHIEVEMENTS).length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 text-right">
          {Math.round((unlockedBadges.length / Object.keys(ACHIEVEMENTS).length) * 100)}% complete
        </p>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Object.values(ACHIEVEMENTS).map((achievement) => (
          <BadgeCard
            key={achievement.id}
            achievement={achievement}
            unlocked={unlockedBadges.some((b) => b.id === achievement.id)}
          />
        ))}
      </div>

      {/* Next Goal */}
      {unlockedBadges.length < Object.keys(ACHIEVEMENTS).length && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800 mb-2">🎯 Next Goal</p>
          <p className="text-xs text-slate-600">
            Complete {Object.keys(ACHIEVEMENTS).length - unlockedBadges.length} more achievement
            {Object.keys(ACHIEVEMENTS).length - unlockedBadges.length > 1 ? 's' : ''} to unlock all badges!
          </p>
        </div>
      )}

      {/* All Unlocked Celebration */}
      {unlockedBadges.length === Object.keys(ACHIEVEMENTS).length && (
        <div className="rounded-xl border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 p-4 text-center">
          <p className="text-lg font-bold text-yellow-700">👑 ACHIEVEMENT MASTER! 👑</p>
          <p className="text-sm text-yellow-600 mt-1">You've unlocked all achievements. You're a health legend!</p>
        </div>
      )}
    </div>
  )
}
