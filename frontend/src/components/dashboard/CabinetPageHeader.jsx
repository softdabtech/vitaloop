export default function CabinetPageHeader({
  title,
  subtitle,
  helper,
  action = null,
  className = '',
}) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className={`vtl-light-card relative overflow-hidden p-5 sm:p-6 ${action ? 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between' : ''}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500" />
        <div>
          <h2 className="mb-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
          {subtitle && <p className="text-sm leading-relaxed text-slate-600">{subtitle}</p>}
          {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </div>
  )
}
