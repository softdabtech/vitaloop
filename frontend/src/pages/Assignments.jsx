import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, Filter, CheckCircle2, Clock3, AlertTriangle, Check, Sparkles } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import AssignmentCard from '../components/dashboard/AssignmentCard.jsx'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
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

async function fetchAssignmentsWithFallback() {
  const primary = await api.get('/assignments').catch(() => null)
  if (primary) return normalizeAssignmentsPayload(primary.data)
  const fallback = await api.get('/crm/assignments')
  return normalizeAssignmentsPayload(fallback.data)
}

function buildSummaryBuckets(prioritized) {
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
}

function getTodayItems(prioritized) {
  const today = new Date().toDateString()
  return prioritized.filter((item) => {
    const dueDate = item?.due_date || item?.deadline || item?.due_at
    if (!dueDate) return false
    const itemDate = new Date(dueDate).toDateString()
    return itemDate === today && String(item?.status || '').toLowerCase() !== 'completed'
  })
}

function toggleIdInSet(sourceSet, id) {
  const next = new Set(sourceSet)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
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

  const summary = useMemo(() => buildSummaryBuckets(prioritized), [prioritized])

  const todayItems = useMemo(() => getTodayItems(prioritized), [prioritized])

  const todayCompleted = useMemo(() => {
    return Array.from(completedToday).length
  }, [completedToday])

  const handleQuickComplete = (itemId) => {
    setCompletedToday((prev) => toggleIdInSet(prev, itemId))
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-slate-500">
        Loading assignments...
      </div>
    )
  }

  return (
    <div className="min-h-screen vtl-cabinet-bg px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <CabinetPageHeader
          icon={ClipboardList}
          eyebrow="Action Plan"
          title={ct().assignments.title}
          subtitle={ct().assignments.subtitle}
          helper={ct().assignments.helper}
          action={(
            <>
              <button
                onClick={() => navigate('/questionnaire')}
                className="vtl-button-primary px-4 text-sm"
              >
                Open Symptom Check
              </button>
              <button
                onClick={() => navigate('/check-ins')}
                className="vtl-button-secondary px-4 text-sm"
              >
                Check-in
              </button>
            </>
          )}
        />

        <div className="-mt-2 mb-6 text-xs text-emerald-600">Sorted by Health Impact Score and mapped to protocol stage.</div>

        {/* Today's Checklist */}
        {todayItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6"
          >
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
          </motion.div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0 }}
            whileHover={{ y: -4, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
            className="vtl-light-card p-4 transition-all"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{summary.pending}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            whileHover={{ y: -4, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
            className="vtl-light-card p-4 transition-all"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">In Progress</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{summary.in_progress}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ y: -4, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
            className="vtl-light-card p-4 transition-all"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Completed</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{summary.completed}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            whileHover={{ y: -4, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
            className="vtl-light-card p-4 transition-all"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overdue</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{summary.overdue}</p>
          </motion.div>
        </motion.div>

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
            <p className="text-sm text-slate-500">Try another filter or complete Symptom Check to refresh your action plan.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 gap-4 xl:grid-cols-2"
          >
            {filtered.map((assignment, idx) => (
              <motion.div
                key={assignment.id || `${assignment.title || 'a'}-${idx}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
              >
                <AssignmentCard
                  assignment={assignment}
                  onClick={() => {
                    if (assignment?.id) {
                      navigate(`/assignments/${assignment.id}`)
                      return
                    }
                    navigate(resolveAssignmentPath(assignment))
                  }}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
