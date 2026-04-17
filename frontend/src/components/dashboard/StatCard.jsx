import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, unit, icon: Icon, color, change }) {
  const colorClasses = {
    emerald: 'bg-emerald-50 ring-1 ring-emerald-500/20 text-emerald-600',
    blue: 'bg-blue-50 ring-1 ring-blue-500/20 text-blue-600',
    purple: 'bg-purple-50 ring-1 ring-purple-500/20 text-purple-600',
    orange: 'bg-orange-50 ring-1 ring-orange-500/20 text-orange-600',
  };

  return (
    <div className="vtl-light-card vtl-light-card-hover min-h-[160px] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`rounded-xl p-2.5 ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && change !== 0 && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${
            change > 0 ? 'text-emerald-600' : 'text-rose-500'
          }`}>
            {change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <p className="text-2xl font-bold tracking-tight text-slate-900">
        {value}
        <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
      </p>
    </div>
  );
}
