export interface HealthRecommendation {
  id: string
  category: 'exercise' | 'diet' | 'supplement' | 'sleep' | 'stress'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  duration?: string
  frequency?: string
  impact?: string
}

export function generateRecommendations(biomarkers: any[], lifestyle: any): HealthRecommendation[] {
  const recommendations: HealthRecommendation[] = []

  // Iron deficiency
  if (biomarkers.some(b => b.name.includes('Iron') && b.status === 'DEFICIENT')) {
    recommendations.push({
      id: 'iron-1',
      category: 'diet',
      priority: 'high',
      title: 'Increase iron-rich foods',
      description: 'Consume red meat, spinach, or lentils 3-4x per week',
      frequency: '3-4 times per week',
      impact: 'Improves energy and oxygen transport',
    })
  }

  // Low vitamin D
  if (biomarkers.some(b => b.name.includes('Vitamin D') && b.status === 'DEFICIENT')) {
    recommendations.push({
      id: 'vitamin-d-1',
      category: 'exercise',
      priority: 'high',
      title: 'Increase sun exposure',
      description: '15-30 minutes of midday sun exposure, 3-4x per week',
      duration: '15-30 minutes',
      frequency: '3-4 times per week',
      impact: 'Boosts mood, bone health, immune function',
    })

    recommendations.push({
      id: 'vitamin-d-2',
      category: 'supplement',
      priority: 'medium',
      title: 'Vitamin D3 supplement',
      description: '2,000-4,000 IU daily',
      duration: 'Daily',
      impact: 'Corrects deficiency faster',
    })
  }

  // High inflammation
  if (biomarkers.some(b => b.name.includes('CRP') && b.status === 'ELEVATED')) {
    recommendations.push({
      id: 'inflammation-1',
      category: 'diet',
      priority: 'high',
      title: 'Anti-inflammatory foods',
      description: 'Berries, fatty fish, turmeric, ginger daily',
      frequency: 'Daily',
      impact: 'Reduces inflammation markers',
    })

    recommendations.push({
      id: 'inflammation-2',
      category: 'exercise',
      priority: 'medium',
      title: 'Moderate cardio',
      description: '30 min walking or swimming, 4-5x per week',
      duration: '30 minutes',
      frequency: '4-5 times per week',
      impact: 'Reduces inflammatory markers',
    })
  }

  // High stress
  if (lifestyle?.stressLevel === 'high') {
    recommendations.push({
      id: 'stress-1',
      category: 'stress',
      priority: 'high',
      title: 'Meditation practice',
      description: '10 minutes daily meditation or breathing exercises',
      duration: '10 minutes',
      frequency: 'Daily',
      impact: 'Lowers cortisol, improves sleep',
    })

    recommendations.push({
      id: 'stress-2',
      category: 'sleep',
      priority: 'high',
      title: 'Sleep optimization',
      description: 'Aim for 7-9 hours, consistent bedtime',
      duration: '7-9 hours',
      frequency: 'Every night',
      impact: 'Critical for recovery and hormone balance',
    })
  }

  return recommendations.sort((a, b) => {
    const priorityMap = { high: 0, medium: 1, low: 2 }
    return priorityMap[a.priority] - priorityMap[b.priority]
  })
}

export function prioritizeRecommendations(recommendations: HealthRecommendation[], maxItems = 5) {
  return recommendations
    .filter(r => r.priority === 'high')
    .slice(0, maxItems)
    .concat(
      recommendations.filter(r => r.priority === 'medium').slice(0, Math.max(0, maxItems - 3))
    )
}
