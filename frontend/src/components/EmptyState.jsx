export default function EmptyState({ icon = '🧬', title, subtitle, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="text-6xl mb-4 opacity-60">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm max-w-xs mb-6">{subtitle}</p>
      {action && (
        <button
          onClick={onAction}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
        >
          {action}
        </button>
      )}
    </div>
  )
}
