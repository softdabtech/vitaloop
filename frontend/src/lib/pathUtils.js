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
const routeMeta = (title, ukTitle, key) => ({ title, ukTitle, key })

export const CABINET_ROUTE_META = {
  '/dashboard': routeMeta('Dashboard', 'Дашборд', 'dashboard'),
  '/upload': routeMeta('Upload Results', 'Завантажити аналізи', 'upload'),
  '/lab-plan': routeMeta('Lab Plan', 'План аналізів', 'lab_plan'),
  '/lab-results': routeMeta('Results & Trends', 'Результати й динаміка', 'lab_results'),
  '/results': routeMeta('Results', 'Результати', 'results'),
  '/protocol': routeMeta('Protocol', 'План дій', 'protocol'),
  '/assignments': routeMeta('Protocol', 'План дій', 'assignments'),
  '/progress': routeMeta('Results & Trends', 'Результати й динаміка', 'progress'),
  '/insights': routeMeta('Review', 'Огляд', 'insights'),
  '/questionnaire': routeMeta('Symptom Check', 'Перевірка симптомів', 'questionnaire'),
  '/account': routeMeta('Account', 'Акаунт', 'account'),
  '/health-profile': routeMeta('Profile & Safety', 'Профіль і безпека', 'health_profile'),
  '/subscription': routeMeta('Subscription', 'Підписка', 'subscription'),
  '/billing-history': routeMeta('Billing History', 'Історія платежів', 'billing_history'),
  '/check-ins': routeMeta('Check-in History', 'Історія чек-інів', 'check_ins'),
  '/help-center': routeMeta('Help Center', 'Допомога', 'help_center'),
  '/onboarding': routeMeta('Onboarding', 'Налаштування', 'onboarding'),
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
