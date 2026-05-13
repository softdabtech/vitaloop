export default function BiomarkerComparison({ _current, _previous, trends }) {
  if (!trends || trends.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
        No previous results to compare
      </div>
    )
  }

  const improving = trends.filter(t => t.trend === 'improving').length
  const declining = trends.filter(t => t.trend === 'declining').length

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>Improving</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669', marginTop: '8px' }}>{improving}</div>
        </div>

        <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>Stable</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e', marginTop: '8px' }}>
            {trends.length - improving - declining}
          </div>
        </div>

        <div style={{ background: '#fecaca', padding: '16px', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#7f1d1d', fontWeight: 600 }}>Declining</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#7f1d1d', marginTop: '8px' }}>{declining}</div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          fontSize: '14px',
          borderCollapse: 'collapse',
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Biomarker</th>
              <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Previous</th>
              <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Current</th>
              <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Change</th>
              <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {trends.map(trend => (
              <tr key={trend.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px', color: '#0f172a' }}>{trend.name}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>
                  {trend.previous.toFixed(2)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                  {trend.current.toFixed(2)}
                </td>
                <td style={{
                  padding: '12px',
                  textAlign: 'right',
                  color: trend.direction === 'up' ? '#ef4444' : trend.direction === 'down' ? '#10b981' : '#64748b',
                  fontWeight: 600,
                }}>
                  {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
                  {' '}
                  {Math.abs(trend.changePercent).toFixed(1)}%
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: trend.trend === 'improving' ? '#dcfce7' : trend.trend === 'declining' ? '#fee2e2' : '#f1f5f9',
                    color: trend.trend === 'improving' ? '#166534' : trend.trend === 'declining' ? '#991b1b' : '#64748b',
                  }}>
                    {trend.trend}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
