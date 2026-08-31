// NOTE: unreachable for real users — see the same note in Assignments.jsx
// (App.jsx redirects both /assignments and /assignments/:id to /dashboard).
// Later-product-stage feature (coached/practitioner-attached users), hidden
// not deleted.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Target, Sparkles } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { resolveAssignmentPath } from '../lib/assignmentRouting.js'

const STATUS_STYLE = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  overdue: 'border-rose-200 bg-rose-50 text-rose-700',
}

function normalizeAssignmentsPayload(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
}

async function fetchAssignmentById(assignmentId) {
  try {
    const direct = await api.get(`/crm/assignments/${assignmentId}`)
    return direct.data || null
  } catch {
    const list = await api.get('/assignments').catch(() => api.get('/crm/assignments'))
    const all = normalizeAssignmentsPayload(list.data)
    return all.find((a) => String(a?.id) === String(assignmentId)) || null
  }
}

function formatDueDate(dueDateValue) {
  if (!dueDateValue) return 'No due date'
  return new Date(dueDateValue).toLocaleDateString()
}

function formatStatusLabel(status) {
  return String(status || 'pending').replace('_', ' ').toUpperCase()
}

export default function AssignmentDetails() {
  const { user } = useAuth()
  const { assignmentId } = useParams()
  const navigate = useNavigate()

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user || !assignmentId) return

    let active = true

    async function load() {
      try {
        const found = await fetchAssignmentById(assignmentId)
        if (!active) return
        if (found) {
          setItem(found)
          setError(null)
        } else {
          setError('Assignment not found.')
        }
      } catch {
        if (!active) return
        setError('Could not load assignment details.')
      } finally {
        setLoading(false)
      }
      if (!active) return
    }

    load()

    return () => {
      active = false
    }
  }, [user, assignmentId])

  const status = String(item?.status || 'pending').toLowerCase()
  const statusClass = STATUS_STYLE[status] || STATUS_STYLE.pending

  const dueDate = useMemo(() => formatDueDate(item?.due_date), [item?.due_date])

  if (loading) {
    return (
      <div className="vtl-page min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse h-8 w-64 bg-slate-200 rounded-xl mb-6" />
          <div className="animate-pulse h-40 bg-slate-100 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="vtl-page min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/assignments')}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to assignments
        </button>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-700 text-sm">{error}</div>
        ) : (
          <>
            <div className="vtl-light-card p-6 mb-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">{item?.title || item?.name || 'Assignment'}</h2>
                  <p className="text-slate-500 text-sm">{item?.description || 'Complete this assignment to improve your health plan quality and recommendations.'}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusClass}`}>
                  {formatStatusLabel(status)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-slate-400 text-xs uppercase mb-1">Due Date</p>
                  <p className="text-slate-700 inline-flex items-center gap-2"><Calendar className="w-4 h-4" />{dueDate}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-slate-400 text-xs uppercase mb-1">Assignment ID</p>
                  <p className="text-slate-600 break-all">{item?.id || assignmentId}</p>
                </div>
              </div>
            </div>

            <div className="vtl-light-card p-6">
              <h3 className="text-slate-900 font-semibold mb-3 inline-flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600" />
                Recommended next step
              </h3>
              <p className="text-slate-500 text-sm mb-4">Open the most relevant workflow for this task based on its type and content.</p>
              <button
                onClick={() => navigate(resolveAssignmentPath(item))}
                className="vtl-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
              >
                <Sparkles className="w-4 h-4" />
                Open task workflow
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
