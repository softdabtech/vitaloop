import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function CabinetPageHeader({
  title,
  subtitle,
  helper,
  backTo = '/dashboard',
  backLabel = 'Back to dashboard',
  action = null,
  className = '',
}) {
  const navigate = useNavigate()

  return (
    <div className={`mb-6 ${className}`}>
      <button
        onClick={() => navigate(backTo)}
        className="mb-3 inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>

      <div className="vtl-light-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
    </div>
  )
}
