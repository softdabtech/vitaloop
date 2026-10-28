const ROLE_COLORS = {
  super_admin: 'border-indigo-500/35 bg-indigo-500/15 text-indigo-200',
  org_admin: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-200',
  practitioner: 'border-orange-500/35 bg-orange-500/15 text-orange-200',
  end_user: 'border-slate-500/35 bg-slate-500/15 text-slate-300',
}

export default function RoleBadge({ role = 'end_user' }) {
  const palette = ROLE_COLORS[role] || ROLE_COLORS.end_user
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${palette}`}>
      {role.replace('_', ' ')}
    </span>
  )
}
