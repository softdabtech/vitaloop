import { useState } from 'react'
import { TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle } from 'lucide-react'
import { analyzeBiomarkerTrends, generateTrendInsights, formatTrendStatus, getTrendColor } from '../lib/trend-analytics'

export default function TrendAnalyticsDashboard({ biomarkerHistory = [] }) {
  const [selectedBiomarker, setSelectedBiomarker] = useState(null)

  if (!biomarkerHistory.length) {
    return (
      <div style={{
        padding: '40px 20px',
        background: '#f8fafc',
        borderRadius: '12px',
        textAlign: 'center',
        color: '#64748b'
      }}>
        <Activity size={32} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
          No Trend Data Yet
        </h3>
        <p>Upload multiple lab results over time to see trend analytics</p>
      </div>
    )
  }

  const analysis = analyzeBiomarkerTrends(biomarkerHistory)
  const insights = generateTrendInsights(analysis)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Insights Section */}
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
          Key Insights
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {insights.length > 0 ? (
            insights.map((insight, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: insight.includes('Great') ? '#f0fdf4' :
                    insight.includes('Attention') ? '#fee2e2' :
                      insight.includes('Volatile') ? '#fef3c7' : '#f0f9ff',
                  border: `1px solid ${
                    insight.includes('Great') ? '#dcfce7' :
                      insight.includes('Attention') ? '#fecaca' :
                        insight.includes('Volatile') ? '#fde68a' : '#bfdbfe'
                  }`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: insight.includes('Great') ? '#166534' :
                    insight.includes('Attention') ? '#991b1b' :
                      insight.includes('Volatile') ? '#78350f' : '#0c2a47'
                }}
              >
                {insight}
              </div>
            ))
          ) : (
            <div style={{
              padding: '12px 16px',
              background: '#f0fdf4',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#166534'
            }}>
              ✅ All trends stable — keep up your current protocol
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '12px'
      }}>
        <div style={{
          padding: '16px',
          background: '#f0fdf4',
          border: '1px solid #dcfce7',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
            Improving
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#16a34a' }}>
            {analysis.improvingCount}
          </div>
        </div>

        <div style={{
          padding: '16px',
          background: '#f0f9ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
            Stable
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#0284c7' }}>
            {analysis.stableCount}
          </div>
        </div>

        <div style={{
          padding: '16px',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
            Declining
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>
            {analysis.decliningCount}
          </div>
        </div>
      </div>

      {/* Top Improvers */}
      {analysis.topImprovers.length > 0 && (
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} style={{ color: '#16a34a' }} />
            Top Improvers
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analysis.topImprovers.map((trend) => (
              <div
                key={trend.biomarkerId}
                style={{
                  padding: '12px 16px',
                  background: '#f0fdf4',
                  border: '1px solid #dcfce7',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 200ms'
                }}
                onClick={() => setSelectedBiomarker(trend.biomarkerId)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#dcfce7'
                  e.currentTarget.style.borderColor = '#bbf7d0'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f0fdf4'
                  e.currentTarget.style.borderColor = '#dcfce7'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>
                    {trend.biomarkerName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#059669', marginTop: '2px' }}>
                    Latest: {trend.latestValue} | Avg: {trend.averageValue}
                  </div>
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#16a34a',
                  textAlign: 'right'
                }}>
                  +{trend.percentChange.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Decliners */}
      {analysis.topDecliners.length > 0 && (
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingDown size={20} style={{ color: '#dc2626' }} />
            Needs Attention
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analysis.topDecliners.map((trend) => (
              <div
                key={trend.biomarkerId}
                style={{
                  padding: '12px 16px',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 200ms'
                }}
                onClick={() => setSelectedBiomarker(trend.biomarkerId)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fecaca'
                  e.currentTarget.style.borderColor = '#fca5a5'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fee2e2'
                  e.currentTarget.style.borderColor = '#fecaca'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#991b1b' }}>
                    {trend.biomarkerName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '2px' }}>
                    Latest: {trend.latestValue} | Avg: {trend.averageValue}
                  </div>
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#dc2626',
                  textAlign: 'right'
                }}>
                  {trend.percentChange.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Volatile Markers */}
      {analysis.mostVolatile.length > 0 && (
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
            Volatile Markers
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analysis.mostVolatile.map((trend) => (
              <div
                key={trend.biomarkerId}
                style={{
                  padding: '12px 16px',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#78350f' }}>
                    {trend.biomarkerName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#92400e', marginTop: '2px' }}>
                    Consider more frequent monitoring
                  </div>
                </div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#78350f',
                  textAlign: 'right'
                }}>
                  High variability
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overall Status */}
      <div style={{
        padding: '16px',
        background: analysis.overallStatus === 'improving' ? '#f0fdf4' :
          analysis.overallStatus === 'declining' ? '#fee2e2' : '#f0f9ff',
        border: `2px solid ${
          analysis.overallStatus === 'improving' ? '#dcfce7' :
            analysis.overallStatus === 'declining' ? '#fecaca' : '#bfdbfe'
        }`,
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '16px',
          fontWeight: 700,
          color: analysis.overallStatus === 'improving' ? '#166534' :
            analysis.overallStatus === 'declining' ? '#991b1b' : '#0c2a47'
        }}>
          {analysis.overallStatus === 'improving' ? (
            <>
              <CheckCircle size={20} />
              Overall Trend: Improving
            </>
          ) : analysis.overallStatus === 'declining' ? (
            <>
              <AlertTriangle size={20} />
              Overall Trend: Declining
            </>
          ) : (
            <>
              <Activity size={20} />
              Overall Trend: Stable
            </>
          )}
        </div>
        <p style={{
          fontSize: '13px',
          margin: '8px 0 0 0',
          opacity: 0.8,
          color: 'inherit'
        }}>
          Based on {analysis.improvingCount + analysis.stableCount + analysis.decliningCount} biomarkers tracked
        </p>
      </div>
    </div>
  )
}
