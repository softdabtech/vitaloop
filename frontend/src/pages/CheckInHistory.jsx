import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, RotateCcw } from 'lucide-react'
import api from '../lib/api.js'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import '../styles/dashboard2026.css'

function formatDate(value) {
  if (!value) return 'Date not recorded'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Date not recorded'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date)
}

export function checkInSummary(item) {
  return item?.symptom_changes || item?.new_complaints || item?.notes || 'No symptom note recorded'
}

export default function CheckInHistory() {
  const [items, setItems] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')

  const loadHistory = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const { data } = await api.get('/checkins/history')
      setItems(Array.isArray(data) ? data : [])
      setState('ready')
    } catch {
      setState('error')
      setError('We could not load your check-in history right now. Please try again.')
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  return (
    <div className="vtl-page px-4 py-8 sm:px-6">
      <CabinetPageHeader
        title="Check-in history"
        subtitle="Review the weekly check-ins you have submitted."
        helper="This history only includes persisted weekly check-ins. Your initial symptom questionnaire is available from Symptom Check."
      />

      {state === 'loading' && (
        <div className="space-y-3" aria-label="Loading check-in history">
          {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      )}

      {state === 'error' && (
        <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          <p>{error}</p>
          <button type="button" onClick={loadHistory} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 font-semibold">
            <RotateCcw className="h-4 w-4" />
            Retry
          </button>
        </section>
      )}

      {state === 'ready' && items.length === 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-1 h-5 w-5 text-emerald-700" />
            <div>
              <h2 className="font-bold text-slate-900">{ct().checkin_extra.noCheckin}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Complete a weekly check-in from Symptom Check to see it here.</p>
            </div>
          </div>
        </section>
      )}

      {state === 'ready' && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, index) => (
            <article key={item.id || `${item.week_start}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weekly check-in</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{formatDate(item.week_start)}</h2>
                </div>
                {item.protocol_adherence != null && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
                    Adherence {item.protocol_adherence}/5
                  </span>
                )}
              </div>
              <p className="mt-4 break-words text-sm leading-6 text-slate-700">{checkInSummary(item)}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                {item.energy_score != null && <span>Energy: {item.energy_score}/10</span>}
                {item.sleep_quality != null && <span>Sleep: {item.sleep_quality}/10</span>}
                {item.mood_score != null && <span>Mood: {item.mood_score}/10</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
