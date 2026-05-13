import { useMemo } from 'react'
import { Lightbulb, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react'

function TipCard({ icon: Icon, title, description, priority = 'normal' }) {
  const priorityColors = {
    high: 'border-rose-200 bg-rose-50',
    normal: 'border-blue-200 bg-blue-50',
    tip: 'border-emerald-200 bg-emerald-50',
  }

  const iconColors = {
    high: 'text-rose-600',
    normal: 'text-blue-600',
    tip: 'text-emerald-600',
  }

  return (
    <div className={`rounded-2xl border-2 p-4 ${priorityColors[priority]}`}>
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColors[priority]}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900">{title}</p>
          <p className="text-xs text-slate-600 mt-1">{description}</p>
        </div>
      </div>
    </div>
  )
}

// Biomarker-based tip helpers
function checkVitaminD(biomarkers) {
  const vitaminD = biomarkers.find(b => b.name.toLowerCase().includes('vitamin d'))
  if (vitaminD?.value && vitaminD.value < 30) {
    return {
      icon: AlertCircle,
      title: 'Vitamin D deficiency',
      description: `Your Vitamin D level is ${vitaminD.value} ng/mL. Aim for 30-100 ng/mL. Increase sun exposure or consider supplementation.`,
      priority: 'high',
    }
  }
  return null
}

function checkFerritin(biomarkers) {
  const ferritin = biomarkers.find(b => b.name.toLowerCase().includes('ferritin'))
  if (ferritin?.value && ferritin.value < 15) {
    return {
      icon: AlertCircle,
      title: 'Iron stores are low',
      description: `Your ferritin level is ${ferritin.value} ng/mL. Include iron-rich foods like red meat, legumes, or spinach in your diet.`,
      priority: 'high',
    }
  }
  return null
}

function checkB12(biomarkers) {
  const b12 = biomarkers.find(b => b.name.toLowerCase().includes('b12'))
  if (b12?.value && b12.value < 200) {
    return {
      icon: AlertCircle,
      title: 'B12 supplementation recommended',
      description: `Your B12 level is ${b12.value} pg/mL. Consider B12 supplements or increase intake of dairy, eggs, and meat.`,
      priority: 'high',
    }
  }
  return null
}

function checkPregnancyIron(biomarkers) {
  const iron = biomarkers.find(b => b.name.toLowerCase().includes('ferritin') || b.name.toLowerCase().includes('iron'))
  if (iron?.value && iron.value < 20) {
    return {
      icon: AlertCircle,
      title: 'Critical: Iron supplementation needed',
      description: 'Pregnancy increases iron demands significantly. Low iron can affect fetal development. Consult your doctor about iron supplementation.',
      priority: 'high',
    }
  }
  return null
}

// Medication-based tip helpers
function checkStatins(medications) {
  if (medications.includes('statin')) {
    return {
      icon: Lightbulb,
      title: 'Statin users: Monitor CoQ10',
      description: 'Statins can deplete CoQ10. Consider supplementation to support heart health and reduce muscle soreness.',
      priority: 'normal',
    }
  }
  return null
}

function checkMetformin(medications) {
  if (medications.includes('metformin')) {
    return {
      icon: Lightbulb,
      title: 'Metformin users: B12 awareness',
      description: 'Metformin may affect B12 absorption. Regular B12 monitoring and supplementation may be beneficial.',
      priority: 'normal',
    }
  }
  return null
}

// Goals-based tip helpers
function checkSleepGoal(goals) {
  if (goals.includes('Better sleep')) {
    return {
      icon: Lightbulb,
      title: 'Sleep optimization',
      description: 'Consider magnesium supplementation, consistent sleep schedule, and limit screen time 1 hour before bed.',
      priority: 'tip',
    }
  }
  return null
}

function checkInflammationGoal(goals) {
  if (goals.includes('Reduce inflammation')) {
    return {
      icon: Lightbulb,
      title: 'Anti-inflammatory diet',
      description: 'Focus on omega-3 rich foods (fish, nuts), colorful vegetables, and spices like turmeric.',
      priority: 'tip',
    }
  }
  return null
}

function checkHormoneGoal(goals) {
  if (goals.includes('Hormone balance')) {
    return {
      icon: Lightbulb,
      title: 'Hormonal health',
      description: 'Prioritize sleep, manage stress, include regular strength training, and ensure adequate micronutrients.',
      priority: 'tip',
    }
  }
  return null
}

function generateTips(profile, latestUpload, allUploads) {
  const tips = []

  // Biomarker-based tips
  if (latestUpload?.biomarkers && Array.isArray(latestUpload.biomarkers)) {
    ;[checkVitaminD, checkFerritin, checkB12].forEach(checker => {
      const tip = checker(latestUpload.biomarkers)
      if (tip) tips.push(tip)
    })
  }

  // Pregnancy-related tips
  if (profile.pregnancy_status === 'yes') {
    tips.push({
      icon: TrendingUp,
      title: 'Pregnancy nutrition focus',
      description: 'Priority nutrients: folate, iron, calcium, and iodine. Increase your intake to support fetal development and prevent complications.',
      priority: 'normal',
    })

    if (latestUpload?.biomarkers) {
      const tip = checkPregnancyIron(latestUpload.biomarkers)
      if (tip) tips.push(tip)
    }
  }

  // Medications and interactions
  if (profile.medications && profile.medications.trim()) {
    const meds = profile.medications.toLowerCase()
    ;[checkStatins, checkMetformin].forEach(checker => {
      const tip = checker(meds)
      if (tip) tips.push(tip)
    })
  }

  // Health goals-based tips
  if (Array.isArray(profile.goals)) {
    ;[checkSleepGoal, checkInflammationGoal, checkHormoneGoal].forEach(checker => {
      const tip = checker(profile.goals)
      if (tip) tips.push(tip)
    })
  }

  // General progress tips
  if (allUploads && allUploads.length >= 2) {
    tips.push({
      icon: CheckCircle2,
      title: 'Track your progress',
      description: 'You have multiple uploads! Review your biomarker trends to see the impact of your efforts.',
      priority: 'tip',
    })
  }

  // Default tips if no specific recommendations
  if (tips.length === 0) {
    tips.push({
      icon: Lightbulb,
      title: 'Start tracking biomarkers',
      description: 'Upload your first lab test to get personalized health recommendations based on your specific biomarker levels.',
      priority: 'tip',
    })
  }

  return tips.slice(0, 4)
}

export default function PersonalizedHealthTips({ profile = {}, latestUpload, allUploads = [] }) {
  const tips = useMemo(() => {
    return generateTips(profile, latestUpload, allUploads)
  }, [profile, latestUpload, allUploads])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb className="h-5 w-5 text-amber-600" />
        <h3 className="font-semibold text-slate-900 text-sm">Health Tips</h3>
      </div>
      <div className="space-y-3">
        {tips.map((tip, idx) => (
          <TipCard
            key={idx}
            icon={tip.icon}
            title={tip.title}
            description={tip.description}
            priority={tip.priority}
          />
        ))}
      </div>
    </div>
  )
}
