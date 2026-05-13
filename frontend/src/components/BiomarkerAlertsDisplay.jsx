import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { generateBiomarkerAlerts, getAlertColor } from '../lib/biomarker-alerts'

export default function BiomarkerAlertsDisplay({ biomarkers, previousBiomarkers, _userPreferences }) {
  const [alerts, setAlerts] = useState([])
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set())

  useEffect(() => {
    if (biomarkers?.length > 0) {
      const generatedAlerts = generateBiomarkerAlerts(biomarkers, previousBiomarkers)
      setAlerts(generatedAlerts)
    }
  }, [biomarkers, previousBiomarkers])

  const visibleAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.id))

  const dismissAlert = (alertId) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]))
  }

  const getIconComponent = (status) => {
    if (status === 'critical') return <AlertCircle size={20} />
    if (status === 'warning') return <AlertTriangle size={20} />
    return <Info size={20} />
  }

  const statusOrder = { critical: 0, warning: 1, info: 2 }
  const sortedAlerts = [...visibleAlerts].sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  if (sortedAlerts.length === 0) {
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {sortedAlerts.map((alert) => {
        const bgColor = alert.status === 'critical'
          ? '#fef2f2'
          : alert.status === 'warning'
            ? '#fffbeb'
            : '#f0f9ff'

        const borderColor = getAlertColor(alert.status)
        const textColor = alert.status === 'critical'
          ? '#7f1d1d'
          : alert.status === 'warning'
            ? '#78350f'
            : '#0c2a47'

        return (
          <div
            key={alert.id}
            style={{
              padding: '14px 16px',
              background: bgColor,
              border: `2px solid ${borderColor}`,
              borderRadius: '10px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}
          >
            {/* Icon */}
            <div style={{
              color: borderColor,
              flexShrink: 0,
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {getIconComponent(alert.status)}
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: textColor,
                marginBottom: '4px'
              }}>
                {alert.biomarkerName}
              </div>
              <div style={{
                fontSize: '13px',
                color: textColor,
                lineHeight: 1.4,
                marginBottom: '8px'
              }}>
                {alert.message}
              </div>

              {/* Action Button */}
              {alert.action && (
                <button style={{
                  padding: '6px 12px',
                  background: borderColor,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 200ms'
                }}
                onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                onMouseLeave={(e) => e.target.style.opacity = '1'}
                >
                  {alert.action}
                </button>
              )}
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => dismissAlert(alert.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: textColor,
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: 0.6,
                transition: 'opacity 200ms'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '1'}
              onMouseLeave={(e) => e.target.style.opacity = '0.6'}
              title="Dismiss this alert"
            >
              <X size={18} />
            </button>
          </div>
        )
      })}

      {/* Summary */}
      {sortedAlerts.length > 0 && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: '#f8fafc',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontWeight: 600 }}>
            {sortedAlerts.filter(a => a.status === 'critical').length > 0
              ? '⚠️ Review critical alerts above'
              : '📊 ' + sortedAlerts.length + ' alert' + (sortedAlerts.length !== 1 ? 's' : '')}
          </span>
        </div>
      )}
    </div>
  )
}
