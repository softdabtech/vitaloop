import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, unit, icon: Icon, color, change, onClick }) {
  const colorConfig = {
    emerald: {
      icon: 'bg-emerald-500 text-white shadow-emerald-500/25',
      border: 'border-emerald-100',
      bar: 'bg-emerald-500',
    },
    blue: {
      icon: 'bg-blue-500 text-white shadow-blue-500/25',
      border: 'border-blue-100',
      bar: 'bg-blue-500',
    },
    purple: {
      icon: 'bg-purple-500 text-white shadow-purple-500/25',
      border: 'border-purple-100',
      bar: 'bg-purple-500',
    },
    orange: {
      icon: 'bg-orange-400 text-white shadow-orange-400/25',
      border: 'border-orange-100',
      bar: 'bg-orange-400',
    },
  };

  const c = colorConfig[color] ?? colorConfig.emerald;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : -1}
      className={`vtl-light-card vtl-light-card-hover self-start min-h-[160px] p-5 border-t-2 ${c.border} overflow-hidden relative ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`rounded-xl p-2.5 shadow-lg ${c.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && change !== 0 && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            change > 0
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-rose-50 text-rose-500'
          }`}>
            {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      <p className="text-2xl font-bold tracking-tight text-slate-900 leading-none">
        {value}
        {unit && <span className="ml-1.5 text-sm font-normal text-slate-400">{unit}</span>}
      </p>
    </div>
  );
}
