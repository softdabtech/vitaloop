export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: 'milestone' | 'streak' | 'social' | 'health'
  unlocked: boolean
  unlockedAt?: Date
  progress?: number
  target?: number
}

export const ACHIEVEMENTS = {
  // Milestones
  FIRST_UPLOAD: {
    id: 'first-upload',
    name: 'Lab Explorer',
    description: 'Upload your first lab report',
    icon: '📤',
    category: 'milestone',
    target: 1,
  },
  FIVE_UPLOADS: {
    id: 'five-uploads',
    name: 'Data Collector',
    description: 'Upload 5 lab reports',
    icon: '📊',
    category: 'milestone',
    target: 5,
  },
  TEN_UPLOADS: {
    id: 'ten-uploads',
    name: 'Health Tracker Pro',
    description: 'Upload 10 lab reports',
    icon: '🏆',
    category: 'milestone',
    target: 10,
  },

  // Streaks
  WEEK_STREAK: {
    id: 'week-streak',
    name: 'Weekly Warrior',
    description: 'Complete check-ins for 7 days straight',
    icon: '🔥',
    category: 'streak',
    target: 7,
  },
  MONTH_STREAK: {
    id: 'month-streak',
    name: 'Consistent Champion',
    description: '30-day check-in streak',
    icon: '⭐',
    category: 'streak',
    target: 30,
  },

  // Health
  SCORE_80: {
    id: 'score-80',
    name: 'Optimized',
    description: 'Reach a health score of 80+',
    icon: '💚',
    category: 'health',
    target: 80,
  },
  ALL_OPTIMAL: {
    id: 'all-optimal',
    name: 'Perfect Balance',
    description: 'Get all biomarkers in optimal range',
    icon: '✨',
    category: 'health',
    target: 1,
  },

  // Social
  FIRST_SHARE: {
    id: 'first-share',
    name: 'Social Butterfly',
    description: 'Share your progress on social media',
    icon: '📱',
    category: 'social',
    target: 1,
  },
  FIVE_SHARES: {
    id: 'five-shares',
    name: 'Wellness Advocate',
    description: 'Share 5 health updates',
    icon: '📢',
    category: 'social',
    target: 5,
  },
}

export function checkAchievements(stats: {
  uploadCount: number
  checkInStreak: number
  healthScore: number
  optimalBiomarkers: number
  totalBiomarkers: number
  shareCount: number
}): Achievement[] {
  const unlocked: Achievement[] = []

  // Check milestone achievements
  if (stats.uploadCount >= 1) {
    unlocked.push({ ...ACHIEVEMENTS.FIRST_UPLOAD, unlocked: true })
  }
  if (stats.uploadCount >= 5) {
    unlocked.push({ ...ACHIEVEMENTS.FIVE_UPLOADS, unlocked: true })
  }
  if (stats.uploadCount >= 10) {
    unlocked.push({ ...ACHIEVEMENTS.TEN_UPLOADS, unlocked: true })
  }

  // Check streak achievements
  if (stats.checkInStreak >= 7) {
    unlocked.push({ ...ACHIEVEMENTS.WEEK_STREAK, unlocked: true })
  }
  if (stats.checkInStreak >= 30) {
    unlocked.push({ ...ACHIEVEMENTS.MONTH_STREAK, unlocked: true })
  }

  // Check health achievements
  if (stats.healthScore >= 80) {
    unlocked.push({ ...ACHIEVEMENTS.SCORE_80, unlocked: true })
  }
  if (stats.optimalBiomarkers === stats.totalBiomarkers && stats.totalBiomarkers > 0) {
    unlocked.push({ ...ACHIEVEMENTS.ALL_OPTIMAL, unlocked: true })
  }

  // Check social achievements
  if (stats.shareCount >= 1) {
    unlocked.push({ ...ACHIEVEMENTS.FIRST_SHARE, unlocked: true })
  }
  if (stats.shareCount >= 5) {
    unlocked.push({ ...ACHIEVEMENTS.FIVE_SHARES, unlocked: true })
  }

  return unlocked
}

export function getAchievementProgress(stats: any): Record<string, Achievement> {
  const achievements: Record<string, Achievement> = {}

  Object.entries(ACHIEVEMENTS).forEach(([key, achievement]) => {
    let progress = 0
    let target = achievement.target || 1

    if (achievement.id.includes('upload')) {
      progress = stats.uploadCount
    } else if (achievement.id.includes('streak')) {
      progress = stats.checkInStreak
    } else if (achievement.id.includes('share')) {
      progress = stats.shareCount
    } else if (achievement.id === 'score-80') {
      progress = stats.healthScore
    } else if (achievement.id === 'all-optimal') {
      progress = stats.optimalBiomarkers === stats.totalBiomarkers ? 1 : 0
    }

    achievements[achievement.id] = {
      ...achievement,
      unlocked: progress >= target,
      progress,
      target,
    }
  })

  return achievements
}
