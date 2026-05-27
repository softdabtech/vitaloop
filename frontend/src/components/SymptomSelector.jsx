import { SYMPTOM_OPTIONS } from '../lib/symptoms.js'

export default function SymptomSelector({ selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-600">Link this upload to current symptoms</p>
      <div className="flex flex-wrap gap-2">
        {SYMPTOM_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              selected.includes(id)
                ? 'border-emerald-400 bg-emerald-500 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
