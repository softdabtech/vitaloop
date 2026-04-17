export default function CRMEmptyState({ title = 'No data yet', description = 'Try adjusting filters or create a new record.', action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/30 p-5 text-center">
      <h3 className="m-0 text-base text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
      {action || null}
    </div>
  )
}
