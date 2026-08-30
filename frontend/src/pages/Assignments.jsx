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
import { CoachButton, CoachCard, CoachChip, CoachSkeleton } from '../components/coach/CoachUI.jsx'
import { isUkrainianLocale } from '../lib/locale.js'
import '../styles/dashboard2026.css'
// coach-shell/coach-card/etc. (CoachUI.jsx) have no built-in styles of their
// own — every rule lives in this stylesheet. Vite code-splits CSS per lazy
// route chunk, so each page using CoachUI must import it directly or it
// renders as unstyled browser-default HTML, not a build error.
import '../styles/coach-design-system.css'

const ASSIGNMENTS_COPY = {
  en: {
    eyebrow: 'Action Plan',
    openSymptomCheck: 'Open Symptom Check',
    checkIn: 'Check-in',
    sortedBy: 'Sorted by Health Impact Score and mapped to protocol stage.',
    loading: 'Loading assignments...',
    couldNotLoad: 'Could not load assignments.',
    todaysChecklist: "Today's Checklist",
    tasksForToday: (count) => `${count} task${count > 1 ? 's' : ''} for today`,
    completed: 'completed',
    moreInFullList: (count) => `+${count} more in the full list`,
    allDoneToday: 'All done for today! Great job!',
    untitledTask: 'Untitled task',
    pending: 'Pending',
    inProgress: 'In Progress',
    completedLabel: 'Completed',
    overdue: 'Overdue',
    filters: {
      all: 'All',
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      overdue: 'Overdue',
    },
    emptyTitle: 'No assignments in this filter',
    emptyBody: 'Try another filter or complete Symptom Check to refresh your action plan.',
  },
  uk: {
    eyebrow: 'План дій',
    openSymptomCheck: 'Почати перевірку симптомів',
    checkIn: 'Чек-ін',
    sortedBy: 'Відсортовано за впливом на здоровʼя та етапом протоколу.',
    loading: 'Завантажуємо завдання...',
    couldNotLoad: 'Не вдалося завантажити завдання.',
    todaysChecklist: 'Список на сьогодні',
    tasksForToday: (count) => `${count} ${count === 1 ? 'завдання' : 'завдань'} на сьогодні`,
    completed: 'виконано',
    moreInFullList: (count) => `+${count} ще у повному списку`,
    allDoneToday: 'Усе виконано на сьогодні! Чудова робота!',
    untitledTask: 'Завдання без назви',
    pending: 'Очікує',
    inProgress: 'У процесі',
    completedLabel: 'Виконано',
    overdue: 'Прострочено',
    filters: {
      all: 'Усі',
      pending: 'Очікує',
      in_progress: 'У процесі',
      completed: 'Виконано',
      overdue: 'Прострочено',
    },
    emptyTitle: 'Немає завдань у цьому фільтрі',
    emptyBody: 'Спробуйте інший фільтр або пройдіть перевірку симптомів, щоб оновити план дій.',
  },
}

const FILTER_KEYS = ['all', 'pending', 'in_progress', 'completed', 'overdue']

function normalizeAssignmentsPayload(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
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
  const isUk = isUkrainianLocale()
  const copy = isUk ? ASSIGNMENTS_COPY.uk : ASSIGNMENTS_COPY.en
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
        setError(copy.couldNotLoad)
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
    return <div className="coach-shell"><CoachSkeleton rows={3} /></div>
  }

  return (
    <div className="coach-shell coach-grid">
      <CabinetPageHeader
        icon={ClipboardList}
        eyebrow={copy.eyebrow}
        title={ct().assignments.title}
        subtitle={ct().assignments.subtitle}
        helper={ct().assignments.helper}
        action={(
          <>
            <CoachButton size="sm" onClick={() => navigate('/questionnaire')}>{copy.openSymptomCheck}</CoachButton>
            <CoachButton size="sm" variant="secondary" onClick={() => navigate('/check-ins')}>{copy.checkIn}</CoachButton>
          </>
        )}
      />

      <p className="-mt-2 text-xs text-emerald-600">{copy.sortedBy}</p>

      {/* Today's Checklist */}
      {todayItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <CoachCard tone="soft" className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-emerald-900">✅ {copy.todaysChecklist}</h3>
                <p className="mt-1 text-sm text-emerald-700">{copy.tasksForToday(todayItems.length)}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold text-emerald-600">{todayCompleted}/{todayItems.length}</div>
                <p className="text-xs font-semibold text-emerald-600">{copy.completed}</p>
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
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-white text-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                        isCompleted
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-slate-300'
                      }`}
                    >
                      {isCompleted && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${isCompleted ? 'line-through opacity-60' : ''}`}>
                        {item.title || copy.untitledTask}
                      </p>
                    </div>
                    {item?.priority?.score > 75 && !isCompleted && (
                      <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-500" />
                    )}
                  </button>
                )
              })}
              {todayItems.length > 5 && (
                <p className="pt-2 text-center text-xs text-emerald-600">
                  {copy.moreInFullList(todayItems.length - 5)}
                </p>
              )}
            </div>

            {todayCompleted === todayItems.length && todayItems.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-100 px-3 py-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700">🎉 {copy.allDoneToday}</p>
              </div>
            )}
          </CoachCard>
        </motion.div>
      )}

      {error && (
        <CoachCard tone="attention" className="p-4">
          <p className="text-sm text-rose-700">{error}</p>
        </CoachCard>
      )}

      <div className="coach-grid coach-grid--3">
        <CoachCard className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.pending}</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{summary.pending}</p>
        </CoachCard>
        <CoachCard className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.inProgress}</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-600">{summary.in_progress}</p>
        </CoachCard>
        <CoachCard className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.completedLabel}</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-600">{summary.completed}</p>
        </CoachCard>
        <CoachCard className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{copy.overdue}</p>
          <p className="mt-1 text-2xl font-extrabold text-rose-600">{summary.overdue}</p>
        </CoachCard>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        {FILTER_KEYS.map((key) => (
          <CoachChip
            key={key}
            active={filter === key}
            onClick={() => setFilter(key)}
          >
            {copy.filters[key]}
          </CoachChip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <CoachCard className="p-10 text-center">
          {filter === 'completed' ? (
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          ) : filter === 'overdue' ? (
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          ) : (
            <Clock3 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          )}
          <p className="mb-1 font-semibold text-slate-800">{copy.emptyTitle}</p>
          <p className="text-sm text-slate-500">{copy.emptyBody}</p>
        </CoachCard>
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
  )
}
