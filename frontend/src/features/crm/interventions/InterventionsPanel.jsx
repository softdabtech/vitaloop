import AddInterventionForm from './AddInterventionForm.jsx'

export default function InterventionsPanel({ assignmentId, interventions, onAdd, loading, canSubmit }) {
  const items = interventions || []

  return (
    <div className="vtl-card rounded-2xl p-4">
      <h3 className="mb-3 mt-0 text-lg font-semibold text-slate-100">Interventions</h3>
      {!assignmentId ? (
        <p className="mb-3 text-sm text-slate-400">Assign a client program first to enable intervention timeline.</p>
      ) : null}
      <AddInterventionForm assignmentId={assignmentId} onSubmit={onAdd} loading={loading} canSubmit={canSubmit} />
      <div className="mt-4 grid gap-2.5">
        {!items.length ? (
          <div className="text-sm text-slate-500">No interventions recorded in this session yet.</div>
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
