import { useState } from 'react'

const INITIAL = {
  name: '',
  description: '',
  category: 'wellness',
  duration_days: 30,
  checkpoint_intervals: '7,14,30',
}

export default function ProgramForm({ onSubmit, submitting, canManage }) {
  const [form, setForm] = useState(INITIAL)
  const [error, setError] = useState('')

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('Program name is required')
      return
    }

    const intervals = form.checkpoint_intervals
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0)

    await onSubmit({
      name: form.name.trim(),
      description: form.description || null,
      category: form.category,
      duration_days: Number(form.duration_days) || 30,
      checkpoint_intervals: intervals.length ? intervals : [7, 14, 30],
      template_protocol: {},
      biomarker_targets: {},
    })

    setForm(INITIAL)
  }

  return (
    <form onSubmit={handleSubmit} className="vtl-card rounded-2xl p-4">
      <h3 className="mb-3 mt-0 text-lg font-semibold text-slate-100">Create Program</h3>
      <div className="grid gap-2 md:grid-cols-2">
        <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Program name" className={inputClassName} />
        <select value={form.category} onChange={(e) => handleChange('category', e.target.value)} className={inputClassName}>
          <option value="wellness">Wellness</option>
          <option value="metabolic-optimization">Metabolic Optimization</option>
          <option value="longevity">Longevity</option>
          <option value="athletic-performance">Athletic Performance</option>
          <option value="custom">Custom</option>
        </select>
        <input type="number" min="1" value={form.duration_days} onChange={(e) => handleChange('duration_days', e.target.value)} placeholder="Duration days" className={inputClassName} />
        <input value={form.checkpoint_intervals} onChange={(e) => handleChange('checkpoint_intervals', e.target.value)} placeholder="7,14,30" className={inputClassName} />
        <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Description" className={`${inputClassName} min-h-[76px] resize-y md:col-span-2`} />
      </div>
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
      <button disabled={!canManage || submitting} type="submit" className="vtl-button-primary mt-3 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? 'Creating...' : 'Create Program'}
      </button>
    </form>
  )
}

const inputClassName = 'w-full rounded-xl border border-slate-600 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
