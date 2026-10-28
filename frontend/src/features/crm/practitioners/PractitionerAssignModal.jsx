import { useState } from 'react'

export default function PractitionerAssignModal({ open, onClose, onAssign, loading }) {
  const [clientId, setClientId] = useState('')
  const [practitionerId, setPractitionerId] = useState('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 px-3">
      <div className="vtl-card w-full max-w-[520px] rounded-2xl p-4">
        <h3 className="mb-2 mt-0 text-lg font-semibold text-slate-100">Assign Practitioner to Client</h3>
        <p className="mb-3 text-sm text-slate-400">Uses real endpoint POST /crm/practitioners/assign.</p>
        <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" className={inputClassName} />
        <input value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} placeholder="Practitioner ID" className={`${inputClassName} mt-2`} />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="vtl-button-secondary px-4 py-2 text-sm">Cancel</button>
          <button
            disabled={!clientId || !practitionerId || loading}
            onClick={() => onAssign({ client_id: clientId, practitioner_id: practitionerId })}
            className="vtl-button-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputClassName = 'w-full rounded-xl border border-slate-600 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
