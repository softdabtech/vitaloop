export interface BiomarkerAlert {
  id: string
  biomarkerName: string
  status: 'critical' | 'warning' | 'info'
  message: string
  action: string
  severity: 1 | 2 | 3 | 4 | 5 // 1 = minimal concern, 5 = urgent
  shouldNotify: boolean
  notificationMethod: 'email' | 'in-app' | 'both'
}

export const ALERT_THRESHOLDS = {
  // Critical levels (require immediate action)
  CRITICAL: {
    glucose: { min: 50, max: 400 },
    cholesterol: { min: 30, max: 400 },
    hemoglobin: { min: 6, max: 20 },
    potassium: { min: 2.5, max: 7 },
  },
  // Warning levels
  WARNING: {
    glucose: { min: 70, max: 300 },
    cholesterol: { min: 100, max: 300 },
    hemoglobin: { min: 8, max: 18 },
  },
}

export function generateBiomarkerAlerts(biomarkers: any[], previousBiomarkers?: any[]): BiomarkerAlert[] {
  const alerts: BiomarkerAlert[] = []

  biomarkers.forEach((biomarker) => {
    const value = biomarker.value
    const name = biomarker.name
    const status = biomarker.status

    // Check for critical levels
    if (ALERT_THRESHOLDS.CRITICAL[name.toLowerCase()]) {
      const thresholds = ALERT_THRESHOLDS.CRITICAL[name.toLowerCase()]
      if (value < thresholds.min || value > thresholds.max) {
        alerts.push({
          id: `alert-${name}-critical`,
          biomarkerName: name,
          status: 'critical',
          message: `${name} is at a critical level (${value}). Please consult a healthcare provider.`,
          action: 'Contact your doctor immediately',
          severity: 5,
          shouldNotify: true,
          notificationMethod: 'both',
        })
        return
      }
    }

    // Check for rapid changes (decline)
    if (previousBiomarkers) {
      const previous = previousBiomarkers.find(b => b.name === name)
      if (previous) {
        const change = ((value - previous.value) / previous.value) * 100
        if (change < -20) {
          // Significant decline
          alerts.push({
            id: `alert-${name}-decline`,
            biomarkerName: name,
            status: 'warning',
            message: `${name} declined by ${Math.abs(change).toFixed(1)}% since last test`,
            action: 'Monitor closely and consider adjusting protocol',
            severity: 4,
            shouldNotify: true,
            notificationMethod: 'email',
          })
        }
      }
    }

    // Status-based alerts
    if (status === 'DEFICIENT') {
      alerts.push({
        id: `alert-${name}-deficient`,
        biomarkerName: name,
        status: 'warning',
        message: `${name} is deficient. Consider supplementation or dietary changes.`,
        action: 'View recommendations',
        severity: 3,
        shouldNotify: true,
        notificationMethod: 'in-app',
      })
    } else if (status === 'ELEVATED') {
      alerts.push({
        id: `alert-${name}-elevated`,
        biomarkerName: name,
        status: 'info',
        message: `${name} is elevated. Monitor and consider lifestyle adjustments.`,
        action: 'See health tips',
        severity: 2,
        shouldNotify: false,
        notificationMethod: 'in-app',
      })
    }
  })

  return alerts.sort((a, b) => b.severity - a.severity)
}

export function getAlertColor(status: BiomarkerAlert['status']): string {
  if (status === 'critical') return '#dc2626'
  if (status === 'warning') return '#f59e0b'
  return '#3b82f6'
}

export function getAlertIcon(status: BiomarkerAlert['status']): string {
  if (status === 'critical') return '🚨'
  if (status === 'warning') return '⚠️'
  return 'ℹ️'
}

export function shouldSendNotification(alert: BiomarkerAlert, userPreferences: any): boolean {
  if (!alert.shouldNotify) return false

  const method = alert.notificationMethod
  const emailEnabled = userPreferences?.email_alerts !== false
  const inAppEnabled = userPreferences?.in_app_alerts !== false

  if (method === 'email') return emailEnabled
  if (method === 'in-app') return inAppEnabled
  return emailEnabled || inAppEnabled
}
