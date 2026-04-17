import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Filter, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import AssignmentCard from '../components/dashboard/AssignmentCard.jsx'
import { resolveAssignmentPath } from '../lib/assignmentRouting.js'
import { enrichAssignments } from '../lib/assignmentScoring.js'
import '../styles/dashboard2026.css'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
]

function normalizeAssignmentsPayload(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
}

export default function Assignments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!user) return

    let active = true
    const request = api.get('/assignments').catch(() => api.get('/crm/assignments'))

    request
      .then((res) => {
        if (!active) return
        setItems(normalizeAssignmentsPayload(res.data))
        setError(null)
      })
      .catch(() => {
        if (!active) return
        setError('Could not load assignments.')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  const prioritized = useMemo(() => {
    return enrichAssignments(items)
      .sort((a, b) => (b?.priority?.score || 0) - (a?.priority?.score || 0))
  }, [items])

  const filtered = useMemo(() => {
    if (filter === 'all') return prioritized
    return prioritized.filter((item) => String(item?.status || '').toLowerCase() === filter)
  }, [prioritized, filter])

  const summary = useMemo(() => {
    const buckets = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
    }
    prioritized.forEach((item) => {
      const status = String(item?.status || '').toLowerCase()
      if (status in buckets) buckets[status] += 1
    })
    return buckets
  }, [prioritized])

  if (loading) {
    return (
      <div className="vtl-shell min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 h-8 w-64 animate-pulse rounded-xl bg-slate-700" />
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-800" />
          ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-800" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="vtl-shell min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="vtl-card mb-6 flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
            <h2 className="mb-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-100">
            <ClipboardList className="h-6 w-6 text-emerald-300" />
            Assignments
          </h2>
            <p className="text-sm text-slate-300">Track active tasks from your care protocol and coaching workflow.</p>
            <p className="mt-1 text-xs text-emerald-300/85">Sorted by Health Impact Score to surface the most important actions first.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/questionnaire')}
              className="vtl-button-primary px-4 text-sm"
          >
            Open Questionnaire
          </button>
          <button
            onClick={() => navigate('/checkin')}
              className="vtl-button-secondary px-4 text-sm"
          >
            Weekly Check-in
          </button>
        </div>
      </div>

      {error && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="vtl-card p-3">
            <p className="text-xs uppercase text-slate-500">Pending</p>
            <p className="mt-1 text-xl font-bold text-amber-300">{summary.pending}</p>
        </div>
          <div className="vtl-card p-3">
            <p className="text-xs uppercase text-slate-500">In Progress</p>
            <p className="mt-1 text-xl font-bold text-sky-300">{summary.in_progress}</p>
        </div>
          <div className="vtl-card p-3">
            <p className="text-xs uppercase text-slate-500">Completed</p>
            <p className="mt-1 text-xl font-bold text-emerald-300">{summary.completed}</p>
        </div>
          <div className="vtl-card p-3">
            <p className="text-xs uppercase text-slate-500">Overdue</p>
            <p className="mt-1 text-xl font-bold text-rose-300">{summary.overdue}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          {FILTERS.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                filter === item.key
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

      {filtered.length === 0 ? (
          <div className="vtl-card p-10 text-center">
          {filter === 'completed' ? (
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
          ) : filter === 'overdue' ? (
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          ) : (
              <Clock3 className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          )}
            <p className="mb-1 font-semibold text-slate-100">No assignments in this filter</p>
            <p className="text-sm text-slate-400">Try another filter or complete the questionnaire for new tasks.</p>
        </div>
      ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filtered.map((assignment, idx) => (
              <AssignmentCard
                key={assignment.id || `${assignment.title || 'a'}-${idx}`}
                assignment={assignment}
                onClick={() => {
                  if (assignment?.id) {
                    navigate(`/assignments/${assignment.id}`)
                    return
                  }
                  navigate(resolveAssignmentPath(assignment))
                }}
              />
            ))}
          </div>
      )}
      </div>
    </div>
  )
}
