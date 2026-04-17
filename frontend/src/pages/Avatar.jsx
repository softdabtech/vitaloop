import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { supabase } from '../lib/supabase.js'
import BodyAvatar from '../components/BodyAvatar.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'

export default function Avatar() {
  const { user } = useAuth()
  const [biomarkers, setBiomarkers] = useState([])

  useEffect(() => {
    if (!user) return
    supabase
      .from('biomarkers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setBiomarkers(data ?? []))
  }, [user])

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
        title="Digital Health Avatar"
        subtitle="Tap a body zone to see connected biomarkers and protocol recommendations."
        helper="This view translates your biomarker data into an interactive body map for faster interpretation."
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
