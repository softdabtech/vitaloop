// P39 -- unified cabinet header: same gradient-hero visual family as the
// coach-hero pages (see .cabinet-header-hero in dashboard2026.css), so every
// cabinet page shares one header language instead of Today's cockpit-hero
// gradient sitting next to a plain flat white card everywhere else.
export default function CabinetPageHeader({
  title,
  subtitle,
  helper,
  action = null,
  className = '',
}) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className={`cabinet-header-hero ${action ? 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between' : ''}`}>
        <div>
          <h1 className="cabinet-title">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-500">{subtitle}</p>}
          {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
    </div>
  )
}
