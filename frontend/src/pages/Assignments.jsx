import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Filter, CheckCircle2, Clock3, AlertTriangle, Check, Sparkles } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import AssignmentCard from '../components/dashboard/AssignmentCard.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
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
  const [completedToday, setCompletedToday] = useState(new Set())

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

  const todayItems = useMemo(() => {
    const today = new Date().toDateString()
    return prioritized.filter((item) => {
      const dueDate = item?.due_date || item?.deadline || item?.due_at
      if (!dueDate) return false
      const itemDate = new Date(dueDate).toDateString()
      return itemDate === today && String(item?.status || '').toLowerCase() !== 'completed'
    })
  }, [prioritized])

  const todayCompleted = useMemo(() => {
    return Array.from(completedToday).length
  }, [completedToday])

  const handleQuickComplete = (itemId) => {
    const newCompleted = new Set(completedToday)
    if (newCompleted.has(itemId)) {
      newCompleted.delete(itemId)
    } else {
      newCompleted.add(itemId)
    }
    setCompletedToday(newCompleted)
  }

  if (loading) {
    return (
      <div className="vtl-page px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 h-8 w-64 animate-pulse rounded-xl bg-slate-200" />
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="vtl-page px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <CabinetPageHeader
          title="Assignments"
          subtitle="Track active tasks from your care protocol and coaching workflow."
          helper="Concrete next actions with due dates, urgency and health-impact scoring."
          action={(
            <>
              <button
                onClick={() => navigate('/questionnaire')}
                className="vtl-button-primary px-4 text-sm"
              >
                Open Questionnaire
              </button>
              <button
                onClick={() => navigate('/check-ins')}
                className="vtl-button-secondary px-4 text-sm"
              >
                Weekly Check-in
              </button>
            </>
          )}
        />

        <div className="-mt-2 mb-6 text-xs text-emerald-600">Sorted by Health Impact Score to surface the most important actions first.</div>

        {/* Today's Checklist */}
        {todayItems.length > 0 && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-emerald-900">✅ Today's Checklist</h3>
                <p className="text-sm text-emerald-700 mt-1">{todayItems.length} task{todayItems.length > 1 ? 's' : ''} for today</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-emerald-600">{todayCompleted}/{todayItems.length}</div>
                <p className="text-xs text-emerald-600 font-semibold">completed</p>
              </div>
            </div>

            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-300"
                style={{ width: `${(todayCompleted / todayItems.length) * 100}%` }}
              />
            </div>

            <div className="space-y-2">
              {todayItems.slice(0, 5).map((item) => {
                const isCompleted = completedToday.has(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => handleQuickComplete(item.id)}
                    className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-white hover:bg-emerald-50 text-slate-700'
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                        isCompleted
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-slate-300'
                      }`}
                    >
                      {isCompleted && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isCompleted ? 'line-through opacity-60' : ''}`}>
                        {item.title || 'Untitled task'}
                      </p>
                    </div>
                    {item?.priority?.score > 75 && !isCompleted && (
                      <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
              {todayItems.length > 5 && (
                <p className="text-xs text-emerald-600 text-center pt-2">
                  +{todayItems.length - 5} more in the full list
                </p>
              )}
            </div>

            {todayCompleted === todayItems.length && todayItems.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-100 py-2 px-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700">🎉 All done for today! Great job!</p>
              </div>
            )}
          </div>
        )}

      {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="vtl-light-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{summary.pending}</p>
        </div>
          <div className="vtl-light-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">In Progress</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{summary.in_progress}</p>
        </div>
          <div className="vtl-light-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Completed</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{summary.completed}</p>
        </div>
          <div className="vtl-light-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overdue</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{summary.overdue}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          {FILTERS.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filter === item.key
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

      {filtered.length === 0 ? (
          <div className="vtl-light-card p-10 text-center">
          {filter === 'completed' ? (
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          ) : filter === 'overdue' ? (
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          ) : (
              <Clock3 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          )}
            <p className="mb-1 font-semibold text-slate-800">No assignments in this filter</p>
            <p className="text-sm text-slate-500">Try another filter or complete the questionnaire for new tasks.</p>
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
