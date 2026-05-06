/**
 * StatusBadge Component
 * Colored badge for displaying status (optimal, warning, critical)
 * Supports different status levels with appropriate colors
 */

export default function StatusBadge({
  status = 'optimal', // 'optimal' | 'warning' | 'critical'
  label,
  icon: Icon,
  animated = false,
  className = '',
}) {
  const statusClasses = {
    optimal: 'cabinet-badge cabinet-badge-success',
    warning: 'cabinet-badge cabinet-badge-warning',
    critical: 'cabinet-badge cabinet-badge-danger',
    primary: 'cabinet-badge cabinet-badge-primary',
  }

  const baseClass = statusClasses[status] || statusClasses.optimal
  const animationClass = animated ? 'animate-pulse' : ''
  const finalClass = `${baseClass} ${animationClass} ${className}`

  return (
    <span className={finalClass}>
      {Icon && <Icon className="w-4 h-4 mr-1" />}
      {label}
    </span>
  )
}
