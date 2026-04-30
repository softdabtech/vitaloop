import api from './api'

export interface HealthTip {
  id: string
  title: string
  description: string
  category: 'nutrition' | 'exercise' | 'sleep' | 'stress' | 'supplement'
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedTime?: string
  evidence?: string
  relatedBiomarkers?: string[]
  actionItems?: string[]
  icon?: string
}

export interface HealthTipsResult {
  tips: HealthTip[]
  status: 'ready' | 'pending' | 'failed'
  jobId?: string
  message?: string
}

export async function generateHealthTips(biomarkers: any[], userContext: any): Promise<HealthTipsResult> {
  try {
    const { data } = await api.post('/llm/health-tips', {
      biomarkers: biomarkers.map(b => ({
        name: b.name,
        value: b.value,
        status: b.status,
        category: b.category,
      })),
      userContext: {
        age: userContext.age,
        lifestyle: userContext.lifestyle,
        goals: userContext.goals,
        compliance: userContext.protocol_adherence,
      },
    })

    if (data?.status === 'pending') {
      return {
        tips: [],
        status: 'pending',
        jobId: data?.job_id,
        message: data?.message,
      }
    }

    return {
      tips: data?.tips || [],
      status: 'ready',
      message: data?.message,
    }
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error('Failed to generate health tips:', error)
    }
    return {
      tips: getFallbackTips(biomarkers),
      status: 'failed',
      message: 'Using fallback recommendations while premium analysis is unavailable.',
    }
  }
}

export async function getHealthTipsJob(jobId: string): Promise<HealthTipsResult> {
  try {
    const { data } = await api.get(`/llm/health-tips/${jobId}`)
    if (data?.status === 'pending' || data?.status === 'processing') {
      return {
        tips: [],
        status: 'pending',
        jobId: data?.job_id || jobId,
        message: data?.message,
      }
    }

    return {
      tips: data?.tips || [],
      status: 'ready',
      jobId: data?.job_id || jobId,
      message: data?.message,
    }
  } catch (error) {
    return {
      tips: [],
      status: 'failed',
      jobId,
      message: 'Could not refresh premium analysis status.',
    }
  }
}

function getFallbackTips(biomarkers: any[]): HealthTip[] {
  const tips: HealthTip[] = []

  // Iron deficiency
  if (biomarkers.some(b => b.name.includes('Iron') && b.status === 'DEFICIENT')) {
    tips.push({
      id: 'iron-boost',
      title: 'Boost Iron Levels Naturally',
      description: 'Combine iron-rich foods with vitamin C for better absorption',
      category: 'nutrition',
      difficulty: 'easy',
      estimatedTime: '5 min read',
      evidence: 'NIH: Vitamin C increases iron absorption by 3-4x',
      actionItems: [
        'Eat red meat or spinach with orange juice',
        'Avoid coffee/tea with meals (inhibits absorption)',
        'Try: Beef + broccoli + lemon juice',
      ],
      icon: '🥬',
    })
  }

  // Low energy
  if (biomarkers.some(b => b.name.includes('Glucose') && b.status === 'BORDERLINE')) {
    tips.push({
      id: 'energy-stable',
      title: 'Stabilize Energy Throughout Day',
      description: 'Prevent energy crashes with balanced meals',
      category: 'nutrition',
      difficulty: 'easy',
      estimatedTime: '3 min read',
      actionItems: [
        'Eat protein + healthy fat + carbs in every meal',
        'Avoid sugar spikes: skip pastries/sodas',
        'Example breakfast: eggs + avocado + oatmeal',
      ],
      icon: '⚡',
    })
  }

  // Sleep
  if (biomarkers.some(b => b.name.includes('Cortisol') && b.status === 'ELEVATED')) {
    tips.push({
      id: 'sleep-quality',
      title: 'Improve Sleep Quality',
      description: '8 science-backed sleep hacks',
      category: 'sleep',
      difficulty: 'medium',
      estimatedTime: '10 min read',
      actionItems: [
        'Set consistent sleep schedule (even weekends)',
        'Dark room + cool temperature (65-68°F)',
        'No screens 1 hour before bed',
        'Try: magnesium glycinate supplement',
      ],
      icon: '😴',
    })
  }

  return tips
}

export function filterTipsByCategory(tips: HealthTip[], category: string): HealthTip[] {
  return tips.filter(t => t.category === category)
}

export function sortTipsByDifficulty(tips: HealthTip[]): HealthTip[] {
  const difficulty = { easy: 0, medium: 1, hard: 2 }
  return [...tips].sort((a, b) => difficulty[a.difficulty] - difficulty[b.difficulty])
}
