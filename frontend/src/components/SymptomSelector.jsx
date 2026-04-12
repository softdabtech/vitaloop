const SYMPTOMS = [
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

export default function SymptomSelector({ selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <div>
      <p className="text-sm text-gray-400 mb-2">Select your symptoms (optional — improves accuracy)</p>
      <div className="flex flex-wrap gap-2">
        {SYMPTOMS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              selected.includes(id)
                ? 'bg-green-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
