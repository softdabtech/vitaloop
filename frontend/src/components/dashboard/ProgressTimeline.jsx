import React from 'react';
import { Calendar, CheckCircle, RefreshCw } from 'lucide-react';

export default function ProgressTimeline({ progress }) {
  const timelineEvents = progress
    .slice(-10)
    .reverse()
    .map((item, idx) => ({
      id: idx,
      date: item.test_date ? new Date(item.test_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
      title: `${item.lab_name || 'Lab Upload'} Results`,
      description: `${item.biomarkers?.length || 0} biomarkers analyzed`,
      type: 'upload',
    }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-400" />
        Activity Timeline
      </h3>

      {timelineEvents.length > 0 ? (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {timelineEvents.map((event, idx) => (
            <div key={event.id} className="flex gap-4 relative">
              {/* Timeline Line */}
              {idx !== timelineEvents.length - 1 && (
                <div className="absolute left-4 top-10 w-0.5 h-12 bg-slate-600" />
              )}

              {/* Timeline Dot */}
              <div className="flex-shrink-0 relative z-10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border-2 border-slate-800">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <p className="text-white font-medium text-sm">{event.title}</p>
                <p className="text-slate-400 text-xs mb-1">{event.description}</p>
                <p className="text-slate-500 text-xs">{event.date}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <RefreshCw className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No activity yet</p>
          <p className="text-xs mt-1">Your progress will show up here</p>
        </div>
      )}
    </div>
  );
}
