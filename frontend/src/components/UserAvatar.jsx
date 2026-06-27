import { getInitials, getAvatarGradient, getAvatarUrl } from '../lib/avatar.js'

/**
 * Circular user avatar — shows photo if available, otherwise initials with gradient.
 *
 * Props:
 *   user       — Supabase user object
 *   size       — px number (default 36)
 *   name       — override display name
 *   className  — extra CSS classes
 *   onClick    — click handler
 *   border     — show white border (default false)
 */
export default function UserAvatar({ user, size = 36, name, className = '', onClick, border = false }) {
  const avatarUrl = getAvatarUrl(user)
  const displayName = name || user?.user_metadata?.full_name || user?.email || ''
  const initials   = getInitials(displayName, user?.email)
  const [g1, g2]  = getAvatarGradient(user?.id || user?.email || '')

  const style = {
    width:  size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: onClick ? 'pointer' : 'default',
    border: border ? `2px solid rgba(255,255,255,0.9)` : 'none',
    boxShadow: border ? '0 2px 8px rgba(15,23,42,0.18)' : 'none',
    background: avatarUrl ? 'transparent' : `linear-gradient(135deg, ${g1}, ${g2})`,
    fontSize: Math.round(size * 0.36),
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.02em',
    userSelect: 'none',
  }

  return (
    <div style={style} className={className} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {avatarUrl
        ? <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials
      }
    </div>
  )
}
