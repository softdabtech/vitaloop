/**
 * Normalize a cabinet path by removing trailing slashes except for root.
 * Preserves nested routes and route parameters.
 * Does not modify browser URL or routing behavior.
 * Used for active navigation and page metadata.
 *
 * Examples:
 * - '/dashboard/' -> '/dashboard'
 * - '/health-profile/' -> '/health-profile'
 * - '/results/abc123/' -> '/results/abc123'
 * - '/' -> '/'
 * - '/results/abc123' -> '/results/abc123'
 */
export function normalizePath(pathname = '') {
  if (!pathname || pathname === '/') {
    return '/'
  }
  return pathname.replace(/\/$/, '')
}

/**
 * Map of cabinet route paths to metadata (title, icon, etc.)
 * Used by navigation components to display consistent labels and titles
 */
export const CABINET_ROUTE_META = {
  '/dashboard': {
    title: 'Dashboard',
    ukTitle: 'Дашборд',
    key: 'dashboard',
  },
  '/upload': {
    title: 'Upload Results',
    ukTitle: 'Завантажити аналізи',
    key: 'upload',
  },
  '/lab-plan': {
    title: 'Lab Plan',
    ukTitle: 'План аналізів',
    key: 'lab_plan',
  },
  '/lab-results': {
    title: 'Results & Trends',
    ukTitle: 'Результати й динаміка',
    key: 'lab_results',
  },
  '/results': {
    title: 'Results',
    ukTitle: 'Результати',
    key: 'results',
  },
  '/protocol': {
    title: 'Protocol',
    ukTitle: 'План дій',
    key: 'protocol',
  },
  '/assignments': {
    title: 'Protocol',
    ukTitle: 'План дій',
    key: 'assignments',
  },
  '/progress': {
    title: 'Results & Trends',
    ukTitle: 'Результати й динаміка',
    key: 'progress',
  },
  '/insights': {
    title: 'Review',
    ukTitle: 'Огляд',
    key: 'insights',
  },
  '/questionnaire': {
    title: 'Symptom Check',
    ukTitle: 'Перевірка симптомів',
    key: 'questionnaire',
  },
  '/account': {
    title: 'Account',
    ukTitle: 'Акаунт',
    key: 'account',
  },
  '/health-profile': {
    title: 'Profile & Safety',
    ukTitle: 'Профіль і безпека',
    key: 'health_profile',
  },
  '/subscription': {
    title: 'Subscription',
    ukTitle: 'Підписка',
    key: 'subscription',
  },
  '/billing-history': {
    title: 'Billing History',
    ukTitle: 'Історія платежів',
    key: 'billing_history',
  },
  '/check-ins': {
    title: 'Check-in History',
    ukTitle: 'Історія чек-інів',
    key: 'check_ins',
  },
  '/help-center': {
    title: 'Help Center',
    ukTitle: 'Допомога',
    key: 'help_center',
  },
  '/onboarding': {
    title: 'Onboarding',
    ukTitle: 'Налаштування',
    key: 'onboarding',
  },
}

/**
 * Resolve page metadata for a given pathname.
 * Matches exact paths first, then pattern matches for nested routes.
 * Returns metadata with title (in selected language) and subtitle.
 */
export function resolvePageMeta(pathname, isUk = false) {
  const normalized = normalizePath(pathname)

  // Exact match
  const exact = CABINET_ROUTE_META[normalized]
  if (exact) {
    return {
      ...exact,
      title: isUk ? exact.ukTitle || exact.title : exact.title,
    }
  }

  // Pattern matches for nested routes
  if (normalized.startsWith('/results/')) {
    const meta = CABINET_ROUTE_META['/results']
    return {
      ...meta,
      title: isUk ? meta.ukTitle : meta.title,
    }
  }
  if (normalized.startsWith('/protocol/')) {
    const meta = CABINET_ROUTE_META['/protocol']
    return {
      ...meta,
      title: isUk ? meta.ukTitle : meta.title,
    }
  }
  if (normalized.startsWith('/assignments/')) {
    const meta = CABINET_ROUTE_META['/assignments']
    return {
      ...meta,
      title: isUk ? meta.ukTitle : meta.title,
    }
  }

  // Fallback
  return {
    title: 'Vitaloop',
    key: 'unknown',
  }
}
