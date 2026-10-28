import CRMErrorState from './CRMErrorState.jsx'
import CRMEmptyState from './CRMEmptyState.jsx'

export default function CRMTableState({ loading, error, isEmpty, emptyTitle, emptyDescription, onRetry, children }) {
  if (loading) {
    return (
      <div className="vtl-card rounded-2xl p-6 text-slate-400">
        Loading...
      </div>
    )
  }

  if (error) {
    return <CRMErrorState error={error} onRetry={onRetry} />
  }

  if (isEmpty) {
    return <CRMEmptyState title={emptyTitle} description={emptyDescription} />
  }

  return children
}
