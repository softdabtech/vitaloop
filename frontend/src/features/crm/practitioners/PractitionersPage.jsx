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
          <button key="assign" disabled={!canAssignPractitioner} onClick={() => setAssignOpen(true)} className="vtl-button-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">Assign Practitioner</button>,
        ]}
      />

      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <form onSubmit={handleCreate} className="vtl-card rounded-2xl p-4">
          <h3 className="mb-3 mt-0 text-lg font-semibold text-slate-100">Create Practitioner</h3>
          <input value={form.user_id} onChange={(e) => setForm((prev) => ({ ...prev, user_id: e.target.value }))} placeholder="User ID" className={inputClassName} />
          <input value={form.specialization} onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))} placeholder="Specialization" className={`${inputClassName} mt-2`} />
          <input value={form.max_clients} type="number" min="1" onChange={(e) => setForm((prev) => ({ ...prev, max_clients: e.target.value }))} placeholder="Max clients" className={`${inputClassName} mt-2`} />
          <textarea value={form.bio} onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))} placeholder="Bio" className={`${inputClassName} mt-2 min-h-[70px]`} />
          <button disabled={createMutation.loading || !canAssignPractitioner} type="submit" className="vtl-button-primary mt-3 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">{createMutation.loading ? 'Creating...' : 'Create'}</button>
        </form>

        <div className="vtl-card rounded-2xl p-4">
          <h3 className="mb-3 mt-0 text-lg font-semibold text-slate-100">Lookup Practitioner by ID</h3>
          <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="Practitioner ID" className={inputClassName} />
          <button onClick={handleLookup} disabled={lookupMutation.loading || !lookupId} className="vtl-button-primary mt-3 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
            {lookupMutation.loading ? 'Loading...' : 'Lookup'}
          </button>
          <pre className="mt-3 max-h-[180px] overflow-y-auto rounded-lg bg-slate-950/55 p-2 text-xs text-slate-200">{JSON.stringify(lookupResult || {}, null, 2)}</pre>
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

const inputClassName = 'w-full rounded-xl border border-slate-600 bg-slate-900/65 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
