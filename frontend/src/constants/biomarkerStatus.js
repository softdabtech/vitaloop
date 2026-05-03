// Biomarker status definitions (single source of truth)
export const BIOMARKER_STATUS = {
  OPTIMAL: 'optimal',
  NORMAL: 'normal',
  ELEVATED: 'elevated',
  LOW: 'low',
  ALERT: 'alert',
  CAUTION: 'caution',
  ABNORMAL: 'abnormal',
}

// Map API responses to normalized status
export const normalizeStatus = (status) => {
  if (!status) return BIOMARKER_STATUS.NORMAL

  const normalized = String(status).toLowerCase().trim()

  // Handle common variations
  if (normalized === 'optimal' || normalized === 'normal') return BIOMARKER_STATUS.OPTIMAL
  if (normalized === 'elevated' || normalized === 'high') return BIOMARKER_STATUS.ELEVATED
  if (normalized === 'low') return BIOMARKER_STATUS.LOW
  if (normalized === 'alert' || normalized === 'critical') return BIOMARKER_STATUS.ALERT
  if (normalized === 'caution' || normalized === 'warning') return BIOMARKER_STATUS.CAUTION
  if (normalized === 'abnormal') return BIOMARKER_STATUS.ABNORMAL

  return BIOMARKER_STATUS.NORMAL
}

// Get display color for status
export const getStatusColor = (status) => {
  const normalized = normalizeStatus(status)

  const colors = {
    [BIOMARKER_STATUS.OPTIMAL]: 'bg-emerald-100 text-emerald-700',
    [BIOMARKER_STATUS.NORMAL]: 'bg-slate-100 text-slate-700',
    [BIOMARKER_STATUS.ELEVATED]: 'bg-amber-100 text-amber-700',
    [BIOMARKER_STATUS.LOW]: 'bg-blue-100 text-blue-700',
    [BIOMARKER_STATUS.ALERT]: 'bg-rose-100 text-rose-700',
    [BIOMARKER_STATUS.CAUTION]: 'bg-orange-100 text-orange-700',
    [BIOMARKER_STATUS.ABNORMAL]: 'bg-red-100 text-red-700',
  }

  return colors[normalized] || colors[BIOMARKER_STATUS.NORMAL]
}

// Get icon for status
export const getStatusIcon = (status) => {
  const normalized = normalizeStatus(status)

  const icons = {
    [BIOMARKER_STATUS.OPTIMAL]: '✨',
    [BIOMARKER_STATUS.NORMAL]: '✓',
    [BIOMARKER_STATUS.ELEVATED]: '⚠️',
    [BIOMARKER_STATUS.LOW]: '📉',
    [BIOMARKER_STATUS.ALERT]: '🚨',
    [BIOMARKER_STATUS.CAUTION]: '⚡',
    [BIOMARKER_STATUS.ABNORMAL]: '❌',
  }

  return icons[normalized] || '−'
}
