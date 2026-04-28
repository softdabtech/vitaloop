export default function WeeklyProgressReport({ weekData, metrics, streak }) {
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const checkInsThisWeek = Object.values(weekData || {}).filter(Boolean).length

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdf4 0%, #f3f4f6 100%)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #bbf7d0',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginBottom: '4px' }}>
          📊 This Week's Summary
        </div>
        <div style={{ fontSize: '14px', color: '#64748b' }}>
          {weekStart.toLocaleDateString()} — {weekEnd.toLocaleDateString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Check-ins */}
        <div style={{
          background: '#fff',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Check-ins</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>
            {checkInsThisWeek}/7
          </div>
          <div style={{
            width: '100%',
            height: '4px',
            background: '#e2e8f0',
            borderRadius: '2px',
            marginTop: '8px',
            overflow: 'hidden',
          }}>
            <div
              style={{
                height: '100%',
                background: '#10b981',
                width: `${(checkInsThisWeek / 7) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Health Score Trend */}
        <div style={{
          background: '#fff',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Avg Score</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>
            {metrics?.avgScore || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
            {metrics?.scoreChange > 0 ? '↑' : '↓'} {Math.abs(metrics?.scoreChange || 0)}
          </div>
        </div>
      </div>

      {/* Biomarkers */}
      <div style={{
        background: '#fff',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '12px' }}>
          Biomarker Changes
        </div>

        <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#dcfce7' }} />
            <span>
              <strong>{metrics?.improving || 0}</strong> Improving
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#f1f5f9' }} />
            <span>
              <strong>{metrics?.stable || 0}</strong> Stable
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fee2e2' }} />
            <span>
              <strong>{metrics?.declining || 0}</strong> Declining
            </span>
          </div>
        </div>
      </div>

      {/* Streak */}
      {streak && (
        <div style={{
          background: '#fff',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Current Streak</div>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {streak.currentStreak} days 🔥
          </div>
        </div>
      )}

      {/* Share buttons */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
        <button style={{
          flex: 1,
          background: '#10b981',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '14px',
        }}>
          📤 Share Report
        </button>
        <button style={{
          flex: 1,
          background: '#f1f5f9',
          color: '#475569',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '14px',
        }}>
          📥 Download
        </button>
      </div>
    </div>
  )
}
