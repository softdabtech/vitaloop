// P38b — shared width/centering wrapper for cabinet pages. Owns ONLY
// `.cabinet-page-frame` (max-width + horizontal centering, see
// dashboard2026.css) so migrated pages share one width token instead of
// repeating `mx-auto max-w-6xl`. No card/border/background/radius/shadow,
// no fetching/state/navigation/header config -- callers render their own
// content as children.
export default function CabinetPageFrame({ children, className = '' }) {
  return (
    <div className={`cabinet-page-frame${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}
