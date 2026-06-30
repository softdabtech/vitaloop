import { useMemo } from 'react'
import BodyAvatar from '../components/BodyAvatar.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useProgress } from '../hooks/useQueries.js'

export default function Avatar() {
  const { data: progressRows = [] } = useProgress()

  const biomarkers = useMemo(() => {
    const rows = Array.isArray(progressRows) ? progressRows : []
    const withBiomarkers = rows
      .filter((row) => Array.isArray(row?.biomarkers) && row.biomarkers.length > 0)
      .sort((a, b) => {
        const aTime = new Date(a?.created_at || a?.test_date || 0).getTime()
        const bTime = new Date(b?.created_at || b?.test_date || 0).getTime()
        return bTime - aTime
      })

    const latest = withBiomarkers[0]?.biomarkers || []
    return latest.map((item, index) => ({
      id: item?.id || `${item?.name || 'biomarker'}-${index}`,
      name: String(item?.name || ''),
      status: String(item?.status || '').toUpperCase(),
      value: item?.value,
      unit: item?.unit,
    }))
  }, [progressRows])

  const counts = biomarkers.reduce((acc, item) => {
    const status = String(item?.status || '').toUpperCase()
    if (status === 'OPTIMAL') acc.optimal += 1
    else if (status === 'BORDERLINE') acc.borderline += 1
    else if (status === 'DEFICIENT' || status === 'ELEVATED') acc.attention += 1
    return acc
  }, { optimal: 0, borderline: 0, attention: 0 })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <CabinetPageHeader
        title={ct().avatar.title}
        subtitle={ct().avatar.subtitle}
        helper={ct().avatar.helper}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="vtl-light-card rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">{counts.optimal}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Optimal</div>
        </div>
        <div className="vtl-light-card rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{counts.borderline}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Borderline</div>
        </div>
        <div className="vtl-light-card rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-rose-600">{counts.attention}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs attention</div>
        </div>
      </div>

      <section className="vtl-light-card rounded-3xl p-5 sm:p-6">
        <BodyAvatar biomarkers={biomarkers} />
      </section>
    </div>
  )
}
