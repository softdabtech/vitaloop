import { useState } from 'react'

export default function AddInterventionForm({ assignmentId, onSubmit, loading, canSubmit }) {
  const [form, setForm] = useState({ change_type: 'protocol_update', description: '', changes_json: '{\n  "fasting_window": { "from": "16:8", "to": "14:10" }\n}' })
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    let changes
    try {
      changes = JSON.parse(form.changes_json)
    } catch {
      setError('Changes must be valid JSON')
      return
    }

    await onSubmit({
      client_program_id: assignmentId,
      change_type: form.change_type,
      description: form.description,
      changes,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8 }}>
      <input disabled={!assignmentId || !canSubmit} value={form.change_type} onChange={(e) => setForm((prev) => ({ ...prev, change_type: e.target.value }))} placeholder="Change type" style={inputStyle} />
      <textarea disabled={!assignmentId || !canSubmit} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Intervention description" style={{ ...inputStyle, minHeight: 70 }} />
      <textarea disabled={!assignmentId || !canSubmit} value={form.changes_json} onChange={(e) => setForm((prev) => ({ ...prev, changes_json: e.target.value }))} style={{ ...inputStyle, minHeight: 110, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }} />
      {error ? <p style={{ margin: 0, color: '#ff9c9c' }}>{error}</p> : null}
      <button disabled={!assignmentId || !canSubmit || loading} type="submit" style={{ border: 'none', background: '#1d9e75', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
        {loading ? 'Saving...' : 'Add Intervention'}
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
