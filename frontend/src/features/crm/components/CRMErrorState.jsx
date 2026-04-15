export default function CRMErrorState({ title = 'Failed to load data', error, onRetry }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 14, padding: 20 }}>
      <h3 style={{ margin: 0, color: '#ff7d7d', fontSize: 16 }}>{title}</h3>
      <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
        {error?.message || 'Unexpected error occurred while loading this screen.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ marginTop: 14, border: 'none', background: '#1d9e75', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
