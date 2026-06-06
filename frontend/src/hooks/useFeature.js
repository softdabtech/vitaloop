import { useUserEntitlements } from './useQueries.js'

/**
 * Feature access hook
 * Centralized feature flag logic
 *
 * Usage:
 * const { hasAccess, isLoading } = useFeature('insights')
 * if (!hasAccess) return <PaywallModal />
 */
export const useFeature = (featureName) => {
  const { data: entitlements, isLoading: loading } = useUserEntitlements()

  // Define which features require premium
  const PREMIUM_FEATURES = {
    insights: true,
    progress: true,
    advanced_protocol: true,
    health_score: true,
    trend_analysis: true,
    predictions: true,
    check_ins: true,
  }

  const FREE_FEATURES = {
    dashboard: false,
    upload: false,
    results: false,
    basic_protocol: false,
    assignments: false,
    health_profile: false,
  }

  // Determine if feature requires premium
  const requiresPremium = PREMIUM_FEATURES[featureName] || false
  const hasAccess = !requiresPremium || Boolean(entitlements?.is_premium)

  return {
    hasAccess,
    isLoading: loading,
    requiresPremium,
  }
}
