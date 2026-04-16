import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Filter, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react'
import api from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import AssignmentCard from '../components/dashboard/AssignmentCard.jsx'
import { resolveAssignmentPath } from '../lib/assignmentRouting.js'
import { enrichAssignments } from '../lib/assignmentScoring.js'

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
      <div className="min-h-screen p-6 max-w-5xl mx-auto">
        <div className="animate-pulse h-8 w-64 bg-gray-700 rounded-xl mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="animate-pulse bg-gray-800 rounded-xl h-20" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="animate-pulse bg-gray-800 rounded-xl h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-green-400 mb-1 flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Assignments
          </h2>
          <p className="text-gray-400 text-sm">Track active tasks from your care protocol and coaching workflow.</p>
          <p className="text-green-300/80 text-xs mt-1">Sorted by Health Impact Score to surface the most important actions first.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/questionnaire')}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Open Questionnaire
          </button>
          <button
            onClick={() => navigate('/checkin')}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition border border-gray-700"
          >
            Weekly Check-in
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 border border-yellow-500/30 rounded-xl p-3">
          <p className="text-xs uppercase text-gray-500">Pending</p>
          <p className="text-xl font-bold text-yellow-300 mt-1">{summary.pending}</p>
        </div>
        <div className="bg-gray-900 border border-blue-500/30 rounded-xl p-3">
          <p className="text-xs uppercase text-gray-500">In Progress</p>
          <p className="text-xl font-bold text-blue-300 mt-1">{summary.in_progress}</p>
        </div>
        <div className="bg-gray-900 border border-emerald-500/30 rounded-xl p-3">
          <p className="text-xs uppercase text-gray-500">Completed</p>
          <p className="text-xl font-bold text-emerald-300 mt-1">{summary.completed}</p>
        </div>
        <div className="bg-gray-900 border border-red-500/30 rounded-xl p-3">
          <p className="text-xs uppercase text-gray-500">Overdue</p>
          <p className="text-xl font-bold text-red-300 mt-1">{summary.overdue}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        {FILTERS.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`px-3 py-1.5 text-xs rounded-full border transition ${
              filter === item.key
                ? 'border-green-500/50 bg-green-500/10 text-green-300'
                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          {filter === 'completed' ? (
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          ) : filter === 'overdue' ? (
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          ) : (
            <Clock3 className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          )}
          <p className="text-white font-semibold mb-1">No assignments in this filter</p>
          <p className="text-gray-400 text-sm">Try another filter or complete the questionnaire for new tasks.</p>
        </div>
      ) : (
        <div className="space-y-3">
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
  )
}
