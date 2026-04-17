import React from 'react';
import { Link } from 'react-router-dom';
import { Upload, Clipboard, Phone, Settings, MessageSquare, Calendar, Target } from 'lucide-react';

export default function QuickActionsPanel() {
  const actions = [
    {
      icon: Upload,
      label: 'Lab Results',
      description: 'View all uploaded tests',
      href: '/lab-results',
      color: 'emerald',
    },
    {
      icon: Upload,
      label: 'Upload Labs',
      description: 'Share lab results',
      href: '/upload',
      color: 'emerald',
    },
    {
      icon: Target,
      label: 'Assignments',
      description: 'Track your active tasks',
      href: '/assignments',
      color: 'blue',
    },
    {
      icon: Clipboard,
      label: 'Take Survey',
      description: 'Health questionnaire',
      href: '/questionnaire',
      color: 'blue',
    },
    {
      icon: Phone,
      label: 'Book Call',
      description: 'Use onboarding to request call',
      href: '/onboarding',
      color: 'purple',
    },
    {
      icon: MessageSquare,
      label: 'Message',
      description: 'Open support chat',
      href: '/insights',
      color: 'orange',
    },
    {
      icon: Calendar,
      label: 'Check-in',
      description: 'Weekly check-in',
      href: '/check-ins',
      color: 'pink',
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Manage profile',
      href: '/settings',
      color: 'slate',
    },
  ];

  const colorClasses = {
    emerald: 'hover:bg-emerald-50 text-emerald-600',
    blue: 'hover:bg-blue-50 text-blue-600',
    purple: 'hover:bg-purple-50 text-purple-600',
    orange: 'hover:bg-orange-50 text-orange-600',
    pink: 'hover:bg-pink-50 text-pink-600',
    slate: 'hover:bg-slate-50 text-slate-600',
  };

  return (
    <div className="vtl-light-card p-6">
      <h3 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.href}
            className={`flex min-h-[56px] items-start gap-3 rounded-xl border border-transparent p-3 transition ${colorClasses[action.color]} hover:border-emerald-200`}
          >
            <action.icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">{action.label}</p>
              <p className="text-xs text-slate-500">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
