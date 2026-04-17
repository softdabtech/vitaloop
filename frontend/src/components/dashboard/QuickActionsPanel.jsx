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
      href: '/timeline',
      color: 'orange',
    },
    {
      icon: Calendar,
      label: 'Check-in',
      description: 'Weekly check-in',
      href: '/checkin',
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
    emerald: 'hover:bg-emerald-500/20 text-emerald-400',
    blue: 'hover:bg-blue-500/20 text-blue-400',
    purple: 'hover:bg-purple-500/20 text-purple-400',
    orange: 'hover:bg-orange-500/20 text-orange-400',
    pink: 'hover:bg-pink-500/20 text-pink-400',
    slate: 'hover:bg-slate-700 text-slate-400',
  };

  return (
    <div className="vtl-card p-6">
      <h3 className="mb-4 text-lg font-semibold tracking-tight text-slate-100">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.href}
            className={`flex min-h-[56px] items-start gap-3 rounded-xl border border-transparent p-3 transition ${colorClasses[action.color]} hover:border-emerald-400/30`}
          >
            <action.icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{action.label}</p>
              <p className="text-xs text-slate-400">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
