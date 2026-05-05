import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, XCircle, ArrowLeft, CreditCard } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import '../styles/dashboard2026.css'

const STATUS_META = {
  active:   { label: 'Active',   icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-100' },
  past_due: { label: 'Past Due', icon: Clock,        color: 'text-amber-700 bg-amber-100' },
  paused:   { label: 'Paused',   icon: Clock,        color: 'text-amber-700 bg-amber-100' },
  cancelled:{ label: 'Cancelled',icon: XCircle,      color: 'text-red-700 bg-red-100' },
}

function fmt(ts) {
  if (!ts) return '—'
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const PLAN_LABELS = { personal: 'Personal Premium', practitioner: 'Enterprise', core: 'Personal Premium' }

export default function BillingHistory() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    api.get('/stripe/billing-history')
      .then(({ data }) => setRows(data.history || []))
      .catch(() => setError('Failed to load billing history.'))
      .finally(() => setLoading(false))
  }, [user])

  return (
    <>
      <CabinetPageHeader
        title="Billing History"
        subtitle="Your subscription timeline and plan changes"
        helper="All subscription events are listed newest-first."
      />

      <div className="grid gap-6">
        <div>
          <button
            onClick={() => navigate('/subscription')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Subscription
          </button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 text-sm">{error}</div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No billing history yet.</p>
            <p className="text-slate-400 text-sm mt-1">Subscription events will appear here once you subscribe via Stripe.</p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-4 font-semibold text-slate-600">Plan</th>
                  <th className="text-left px-6 py-4 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-6 py-4 font-semibold text-slate-600">Period Start</th>
                  <th className="text-left px-6 py-4 font-semibold text-slate-600">Period End</th>
                  <th className="text-left px-6 py-4 font-semibold text-slate-600">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const meta = STATUS_META[row.status] || STATUS_META.active
                  const Icon = meta.icon
                  return (
                    <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {PLAN_LABELS[row.plan_name] || row.plan_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{fmt(row.current_period_start || row.started_at)}</td>
                      <td className="px-6 py-4 text-slate-600">{fmt(row.current_period_end)}</td>
                      <td className="px-6 py-4 text-slate-500">{fmt(row.updated_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
