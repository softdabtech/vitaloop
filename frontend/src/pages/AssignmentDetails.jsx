import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Target, Sparkles } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { resolveAssignmentPath } from '../lib/assignmentRouting.js'

const STATUS_STYLE = {
  pending: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  in_progress: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  overdue: 'border-red-500/30 bg-red-500/10 text-red-300',
}

function normalizeAssignmentsPayload(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
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
        const direct = await api.get(`/crm/assignments/${assignmentId}`)
        if (!active) return
        setItem(direct.data || null)
        setError(null)
      } catch {
        try {
          const list = await api.get('/assignments').catch(() => api.get('/crm/assignments'))
          if (!active) return
          const all = normalizeAssignmentsPayload(list.data)
          const found = all.find((a) => String(a?.id) === String(assignmentId))
          if (found) {
            setItem(found)
            setError(null)
          } else {
            setError('Assignment not found.')
          }
        } catch {
          if (!active) return
          setError('Could not load assignment details.')
        }
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [user, assignmentId])

  const status = String(item?.status || 'pending').toLowerCase()
  const statusClass = STATUS_STYLE[status] || STATUS_STYLE.pending

  const dueDate = useMemo(() => {
    if (!item?.due_date) return 'No due date'
    return new Date(item.due_date).toLocaleDateString()
  }, [item])

  if (loading) {
    return (
      <div className="min-h-screen p-6 max-w-4xl mx-auto">
        <div className="animate-pulse h-8 w-64 bg-gray-700 rounded-xl mb-6" />
        <div className="animate-pulse h-40 bg-gray-800 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/assignments')}
        className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to assignments
      </button>

      {error ? (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-5 text-red-300 text-sm">{error}</div>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-5">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{item?.title || item?.name || 'Assignment'}</h2>
                <p className="text-gray-400 text-sm">{item?.description || 'Complete this assignment to improve your health plan quality and recommendations.'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusClass}`}>
                {status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                <p className="text-gray-500 text-xs uppercase mb-1">Due Date</p>
                <p className="text-gray-200 inline-flex items-center gap-2"><Calendar className="w-4 h-4" />{dueDate}</p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                <p className="text-gray-500 text-xs uppercase mb-1">Assignment ID</p>
                <p className="text-gray-300 break-all">{item?.id || assignmentId}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3 inline-flex items-center gap-2">
              <Target className="w-5 h-5 text-green-400" />
              Recommended next step
            </h3>
            <p className="text-gray-400 text-sm mb-4">Open the most relevant workflow for this task based on its type and content.</p>
            <button
              onClick={() => navigate(resolveAssignmentPath(item))}
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              <Sparkles className="w-4 h-4" />
              Open task workflow
            </button>
          </div>
        </>
      )}
    </div>
  )
}
