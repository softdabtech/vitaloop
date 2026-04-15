import CRMErrorState from './CRMErrorState.jsx'
import CRMEmptyState from './CRMEmptyState.jsx'

export default function CRMTableState({ loading, error, isEmpty, emptyTitle, emptyDescription, onRetry, children }) {
  if (loading) {
    return (
      <div style={{ padding: 22, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: 'rgba(255,255,255,0.6)' }}>
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
