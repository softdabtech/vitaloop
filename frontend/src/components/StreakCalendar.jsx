export default function StreakCalendar({ weeklyData, currentStreak, longestStreak }) {
  const dates = Object.entries(weeklyData).sort(([a], [b]) => new Date(b) - new Date(a))
  const weeks = []

  // Group by week
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7))
  }

  const getColor = (completed) => {
    if (completed) return '#10b981'
    return '#f1f5f9'
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header with stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: '#f0fdf4',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid #bbf7d0',
        }}>
          <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginBottom: '4px' }}>
            Current Streak
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {currentStreak}
            <span style={{ fontSize: '20px' }}>🔥</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>days</div>
        </div>

        <div style={{
          background: '#fef3c7',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid #fcd34d',
        }}>
          <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600, marginBottom: '4px' }}>
            Longest Streak
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {longestStreak}
            <span style={{ fontSize: '20px' }}>👑</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>days</div>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>
        Check-in Activity (Last 49 days)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '16px' }}>
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {week.map(([date, completed]) => (
              <div
                key={date}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  background: getColor(completed),
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                }}
                title={`${date}: ${completed ? 'Checked in' : 'No check-in'}`}
              >
                {completed && '✓'}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '3px', background: '#f1f5f9' }} />
          None
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '3px', background: '#10b981' }} />
          Checked in
        </div>
      </div>
    </div>
  )
}
