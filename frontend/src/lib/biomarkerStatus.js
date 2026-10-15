const STATUS_ALIAS_MAP = {
  OPTIMAL: 'OPTIMAL',
  NORMAL: 'OPTIMAL',
  N: 'OPTIMAL',
  IN_RANGE: 'OPTIMAL',
  'IN RANGE': 'OPTIMAL',
  BORDERLINE: 'BORDERLINE',
  'LOW NORMAL': 'BORDERLINE',
  'HIGH NORMAL': 'BORDERLINE',
  LOW: 'DEFICIENT',
  L: 'DEFICIENT',
  DEFICIENT: 'DEFICIENT',
  HIGH: 'ELEVATED',
  H: 'ELEVATED',
  ELEVATED: 'ELEVATED',
  CRITICAL: 'ELEVATED',
  UNKNOWN: 'UNKNOWN',
  UNEVALUATED: 'UNKNOWN',
}

export const BIOMARKER_STATUS_META = {
  DEFICIENT: {
    rank: 0,
    label: 'Below range',
    ukLabel: 'Нижче референсу',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
  },
  ELEVATED: {
    rank: 1,
    label: 'Above range',
    ukLabel: 'Вище референсу',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
  BORDERLINE: {
    rank: 2,
    label: 'Worth watching',
    ukLabel: 'Потребує спостереження',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  OPTIMAL: {
    rank: 3,
    label: 'In range',
    ukLabel: 'У референсі',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  UNKNOWN: {
    rank: 4,
    label: 'Not evaluated',
    ukLabel: 'Не оцінено',
    badge: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
}

const ABNORMAL_STATUSES = new Set(['DEFICIENT', 'ELEVATED', 'BORDERLINE'])

function parseNumber(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeBiomarkerStatus(biomarker) {
  const raw = String(biomarker?.status || '').trim().toUpperCase()
  const status = STATUS_ALIAS_MAP[raw] || 'UNKNOWN'
  if (status === 'UNKNOWN') return 'UNKNOWN'

  const hasLow = biomarker?.ref_low != null && String(biomarker.ref_low).trim() !== ''
  const hasHigh = biomarker?.ref_high != null && String(biomarker.ref_high).trim() !== ''
  const low = hasLow ? parseNumber(biomarker.ref_low) : null
  const high = hasHigh ? parseNumber(biomarker.ref_high) : null
  const value = parseNumber(biomarker?.value)
  const invalidBounds = (hasLow && low == null)
    || (hasHigh && high == null)
    || (hasLow && hasHigh && low >= high)

  if (invalidBounds || (!hasLow && !hasHigh)) {
    return ABNORMAL_STATUSES.has(status) ? status : 'UNKNOWN'
  }

  if (hasLow !== hasHigh) {
    if (value == null) return 'UNKNOWN'
    if (hasLow && value < low) return 'DEFICIENT'
    if (hasHigh && value > high) return 'ELEVATED'
    return 'UNKNOWN'
  }

  return status
}

export function summarizeBiomarkerStatuses(biomarkers = []) {
  const counts = { total: biomarkers.length, optimal: 0, borderline: 0, deficient: 0, elevated: 0, unknown: 0 }
  for (const biomarker of biomarkers) {
    const status = normalizeBiomarkerStatus(biomarker)
    if (status === 'OPTIMAL') counts.optimal += 1
    else if (status === 'BORDERLINE') counts.borderline += 1
    else if (status === 'DEFICIENT') counts.deficient += 1
    else if (status === 'ELEVATED') counts.elevated += 1
    else counts.unknown += 1
  }
  return counts
}

export function biomarkerStatusLabel(status, isUk = false) {
  const meta = BIOMARKER_STATUS_META[status] || BIOMARKER_STATUS_META.UNKNOWN
  return isUk ? meta.ukLabel : meta.label
}
