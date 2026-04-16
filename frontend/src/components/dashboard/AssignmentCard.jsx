import React from 'react';
import { Clock, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

export default function AssignmentCard({ assignment, onClick }) {
  const statusColors = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const statusIcons = {
    pending: Clock,
    in_progress: AlertCircle,
    completed: CheckCircle,
    overdue: AlertCircle,
  };

  const status = assignment.status || 'pending';
  const StatusIcon = statusIcons[status] || Clock;
  const statusClass = statusColors[status] || statusColors.pending;

  const dueDate = assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date';
  const priority = assignment?.priority;

  const impactTone = {
    critical: 'text-red-300 border-red-500/30 bg-red-500/10',
    high: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
    medium: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
    low: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
  };

  const urgencyTone = {
    overdue: 'text-red-300',
    today: 'text-orange-300',
    soon: 'text-yellow-300',
    normal: 'text-slate-400',
  };

  return (
    <div
      className={`bg-slate-700 hover:bg-slate-600/80 border border-slate-600 rounded-lg p-4 flex items-start gap-4 transition group ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Icon */}
      <div className={`p-3 rounded-lg flex-shrink-0 ${statusClass} border`}>
        <StatusIcon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold truncate group-hover:text-emerald-400 transition">
          {assignment.title || assignment.name || 'Untitled Assignment'}
        </h3>
        <p className="text-slate-400 text-sm truncate mb-2">
          {assignment.description || 'Complete this assignment'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-slate-500 text-xs">{dueDate}</p>
          {priority?.urgency && (
            <span className={`text-[11px] ${urgencyTone[priority.urgency] || urgencyTone.normal}`}>
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
      <div className="flex items-center gap-3 flex-shrink-0">
        {priority?.score != null && (
          <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-800 border border-slate-600 text-slate-200">
            {priority.score}
          </span>
        )}
        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusClass} border`}>
          {status.replace('_', ' ').toUpperCase()}
        </span>
        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
      </div>
    </div>
  );
}
