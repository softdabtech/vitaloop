import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, unit, icon: Icon, color, change }) {
  const colorClasses = {
    emerald: 'from-emerald-500 to-emerald-600 text-emerald-400',
    blue: 'from-blue-500 to-blue-600 text-blue-400',
    purple: 'from-purple-500 to-purple-600 text-purple-400',
    orange: 'from-orange-500 to-orange-600 text-orange-400',
  };

  return (
    <div className="vtl-card vtl-card-hover min-h-[180px] p-6">
      <div className="flex items-start justify-between mb-3">
        <div className={`rounded-2xl border border-white/5 bg-gradient-to-br p-3 ${colorClasses[color]} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${colorClasses[color].split(' ')[2]}`} />
        </div>
        {change !== undefined && change !== 0 && (
          <div className={`flex items-center gap-1 text-sm font-semibold ${
            change > 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {change > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="mb-1 text-sm text-slate-400">{title}</p>
      <p className="text-3xl font-bold tracking-tight text-slate-100">
        {value}
        <span className="ml-1 text-lg text-slate-400">{unit}</span>
      </p>
    </div>
  );
}
