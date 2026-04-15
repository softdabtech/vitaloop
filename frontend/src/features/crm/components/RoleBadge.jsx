const ROLE_COLORS = {
  super_admin: { bg: 'rgba(79,70,229,0.2)', text: '#a5b4fc' },
  org_admin: { bg: 'rgba(29,158,117,0.2)', text: '#65d6b1' },
  practitioner: { bg: 'rgba(249,115,22,0.2)', text: '#fdba74' },
  end_user: { bg: 'rgba(148,163,184,0.2)', text: '#cbd5e1' },
}

export default function RoleBadge({ role = 'end_user' }) {
  const palette = ROLE_COLORS[role] || ROLE_COLORS.end_user
  return (
    <span style={{
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      padding: '4px 8px',
      borderRadius: 999,
      background: palette.bg,
      color: palette.text,
      fontWeight: 700,
    }}>
      {role.replace('_', ' ')}
    </span>
  )
}
