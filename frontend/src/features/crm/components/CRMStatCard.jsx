export default function CRMStatCard({ label, value, hint, tone = '#1d9e75' }) {
  return (
    <div className="vtl-card rounded-2xl p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: tone }}>{label}</div>
      <div className="mt-2 text-3xl font-bold leading-none text-slate-100">{value}</div>
      <div className="mt-2 text-xs text-slate-400">{hint || '\u00a0'}</div>
    </div>
  )
}
