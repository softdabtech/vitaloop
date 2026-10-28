import { useState } from 'react'
import StatusBadge from '../components/StatusBadge.jsx'

export default function ClientProgramCard({ client, programs, assignment, onAssign, onStart, onPause, mutateLoading, canManage }) {
  const [programId, setProgramId] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <div className="vtl-card rounded-2xl p-4">
      <h3 className="mb-3 mt-0 text-lg font-semibold text-slate-100">Program Workflow</h3>
      <div className="mb-3 grid gap-2 text-sm text-slate-300">
        <div><strong>Active Program ID:</strong> <code>{client?.active_program_id || 'none'}</code></div>
        <div><strong>Assignment ID:</strong> <code>{assignment?.id || 'not loaded'}</code></div>
        <div><strong>Status:</strong> {assignment?.status ? <StatusBadge status={assignment.status} /> : 'n/a'}</div>
      </div>

      <div className="grid gap-2">
        <select disabled={!canManage || mutateLoading} value={programId} onChange={(e) => setProgramId(e.target.value)} className={inputClassName}>
          <option value="">Select program</option>
          {(programs || []).map((program) => (
            <option key={program.id} value={program.id}>{program.name}</option>
          ))}
        </select>
        <input disabled={!canManage || mutateLoading} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assignment notes" className={inputClassName} />
        <button
          disabled={!canManage || !programId || mutateLoading}
          onClick={() => onAssign({ client_id: client.id, program_id: programId, notes })}
          className="vtl-button-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          Assign Program
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <button disabled={!assignment?.id || mutateLoading || !canManage} onClick={() => onStart(assignment.id)} className="vtl-button-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">Start</button>
        <button disabled={!assignment?.id || mutateLoading || !canManage} onClick={() => onPause(assignment.id)} className="vtl-button-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">Pause</button>
      </div>
    </div>
  )
}

const inputClassName = 'w-full rounded-xl border border-slate-600 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60'
