import { SYMPTOM_OPTIONS } from '../lib/symptoms.js'

export default function SymptomSelector({ selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <div>
      <p className="text-sm text-gray-400 mb-2">Select your symptoms (optional — improves accuracy)</p>
      <div className="flex flex-wrap gap-2">
        {SYMPTOM_OPTIONS.map(({ id, label }) => (
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
