export default function CabinetPageHeader({
  title,
  subtitle,
  helper,
  action = null,
  className = '',
}) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className={`vtl-light-card p-5 sm:p-6 ${action ? 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between' : ''}`}>
        <div>
          <h2 className="mb-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
          {subtitle && <p className="text-sm leading-relaxed text-slate-500">{subtitle}</p>}
          {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
    </div>
  )
}
