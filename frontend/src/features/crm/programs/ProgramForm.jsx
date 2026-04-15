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
    <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
      <h3 style={{ margin: '0 0 10px', color: '#fff' }}>Create Program</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Program name" style={inputStyle} />
        <select value={form.category} onChange={(e) => handleChange('category', e.target.value)} style={inputStyle}>
          <option value="wellness">Wellness</option>
          <option value="metabolic-optimization">Metabolic Optimization</option>
          <option value="longevity">Longevity</option>
          <option value="athletic-performance">Athletic Performance</option>
          <option value="custom">Custom</option>
        </select>
        <input type="number" min="1" value={form.duration_days} onChange={(e) => handleChange('duration_days', e.target.value)} placeholder="Duration days" style={inputStyle} />
        <input value={form.checkpoint_intervals} onChange={(e) => handleChange('checkpoint_intervals', e.target.value)} placeholder="7,14,30" style={inputStyle} />
        <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Description" style={{ ...inputStyle, gridColumn: '1 / span 2', minHeight: 76, resize: 'vertical' }} />
      </div>
      {error ? <p style={{ color: '#ff9c9c', margin: '8px 0 0' }}>{error}</p> : null}
      <button disabled={!canManage || submitting} type="submit" style={{ marginTop: 10, border: 'none', background: canManage ? '#1d9e75' : '#64748b', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: canManage ? 'pointer' : 'not-allowed' }}>
        {submitting ? 'Creating...' : 'Create Program'}
      </button>
    </form>
  )
}

const inputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,0.25)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8,
  padding: '8px 10px',
}
