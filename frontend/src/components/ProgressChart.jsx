import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

export default function ProgressChart({ data }) {
  // Build per-biomarker timeseries across uploads
  const allNames = [...new Set(data.flatMap((u) => u.biomarkers.map((b) => b.name)))]

  const chartData = data.map((upload) => {
    const point = { date: upload.test_date || upload.created_at?.split('T')[0] }
    upload.biomarkers.forEach((b) => {
      point[b.name] = b.value
    })
    return point
  })

  const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7', '#f97316']

  if (chartData.length < 2) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
        Upload at least 2 lab results to see trend charts.
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4">Biomarker Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
          <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
          <Legend />
          {allNames.slice(0, 6).map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
