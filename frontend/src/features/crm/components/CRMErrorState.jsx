export default function CRMErrorState({ title = 'Failed to load data', error, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-5">
      <h3 className="m-0 text-base text-rose-300">{title}</h3>
      <p className="mt-2 text-sm text-slate-200">
        {error?.message || 'Unexpected error occurred while loading this screen.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="vtl-button-primary mt-3 px-4 py-2 text-sm"
        >
          Retry
        </button>
      )}
    </div>
  )
}
