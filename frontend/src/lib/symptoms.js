export const SYMPTOM_OPTIONS = [
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'insomnia', label: 'Insomnia' },
  { id: 'brain_fog', label: 'Brain Fog' },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'depression', label: 'Depression' },
  { id: 'hair_loss', label: 'Hair Loss' },
  { id: 'weight_gain', label: 'Weight Gain' },
  { id: 'weight_loss', label: 'Weight Loss' },
  { id: 'low_libido', label: 'Low Libido' },
  { id: 'muscle_weakness', label: 'Muscle Weakness' },
  { id: 'joint_pain', label: 'Joint Pain' },
  { id: 'poor_immunity', label: 'Poor Immunity' },
  { id: 'digestive_issues', label: 'Digestive Issues' },
  { id: 'skin_problems', label: 'Skin Problems' },
  { id: 'mood_swings', label: 'Mood Swings' },
  { id: 'poor_concentration', label: 'Poor Concentration' },
  { id: 'cold_intolerance', label: 'Cold Intolerance' },
]

export const SYMPTOM_LABEL_MAP = Object.fromEntries(
  SYMPTOM_OPTIONS.map((item) => [item.id, item.label])
)
