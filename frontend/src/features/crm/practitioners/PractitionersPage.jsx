import { useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  getPractitioners,
  getPractitionerById,
  createPractitioner,
  assignPractitioner,
} from '../../../api/crmPractitioners.js'
import { isNotImplemented } from '../../../api/crmClient.js'
import { useCRMQuery, useCRMMutation } from '../../../hooks/useCRMQuery.js'
import { useCRMRoleAccess } from '../../../hooks/useCRMRoleAccess.js'
import CRMPageHeader from '../components/CRMPageHeader.jsx'
import PractitionerList from './PractitionerList.jsx'
import PractitionerAssignModal from './PractitionerAssignModal.jsx'

export default function PractitionersPage() {
  const { canAssignPractitioner } = useCRMRoleAccess()
  const [lookupId, setLookupId] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [form, setForm] = useState({ user_id: '', specialization: 'general', bio: '', max_clients: 20 })

  const queryFn = useCallback(() => getPractitioners(), [])
  const { data, error, loading, refetch } = useCRMQuery(queryFn, [queryFn])

  const createMutation = useCRMMutation(createPractitioner)
  const lookupMutation = useCRMMutation(getPractitionerById)
  const assignMutation = useCRMMutation(assignPractitioner)

  const practitioners = useMemo(() => {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    return []
  }, [data])

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await createMutation.mutate({
        user_id: form.user_id,
        specialization: form.specialization,
        bio: form.bio || null,
        max_clients: Number(form.max_clients) || 20,
      })
      toast.success('Practitioner created')
      setForm({ user_id: '', specialization: 'general', bio: '', max_clients: 20 })
      refetch()
    } catch (err) {
      toast.error(err.message || 'Failed to create practitioner')
    }
  }

  async function handleLookup() {
    if (!lookupId) return
    try {
      const result = await lookupMutation.mutate(lookupId)
      setLookupResult(result)
      toast.success('Practitioner loaded')
    } catch (err) {
      toast.error(err.message || 'Lookup failed')
    }
  }

  async function handleAssign(payload) {
    try {
      await assignMutation.mutate(payload)
      toast.success('Practitioner assigned to client')
      setAssignOpen(false)
    } catch (err) {
      toast.error(err.message || 'Assignment failed')
    }
  }

  const listError = isNotImplemented(error)
    ? new Error('List endpoint is not available in backend yet. Use direct lookup/create/assign tools below.')
    : error

  return (
    <div>
      <CRMPageHeader
        title="Practitioners"
        subtitle="Registry and assignment operations"
        actions={[
          <button key="assign" disabled={!canAssignPractitioner} onClick={() => setAssignOpen(true)} style={primaryBtn}>Assign Practitioner</button>,
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <form onSubmit={handleCreate} style={cardStyle}>
          <h3 style={cardTitle}>Create Practitioner</h3>
          <input value={form.user_id} onChange={(e) => setForm((prev) => ({ ...prev, user_id: e.target.value }))} placeholder="User ID" style={inputStyle} />
          <input value={form.specialization} onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))} placeholder="Specialization" style={{ ...inputStyle, marginTop: 8 }} />
          <input value={form.max_clients} type="number" min="1" onChange={(e) => setForm((prev) => ({ ...prev, max_clients: e.target.value }))} placeholder="Max clients" style={{ ...inputStyle, marginTop: 8 }} />
          <textarea value={form.bio} onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))} placeholder="Bio" style={{ ...inputStyle, marginTop: 8, minHeight: 70 }} />
          <button disabled={createMutation.loading || !canAssignPractitioner} type="submit" style={{ ...primaryBtn, marginTop: 8 }}>{createMutation.loading ? 'Creating...' : 'Create'}</button>
        </form>

        <div style={cardStyle}>
          <h3 style={cardTitle}>Lookup Practitioner by ID</h3>
          <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="Practitioner ID" style={inputStyle} />
          <button onClick={handleLookup} disabled={lookupMutation.loading || !lookupId} style={{ ...primaryBtn, marginTop: 8 }}>
            {lookupMutation.loading ? 'Loading...' : 'Lookup'}
          </button>
          <pre style={{ marginTop: 10, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 8, maxHeight: 180, overflowY: 'auto' }}>{JSON.stringify(lookupResult || {}, null, 2)}</pre>
        </div>
      </div>

      <PractitionerList loading={loading} error={listError} practitioners={practitioners} onRetry={refetch} />

      <PractitionerAssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssign={handleAssign}
        loading={assignMutation.loading}
      />
    </div>
  )
}

const cardStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: 16,
}

const cardTitle = { margin: '0 0 10px', color: '#fff' }

const inputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,0.25)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8,
  padding: '8px 10px',
}

const primaryBtn = {
  border: 'none',
  background: '#1d9e75',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
}
