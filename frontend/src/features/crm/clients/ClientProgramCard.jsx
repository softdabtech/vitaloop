import { useState } from 'react'
import StatusBadge from '../components/StatusBadge.jsx'

export default function ClientProgramCard({ client, programs, assignment, onAssign, onStart, onPause, mutateLoading, canManage }) {
  const [programId, setProgramId] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
      <h3 style={{ margin: '0 0 10px', color: '#fff' }}>Program Workflow</h3>
      <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>
        <div><strong>Active Program ID:</strong> <code>{client?.active_program_id || 'none'}</code></div>
        <div><strong>Assignment ID:</strong> <code>{assignment?.id || 'not loaded'}</code></div>
        <div><strong>Status:</strong> {assignment?.status ? <StatusBadge status={assignment.status} /> : 'n/a'}</div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <select disabled={!canManage || mutateLoading} value={programId} onChange={(e) => setProgramId(e.target.value)} style={inputStyle}>
          <option value="">Select program</option>
          {(programs || []).map((program) => (
            <option key={program.id} value={program.id}>{program.name}</option>
          ))}
        </select>
        <input disabled={!canManage || mutateLoading} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assignment notes" style={inputStyle} />
        <button
          disabled={!canManage || !programId || mutateLoading}
          onClick={() => onAssign({ client_id: client.id, program_id: programId, notes })}
          style={buttonStyle}
        >
          Assign Program
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button disabled={!assignment?.id || mutateLoading || !canManage} onClick={() => onStart(assignment.id)} style={buttonStyle}>Start</button>
        <button disabled={!assignment?.id || mutateLoading || !canManage} onClick={() => onPause(assignment.id)} style={buttonStyle}>Pause</button>
      </div>
    </div>
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

const buttonStyle = {
  border: 'none',
  background: '#1d9e75',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
}
