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
    <form onSubmit={handleSubmit} className="grid gap-2">
      <input disabled={!assignmentId || !canSubmit} value={form.change_type} onChange={(e) => setForm((prev) => ({ ...prev, change_type: e.target.value }))} placeholder="Change type" className={inputClassName} />
      <textarea disabled={!assignmentId || !canSubmit} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Intervention description" className={`${inputClassName} min-h-[70px]`} />
      <textarea disabled={!assignmentId || !canSubmit} value={form.changes_json} onChange={(e) => setForm((prev) => ({ ...prev, changes_json: e.target.value }))} className={`${inputClassName} min-h-[110px] font-mono text-xs`} />
      {error ? <p className="m-0 text-sm text-rose-300">{error}</p> : null}
      <button disabled={!assignmentId || !canSubmit || loading} type="submit" className="vtl-button-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? 'Saving...' : 'Add Intervention'}
      </button>
    </form>
  )
}

const inputClassName = 'w-full rounded-xl border border-slate-600 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60'
