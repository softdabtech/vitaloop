import { useEffect, useState, useCallback } from 'react'
import AddInterventionForm from './AddInterventionForm.jsx'
import { crmClient } from '../../../api/crmClient.js'

export default function InterventionsPanel({ assignmentId, clientId, interventions, onAdd, loading, canSubmit }) {
  const [items, setItems] = useState(interventions || [])
  const [fetchLoading, setFetchLoading] = useState(false)

  const fetchInterventions = useCallback(async () => {
    // Use clientId if provided, otherwise fall back to assignmentId
    const id = clientId || assignmentId
    if (!id) return

    setFetchLoading(true)
    try {
      // Fetch interventions for this client across all programs
      const data = await crmClient.get(`/crm/clients/${id}/interventions`)
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch interventions:', err)
    } finally {
      setFetchLoading(false)
    }
  }, [assignmentId, clientId])

  useEffect(() => {
    if (clientId || assignmentId) {
      fetchInterventions()
    }
  }, [clientId, assignmentId, fetchInterventions])

  useEffect(() => {
    if (interventions && interventions.length > 0) {
      setItems(interventions)
    }
  }, [interventions])

  return (
    <div className="vtl-card rounded-2xl p-4">
      <h3 className="mb-3 mt-0 text-lg font-semibold text-slate-100">Interventions</h3>
      {!clientId && !assignmentId ? (
        <p className="mb-3 text-sm text-slate-400">Load a client to view intervention timeline.</p>
      ) : null}
      <AddInterventionForm assignmentId={assignmentId} onSubmit={onAdd} loading={loading} canSubmit={canSubmit} />
      <div className="mt-4 grid gap-2.5">
        {!items.length ? (
          <div className="text-sm text-slate-500">{fetchLoading ? 'Loading...' : 'No interventions recorded yet.'}</div>
        ) : (
          items.map((item, idx) => (
            <div key={`${item?.id || 'local'}-${idx}`} className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-3">
              <div className="mb-1 text-sm font-semibold text-slate-100">{item.change_type || 'update'}</div>
              <div className="text-sm text-slate-300">{item.description || '-'}</div>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/60 p-2 text-xs text-slate-200">{JSON.stringify(item.changes || {}, null, 2)}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
