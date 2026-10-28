export interface ProgressMetrics {
  profileCompletion: number
  uploadsCount: number
  resultsViewed: number
  protocolAdherence: number
  checkInsCompleted: number
  overallScore: number
}

export function calculateProgressMetrics(user: any): ProgressMetrics {
  const checks = [
    Boolean(user.full_name),
    Boolean(user.age),
    Boolean(user.sex),
    Boolean(user.height_cm),
    Boolean(user.weight_kg),
    Boolean(user.goals?.length),
  ]

  const profileCompletion = Math.round((checks.filter(Boolean).length / checks.length) * 100)

  return {
    profileCompletion,
    uploadsCount: user.uploads_count ?? 0,
    resultsViewed: user.results_viewed ?? 0,
    protocolAdherence: user.protocol_adherence ?? 0,
    checkInsCompleted: user.checkins_completed ?? 0,
    overallScore: Math.round(
      (profileCompletion * 0.2 +
        Math.min(user.uploads_count ?? 0, 5) * 20 +
        Math.min(user.checkins_completed ?? 0, 4) * 20) / 100
    ),
  }
}

export function getProgressColor(percentage: number): string {
  if (percentage >= 80) return '#10b981' // green
  if (percentage >= 60) return '#f59e0b' // amber
  if (percentage >= 40) return '#f97316' // orange
  return '#ef4444' // red
}

export function getProgressLabel(percentage: number): string {
  if (percentage >= 80) return 'Excellent'
  if (percentage >= 60) return 'Good'
  if (percentage >= 40) return 'Fair'
  return 'Getting started'
}
