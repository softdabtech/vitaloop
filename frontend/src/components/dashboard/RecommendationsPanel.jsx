import React from 'react';
import { Lightbulb, BookOpen, AlertCircle } from 'lucide-react';

export default function RecommendationsPanel({ insights }) {
  return (
    <div className="vtl-light-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
        <Lightbulb className="w-5 h-5 text-amber-500" />
        AI Recommendations
      </h3>

      {insights && insights.length > 0 ? (
        <div className="space-y-3">
          {insights.slice(0, 4).map((insight, idx) => (
            <div
              key={idx}
              className="cursor-pointer rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/50"
            >
              <p className="text-slate-900 text-sm font-medium mb-1">{insight.title || insight.recommendation || 'Recommendation'}</p>
              <p className="text-slate-500 text-xs mb-2">{insight.description || insight.message || ''}</p>
              <button className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold transition">
                Learn More →
              </button>
            </div>
          ))}
          {insights.length > 4 && (
            <button className="w-full text-center py-2 text-slate-500 hover:text-emerald-600 transition text-sm font-medium">
              View all {insights.length} insights
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <BookOpen className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No recommendations yet</p>
          <p className="text-xs mt-1">Upload lab results to get personalized recommendations</p>
        </div>
      )}
    </div>
  );
}
