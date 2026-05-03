import React from 'react'
import { Clock, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'

export default function AssignmentCard({ assignment, onClick }) {
  const statusColors = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    overdue: 'bg-rose-50 text-rose-700 border-rose-200',
  }

  const statusIcons = {
    pending: Clock,
    in_progress: AlertCircle,
    completed: CheckCircle,
    overdue: AlertCircle,
  }

  const status = assignment.status || 'pending'
  const StatusIcon = statusIcons[status] || Clock
  const statusClass = statusColors[status] || statusColors.pending

  const dueDate = assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'
  const priority = assignment?.priority

  const impactTone = {
    critical: 'text-rose-600 border-rose-200 bg-rose-50',
    high: 'text-orange-600 border-orange-200 bg-orange-50',
    medium: 'text-blue-600 border-blue-200 bg-blue-50',
    low: 'text-slate-500 border-slate-200 bg-slate-50',
  }

  const urgencyTone = {
    overdue: 'text-rose-600',
    today: 'text-orange-600',
    soon: 'text-amber-600',
    normal: 'text-slate-400',
  }

  return (
    <div
      className={`vtl-light-card vtl-light-card-hover p-4 flex items-start gap-4 transition group ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Icon */}
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${statusClass} border`}>
        <StatusIcon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-slate-900 font-semibold truncate group-hover:text-emerald-700 transition text-sm">
          {assignment.title || assignment.name || 'Untitled Assignment'}
        </h3>
        <p className="text-slate-500 text-xs truncate mb-2">
          {assignment.description || 'Complete this assignment'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-slate-400 text-xs">{dueDate}</p>
          {priority?.urgency && (
            <span className={`text-[11px] font-semibold ${urgencyTone[priority.urgency] || urgencyTone.normal}`}>
              {priority.urgency.toUpperCase()}
            </span>
          )}
          {priority?.impact && (
            <span className={`text-[11px] border rounded px-1.5 py-0.5 ${impactTone[priority.impact] || impactTone.low}`}>
              IMPACT {priority.impact.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Status Badge & Arrow */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {priority?.score != null && (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-600">
            {priority.score}
          </span>
        )}
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusClass} border`}>
          {status.replace('_', ' ').toUpperCase()}
        </span>
        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
      </div>
    </div>
  )
}
