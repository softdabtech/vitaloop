import { useState } from 'react'

export default function PractitionerAssignModal({ open, onClose, onAssign, loading }) {
  const [clientId, setClientId] = useState('')
  const [practitionerId, setPractitionerId] = useState('')

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 80 }}>
      <div style={{ width: 520, maxWidth: '94vw', background: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: '0 0 10px', color: '#fff' }}>Assign Practitioner to Client</h3>
        <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,0.62)', fontSize: 13 }}>Uses real endpoint POST /crm/practitioners/assign.</p>
        <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" style={inputStyle} />
        <input value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} placeholder="Practitioner ID" style={{ ...inputStyle, marginTop: 8 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button
            disabled={!clientId || !practitionerId || loading}
            onClick={() => onAssign({ client_id: clientId, practitioner_id: practitionerId })}
            style={primaryBtn}
          >
            {loading ? 'Assigning...' : 'Assign'}
          </button>
        </div>
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

const ghostBtn = {
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'transparent',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
}

const primaryBtn = {
  border: 'none',
  background: '#1d9e75',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
}
