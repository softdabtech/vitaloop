import { ArrowRight, CheckCircle2, Info, Loader2 } from 'lucide-react'

export function CoachButton({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  trailingIcon: TrailingIcon,
  className = '',
  ...props
}) {
  const classes = ['coach-button', `coach-button--${variant}`, `coach-button--${size}`, className].filter(Boolean).join(' ')
  return (
    <button className={classes} {...props}>
      {Icon && <Icon className="coach-button__icon" aria-hidden="true" />}
      <span>{children}</span>
      {TrailingIcon ? <TrailingIcon className="coach-button__icon" aria-hidden="true" /> : null}
    </button>
  )
}

export function CoachCard({ children, className = '', tone = 'default', interactive = false, ...props }) {
  return (
    <section className={`coach-card coach-card--${tone} ${interactive ? 'coach-card--interactive' : ''} ${className}`} {...props}>
      {children}
    </section>
  )
}

export function CoachBadge({ children, tone = 'neutral', className = '' }) {
  return <span className={`coach-badge coach-badge--${tone} ${className}`}>{children}</span>
}

export function CoachChip({ children, active = false, icon: Icon, className = '', ...props }) {
  return (
    <button type="button" className={`coach-chip ${active ? 'coach-chip--active' : ''} ${className}`} {...props}>
      {Icon && <Icon className="coach-chip__icon" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  )
}

export function CoachInput({ label, helper, error, className = '', children }) {
  return (
    <label className={`coach-field ${className}`}>
      {label && <span className="coach-field__label">{label}</span>}
      {children}
      {helper && !error && <span className="coach-field__helper">{helper}</span>}
      {error && <span className="coach-field__error">{error}</span>}
    </label>
  )
}

export function CoachProgress({ value = 0, label, tone = 'primary' }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))
  // Displayed label is rounded (e.g. "93%" not "92.86%") — bar width still
  // uses the unrounded value so it stays pixel-accurate.
  const displayValue = Math.round(safeValue)
  return (
    <div className="coach-progress" aria-label={label}>
      {label && (
        <div className="coach-progress__header">
          <span>{label}</span>
          <span>{displayValue}%</span>
        </div>
      )}
      <div className="coach-progress__track">
        <div className={`coach-progress__bar coach-progress__bar--${tone}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}

export function CoachTooltip({ children, text }) {
  return (
    <span className="coach-tooltip">
      {children}
      <span className="coach-tooltip__bubble" role="tooltip">{text}</span>
    </span>
  )
}

export function CoachSkeleton({ rows = 3 }) {
  return (
    <CoachCard className="coach-skeleton" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => <span key={index} className="coach-skeleton__line" />)}
    </CoachCard>
  )
}

export function EmptyCoachState({ icon: Icon = Info, title, body, actionLabel, onAction }) {
  return (
    <CoachCard className="coach-empty">
      <div className="coach-empty__icon"><Icon className="h-6 w-6" /></div>
      <h2>{title}</h2>
      <p>{body}</p>
      {actionLabel && onAction && (
        <CoachButton onClick={onAction} trailingIcon={ArrowRight}>{actionLabel}</CoachButton>
      )}
    </CoachCard>
  )
}

export function KPIBlock({ label, value, helper, tone = 'neutral', icon: Icon }) {
  return (
    <CoachCard className="coach-kpi">
      <div className={`coach-kpi__icon coach-kpi__icon--${tone}`}>{Icon ? <Icon className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}</div>
      <div>
        <p className="coach-kpi__label">{label}</p>
        <p className="coach-kpi__value">{value}</p>
        {helper && <p className="coach-kpi__helper">{helper}</p>}
      </div>
    </CoachCard>
  )
}

export function InsightCard({ eyebrow, title, body, icon: Icon, tone = 'primary', actionLabel, onAction }) {
  return (
    <CoachCard className="coach-insight">
      <div className={`coach-insight__icon coach-insight__icon--${tone}`}>{Icon ? <Icon className="h-5 w-5" /> : <Info className="h-5 w-5" />}</div>
      <div className="min-w-0">
        {eyebrow && <p className="coach-eyebrow">{eyebrow}</p>}
        <h3>{title}</h3>
        <p>{body}</p>
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="coach-link-button">
            {actionLabel} <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </CoachCard>
  )
}

export function CoachLoadingButton({ loading, children, ...props }) {
  return (
    <CoachButton disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="coach-button__icon animate-spin" />}
      {children}
    </CoachButton>
  )
}
