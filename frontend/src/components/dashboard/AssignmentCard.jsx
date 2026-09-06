import { motion } from 'framer-motion'
import { Clock, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { isUkrainianLocale } from '../../lib/locale.js'

export default function AssignmentCard({ assignment, onClick, animated = true, delay = 0 }) {
  const isUk = isUkrainianLocale()
  const copy = isUk
    ? { noDueDate: 'Немає терміну', untitled: 'Завдання без назви', defaultDescription: 'Виконайте це завдання' }
    : { noDueDate: 'No due date', untitled: 'Untitled Assignment', defaultDescription: 'Complete this assignment' }
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

  const dueDate = assignment.due_date ? new Date(assignment.due_date).toLocaleDateString(isUk ? 'uk-UA' : undefined) : copy.noDueDate
  const priority = assignment?.priority

  const impactTone = {
    critical: 'text-rose-600 border-rose-200 bg-rose-50',
    high: 'text-orange-600 border-orange-200 bg-orange-50',
    medium: 'text-blue-600 border-blue-200 bg-blue-50',
    low: 'text-slate-500 border-slate-200 bg-slate-50',
  }

  const urgencyTone = {
    overdue: 'text-rose-600 font-bold',
    today: 'text-orange-600 font-bold',
    soon: 'text-amber-600',
    normal: 'text-slate-400',
  }

  const animationProps = animated
    ? {
      initial: { opacity: 0, x: -20 },
      whileInView: { opacity: 1, x: 0 },
      viewport: { once: true, margin: '-100px' },
      transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] },
      whileHover: { x: 4 },
    }
    : {}

  const WrapperComponent = animated ? motion.div : 'div'

  return (
    <WrapperComponent
      className={`cabinet-card p-4 flex items-start gap-4 transition-all duration-300 group ${onClick ? 'cursor-pointer cabinet-card-hover' : ''}`}
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
      {...animationProps}
    >
      {/* Icon */}
      <motion.div
        className={`p-2.5 rounded-lg flex-shrink-0 ${statusClass} border`}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <StatusIcon className="w-5 h-5" />
      </motion.div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-slate-900 font-semibold truncate group-hover:text-emerald-700 transition text-sm">
          {assignment.title || assignment.name || copy.untitled}
        </h3>
        <p className="text-slate-500 text-xs truncate mb-2">
          {assignment.description || copy.defaultDescription}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-slate-400 text-xs">{dueDate}</p>
          {priority?.urgency && (
            <motion.span
              className={`text-[11px] font-semibold ${urgencyTone[priority.urgency] || urgencyTone.normal}`}
              animate={priority.urgency === 'overdue' ? { opacity: [0.7, 1, 0.7] } : {}}
              transition={priority.urgency === 'overdue' ? { duration: 2, repeat: Infinity } : {}}
            >
              {priority.urgency.toUpperCase()}
            </motion.span>
          )}
          {priority?.impact && (
            <span className={`text-[11px] border rounded px-1.5 py-0.5 ${impactTone[priority.impact] || impactTone.low}`}>
              {priority.impact.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Status Badge & Arrow */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {priority?.score != null && (
          <motion.span
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-600"
            whileHover={{ scale: 1.1 }}
          >
            #{priority.score}
          </motion.span>
        )}
        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusClass} border`}>
          {status.replace('_', ' ').toUpperCase()}
        </span>
        <motion.div
          animate={{ x: [0, 3, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-slate-400 group-hover:text-emerald-600 transition"
        >
          <ArrowRight className="w-4 h-4" />
        </motion.div>
      </div>
    </WrapperComponent>
  )
}
