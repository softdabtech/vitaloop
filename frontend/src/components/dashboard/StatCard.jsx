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
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 hover:border-slate-600 transition">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]} bg-opacity-10`}>
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
      <p className="text-slate-400 text-sm mb-1">{title}</p>
      <p className="text-white text-2xl font-bold">
        {value}
        <span className="text-slate-400 text-lg ml-1">{unit}</span>
      </p>
    </div>
  );
}
