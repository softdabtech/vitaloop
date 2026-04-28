export interface BiomarkerTrend {
  name: string
  current: number
  previous: number
  change: number
  changePercent: number
  direction: 'up' | 'down' | 'stable'
  trend: 'improving' | 'declining' | 'stable'
}

export function analyzeTrends(current: any[], previous: any[]): BiomarkerTrend[] {
  return current
    .map(curr => {
      const prev = previous.find(p => p.name === curr.name)
      if (!prev) return null

      const change = curr.value - prev.value
      const changePercent = prev.value !== 0 ? (change / prev.value) * 100 : 0
      const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable'

      // Determine if improving or declining based on status
      let trend: 'improving' | 'declining' | 'stable' = 'stable'
      if (prev.status === 'DEFICIENT' && curr.status !== 'DEFICIENT') {
        trend = 'improving'
      } else if (prev.status !== 'DEFICIENT' && curr.status === 'DEFICIENT') {
        trend = 'declining'
      }

      return {
        name: curr.name,
        current: curr.value,
        previous: prev.value,
        change,
        changePercent: Math.round(changePercent * 10) / 10,
        direction,
        trend,
      }
    })
    .filter(Boolean) as BiomarkerTrend[]
}

export function getTrendSummary(trends: BiomarkerTrend[]) {
  const improving = trends.filter(t => t.trend === 'improving').length
  const declining = trends.filter(t => t.trend === 'declining').length
  const stable = trends.filter(t => t.trend === 'stable').length

  const improvementScore = (improving / trends.length) * 100

  return {
    improving,
    declining,
    stable,
    improvementScore: Math.round(improvementScore),
    recommendation: getRecommendation(improvementScore),
  }
}

function getRecommendation(score: number): string {
  if (score >= 75) return 'Excellent progress! Keep up the current protocol.'
  if (score >= 50) return 'Good improvement. Continue with current recommendations.'
  if (score >= 25) return 'Some improvement. Consider adjusting your protocol.'
  return 'Limited improvement. Reassess adherence and protocol effectiveness.'
}

export function predictNextBiomarkerValues(trends: BiomarkerTrend[]) {
  return trends.map(trend => {
    const monthlyChange = trend.changePercent / 1 // assuming monthly interval
    const projectedNextMonth = trend.current + (trend.current * monthlyChange) / 100

    return {
      name: trend.name,
      current: trend.current,
      projectedNextMonth: Math.round(projectedNextMonth * 100) / 100,
      trendDirection: trend.direction,
    }
  })
}
