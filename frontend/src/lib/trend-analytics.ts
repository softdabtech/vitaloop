export interface BiomarkerTrend {
  biomarkerName: string
  biomarkerId: string
  values: number[]
  dates: string[]
  status: 'improving' | 'stable' | 'declining'
  percentChange: number
  averageValue: number
  latestValue: number
  previousValue?: number
  trend: 'up' | 'down' | 'flat'
  velocity: number // rate of change per month
  isVolatile: boolean // if values fluctuate significantly
}

export interface HealthTrendAnalysis {
  overallStatus: 'improving' | 'stable' | 'declining'
  improvingCount: number
  stableCount: number
  decliningCount: number
  topImprovers: BiomarkerTrend[]
  topDecliners: BiomarkerTrend[]
  mostVolatile: BiomarkerTrend[]
  predictedTrend: Map<string, 'will_improve' | 'will_stable' | 'will_decline'>
}

// Calculate trend for a single biomarker
export function calculateBiomarkerTrend(
  biomarkerName: string,
  biomarkerId: string,
  values: number[],
  dates: string[]
): BiomarkerTrend {
  if (values.length === 0) {
    return {
      biomarkerName,
      biomarkerId,
      values: [],
      dates: [],
      status: 'stable',
      percentChange: 0,
      averageValue: 0,
      latestValue: 0,
      trend: 'flat',
      velocity: 0,
      isVolatile: false,
    }
  }

  const latestValue = values[values.length - 1]
  const previousValue = values.length > 1 ? values[values.length - 2] : latestValue
  const firstValue = values[0]
  const averageValue = values.reduce((a, b) => a + b, 0) / values.length
  const percentChange = ((latestValue - firstValue) / firstValue) * 100

  // Determine trend direction
  const trend = latestValue > previousValue ? 'up' : latestValue < previousValue ? 'down' : 'flat'

  // Calculate velocity (change per month)
  let velocity = 0
  if (values.length > 1 && dates.length > 1) {
    const firstDate = new Date(dates[0]).getTime()
    const lastDate = new Date(dates[dates.length - 1]).getTime()
    const monthsDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 30)
    if (monthsDiff > 0) {
      velocity = (latestValue - firstValue) / monthsDiff
    }
  }

  // Check volatility (standard deviation)
  const variance = values.reduce((sum, val) => sum + Math.pow(val - averageValue, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  const coefficientOfVariation = averageValue !== 0 ? (stdDev / averageValue) * 100 : 0
  const isVolatile = coefficientOfVariation > 15

  // Determine status
  let status: 'improving' | 'stable' | 'declining'
  if (percentChange > 10) {
    status = 'improving'
  } else if (percentChange < -10) {
    status = 'declining'
  } else {
    status = 'stable'
  }

  return {
    biomarkerName,
    biomarkerId,
    values,
    dates,
    status,
    percentChange: Math.round(percentChange * 100) / 100,
    averageValue: Math.round(averageValue * 100) / 100,
    latestValue,
    previousValue,
    trend,
    velocity: Math.round(velocity * 100) / 100,
    isVolatile,
  }
}

// Predict future trend based on velocity
export function predictFutureTrend(
  trend: BiomarkerTrend,
  targetRangeMin: number,
  targetRangeMax: number
): 'will_improve' | 'will_stable' | 'will_decline' {
  const { latestValue, velocity } = trend

  // If already in range, will stay stable
  if (latestValue >= targetRangeMin && latestValue <= targetRangeMax) {
    return 'will_stable'
  }

  // If velocity is close to 0, will stay stable
  if (Math.abs(velocity) < 0.5) {
    return 'will_stable'
  }

  // If below range and velocity is positive, will improve
  if (latestValue < targetRangeMin && velocity > 0) {
    return 'will_improve'
  }

  // If above range and velocity is negative, will improve
  if (latestValue > targetRangeMax && velocity < 0) {
    return 'will_improve'
  }

  // Otherwise declining
  return 'will_decline'
}

// Analyze multiple biomarkers
export function analyzeBiomarkerTrends(
  biomarkers: Array<{
    id: string
    name: string
    values: number[]
    dates: string[]
    ref_low?: number
    ref_high?: number
  }>
): HealthTrendAnalysis {
  const trends = biomarkers.map(b =>
    calculateBiomarkerTrend(b.name, b.id, b.values || [], b.dates || [])
  )

  const improving = trends.filter(t => t.status === 'improving')
  const stable = trends.filter(t => t.status === 'stable')
  const declining = trends.filter(t => t.status === 'declining')

  const topImprovers = [...improving].sort((a, b) => b.percentChange - a.percentChange).slice(0, 3)
  const topDecliners = [...declining].sort((a, b) => a.percentChange - b.percentChange).slice(0, 3)
  const mostVolatile = trends.filter(t => t.isVolatile).sort((a, b) => {
    const aVar = a.values.reduce((sum, v) => sum + Math.pow(v - a.averageValue, 2), 0) / a.values.length
    const bVar = b.values.reduce((sum, v) => sum + Math.pow(v - b.averageValue, 2), 0) / b.values.length
    return bVar - aVar
  }).slice(0, 3)

  // Predict future trends
  const predictedTrend = new Map<string, 'will_improve' | 'will_stable' | 'will_decline'>()
  trends.forEach(t => {
    const prediction = predictFutureTrend(t, t.latestValue - 10, t.latestValue + 10)
    predictedTrend.set(t.biomarkerId, prediction)
  })

  const overallStatus = improving.length > declining.length ? 'improving' : declining.length > improving.length ? 'declining' : 'stable'

  return {
    overallStatus,
    improvingCount: improving.length,
    stableCount: stable.length,
    decliningCount: declining.length,
    topImprovers,
    topDecliners,
    mostVolatile,
    predictedTrend,
  }
}

// Generate trend insights
export function generateTrendInsights(analysis: HealthTrendAnalysis): string[] {
  const insights: string[] = []

  if (analysis.improvingCount > analysis.decliningCount) {
    insights.push(`🎉 Great progress! ${analysis.improvingCount} biomarker${analysis.improvingCount !== 1 ? 's' : ''} improving.`)
  }

  if (analysis.decliningCount > 0) {
    insights.push(`⚠️ Attention needed: ${analysis.decliningCount} biomarker${analysis.decliningCount !== 1 ? 's' : ''} declining.`)
  }

  if (analysis.topImprovers.length > 0) {
    const names = analysis.topImprovers.slice(0, 2).map(t => t.biomarkerName).join(', ')
    insights.push(`📈 Top improvers: ${names}`)
  }

  if (analysis.mostVolatile.length > 0) {
    const names = analysis.mostVolatile.slice(0, 2).map(t => t.biomarkerName).join(', ')
    insights.push(`📊 Volatile markers: ${names} — consider weekly monitoring`)
  }

  if (analysis.stableCount === analysis.improvingCount + analysis.decliningCount) {
    insights.push(`📍 All markers stable — maintain current protocol`)
  }

  return insights
}

// Format trend for display
export function formatTrendStatus(trend: BiomarkerTrend): string {
  const arrow = trend.trend === 'up' ? '↑' : trend.trend === 'down' ? '↓' : '→'
  const sign = trend.percentChange > 0 ? '+' : ''
  return `${arrow} ${sign}${trend.percentChange.toFixed(1)}%`
}

// Get color based on trend
export function getTrendColor(trend: BiomarkerTrend): string {
  if (trend.status === 'improving') return '#16a34a' // green
  if (trend.status === 'declining') return '#dc2626' // red
  return '#f59e0b' // amber
}

// Calculate correlation between biomarkers
export function calculateBiomarkerCorrelation(
  trend1: BiomarkerTrend,
  trend2: BiomarkerTrend
): number {
  if (trend1.values.length !== trend2.values.length || trend1.values.length === 0) {
    return 0
  }

  const n = trend1.values.length
  const mean1 = trend1.averageValue
  const mean2 = trend2.averageValue

  let sumProduct = 0
  let sumSq1 = 0
  let sumSq2 = 0

  for (let i = 0; i < n; i++) {
    const diff1 = trend1.values[i] - mean1
    const diff2 = trend2.values[i] - mean2
    sumProduct += diff1 * diff2
    sumSq1 += diff1 * diff1
    sumSq2 += diff2 * diff2
  }

  const denominator = Math.sqrt(sumSq1 * sumSq2)
  if (denominator === 0) return 0

  return sumProduct / denominator
}
