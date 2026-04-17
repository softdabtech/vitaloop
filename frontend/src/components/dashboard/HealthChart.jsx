import React, { useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function HealthChart({ progress }) {
  const normalizeStatus = (status) => {
    const value = String(status || '').toLowerCase();
    if (value.includes('optimal') || value.includes('normal')) return 'optimal';
    if (value.includes('border') || value.includes('warn')) return 'warning';
    if (value.includes('critical') || value.includes('deficient') || value.includes('elevated')) return 'critical';
    return 'warning';
  };

  const isVitaminOrMineral = (name) => {
    const key = String(name || '').toLowerCase();
    const keywords = [
      'vitamin', 'd3', 'b12', 'folate', 'ferritin', 'iron', 'magnesium', 'zinc',
      'selenium', 'calcium', 'potassium', 'sodium', 'copper', 'iodine', 'phosphorus',
    ];
    return keywords.some((item) => key.includes(item));
  };

  const microMarkerCatalog = useMemo(() => {
    const store = new Map();
    progress.forEach((item) => {
      (item.biomarkers || []).forEach((marker) => {
        if (!isVitaminOrMineral(marker?.name)) return;
        if (!store.has(marker.name)) {
          store.set(marker.name, {
            name: marker.name,
            unit: marker.unit || '',
            refLow: Number.isFinite(Number(marker.ref_low)) ? Number(marker.ref_low) : null,
            refHigh: Number.isFinite(Number(marker.ref_high)) ? Number(marker.ref_high) : null,
          });
          return;
        }

        const existing = store.get(marker.name);
        const low = Number(marker.ref_low);
        const high = Number(marker.ref_high);

        if (!existing.unit && marker.unit) existing.unit = marker.unit;
        if (existing.refLow == null && Number.isFinite(low)) existing.refLow = low;
        if (existing.refHigh == null && Number.isFinite(high)) existing.refHigh = high;
      });
    });

    return [...store.values()];
  }, [progress]);

  const [selectedMarkers, setSelectedMarkers] = useState([]);

  const activeMarkers = selectedMarkers.length > 0
    ? microMarkerCatalog.filter((item) => selectedMarkers.includes(item.name)).slice(0, 4)
    : microMarkerCatalog.slice(0, 4);

  const toggleMarker = (name) => {
    setSelectedMarkers((prev) => {
      if (prev.includes(name)) {
        return prev.filter((item) => item !== name);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), name];
      }
      return [...prev, name];
    });
  };

  // Transform progress data for chart
  const chartData = progress.slice(-12).map((item) => ({
    date: item.test_date ? new Date(item.test_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
    biomarkers: item.biomarkers?.length || 0,
    uploads: 1,
  }));

  const biomarkerTrend = progress
    .slice(-12)
    .reduce((acc, item) => {
      if (item.biomarkers && item.biomarkers.length > 0) {
        return [
          ...acc,
          {
            date: item.test_date ? new Date(item.test_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
            optimal: item.biomarkers.filter((b) => normalizeStatus(b.status) === 'optimal').length,
            warning: item.biomarkers.filter((b) => normalizeStatus(b.status) === 'warning').length,
            critical: item.biomarkers.filter((b) => normalizeStatus(b.status) === 'critical').length,
          },
        ];
      }
      return acc;
    }, []);

  const LINE_COLORS = ['#22c55e', '#38bdf8', '#f59e0b', '#a78bfa'];

  return (
    <div className="vtl-card p-6">
      <div className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-100">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          Health Trends
        </h2>
      </div>

      {biomarkerTrend.length > 0 ? (
        <div className="space-y-8">
          {/* Biomarker Status Trend */}
          <div>
            <p className="text-slate-400 text-sm mb-3">Biomarker Status Distribution</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={biomarkerTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                  }}
                />
                <Legend />
                <Bar dataKey="optimal" name="Optimal" fill="#10b981" />
                <Bar dataKey="warning" name="Warning" fill="#f59e0b" />
                <Bar dataKey="critical" name="Critical" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Upload Activity */}
          {chartData.length > 0 && (
            <div>
              <p className="text-slate-400 text-sm mb-3">Lab Upload Activity</p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="biomarkers"
                    name="Biomarkers"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ fill: '#06b6d4', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {microMarkerCatalog.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <p className="text-slate-400 text-sm">Vitamins & Minerals Trends</p>
                <p className="text-xs text-slate-500">Select up to 4 markers</p>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {microMarkerCatalog.map((marker) => {
                  const enabled = activeMarkers.some((item) => item.name === marker.name);
                  return (
                    <button
                      key={marker.name}
                      onClick={() => toggleMarker(marker.name)}
                      className={`px-2 py-1 text-xs rounded border transition ${
                        enabled
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                          : 'border-slate-600 bg-slate-700/40 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {marker.name}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {activeMarkers.map((marker, index) => {
                  const markerTrend = progress.slice(-12).map((item) => {
                    const date = item.test_date
                      ? new Date(item.test_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'N/A';
                    const itemMarker = (item.biomarkers || []).find((b) => b?.name === marker.name);
                    const value = Number(itemMarker?.value);
                    return {
                      date,
                      value: Number.isFinite(value) ? value : null,
                    };
                  });

                  return (
                    <div key={marker.name} className="rounded-2xl border border-slate-700/70 bg-slate-900/45 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-white font-medium truncate pr-2">{marker.name}</p>
                        {marker.unit && <span className="text-xs text-slate-400">{marker.unit}</span>}
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={markerTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="date" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #475569',
                              borderRadius: '8px',
                              color: '#f1f5f9',
                            }}
                          />
                          {marker.refLow != null && marker.refHigh != null && (
                            <ReferenceArea
                              y1={marker.refLow}
                              y2={marker.refHigh}
                              fill="#22c55e"
                              fillOpacity={0.1}
                            />
                          )}
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={LINE_COLORS[index % LINE_COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-slate-500 mt-2">
                        {marker.refLow != null && marker.refHigh != null
                          ? `Reference: ${marker.refLow} - ${marker.refHigh}${marker.unit ? ` ${marker.unit}` : ''}`
                          : 'Reference range not available'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <p className="mb-2">No health data available yet</p>
          <p className="text-sm">Upload your lab results to see trends and insights</p>
        </div>
      )}
    </div>
  );
}
