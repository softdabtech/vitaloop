import React from 'react'
import { Link } from 'react-router-dom'
import { Upload, FlaskConical, Clipboard, Activity, Calendar, BarChart3, Clock, Settings } from 'lucide-react'

export default function QuickActionsPanel() {
  const actions = [
    {
      icon: Upload,
      label: 'Upload Labs',
      description: 'Share new lab results',
      href: '/upload',
      color: 'emerald',
    },
    {
      icon: FlaskConical,
      label: 'Lab Results',
      description: 'View all uploaded tests',
      href: '/lab-results',
      color: 'teal',
    },
    {
      icon: Activity,
      label: 'Assignments',
      description: 'Track active tasks',
      href: '/assignments',
      color: 'blue',
    },
    {
      icon: Clipboard,
      label: 'Questionnaire',
      description: 'Health self-assessment',
      href: '/questionnaire',
      color: 'purple',
    },
    {
      icon: BarChart3,
      label: 'Insights',
      description: 'Trends & red flags',
      href: '/insights',
      color: 'orange',
    },
    {
      icon: Clock,
      label: 'Check-in',
      description: 'Weekly check-in',
      href: '/check-ins',
      color: 'pink',
    },
    {
      icon: Calendar,
      label: 'Progress',
      description: 'View progress timeline',
      href: '/progress',
      color: 'indigo',
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Manage profile',
      href: '/settings',
      color: 'slate',
    },
  ]

  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
    teal:    'bg-teal-50 text-teal-600 group-hover:bg-teal-100',
    blue:    'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
    purple:  'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
    orange:  'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
    pink:    'bg-pink-50 text-pink-600 group-hover:bg-pink-100',
    indigo:  'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100',
    slate:   'bg-slate-100 text-slate-500 group-hover:bg-slate-200',
  }

  return (
    <div className="vtl-light-card p-6">
      <h3 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">Quick Actions</h3>
      <div className="space-y-1.5">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.href}
            className="group flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-slate-50"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition ${colorClasses[action.color] ?? colorClasses.slate}`}>
              <action.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 group-hover:text-slate-900">{action.label}</p>
              <p className="text-xs text-slate-400 truncate">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
