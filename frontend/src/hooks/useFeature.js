import { useSubscription } from './useSubscription.js'

/**
 * Feature access hook
 * Centralized feature flag logic
 *
 * Usage:
 * const { hasAccess, isLoading } = useFeature('insights')
 * if (!hasAccess) return <PaywallModal />
 */
export const useFeature = (featureName) => {
  const { isActive, loading } = useSubscription()

  // Define which features require premium
  const PREMIUM_FEATURES = {
    insights: true,
    progress: true,
    advanced_protocol: true,
    health_score: true,
    trend_analysis: true,
    predictions: true,
  }

  const FREE_FEATURES = {
    dashboard: false,
    upload: false,
    results: false,
    basic_protocol: false,
    assignments: false,
    check_ins: false,
    health_profile: false,
  }

  // Determine if feature requires premium
  const requiresPremium = PREMIUM_FEATURES[featureName] || false
  const hasAccess = !requiresPremium || isActive

  return {
    hasAccess,
    isLoading: loading,
    requiresPremium,
  }
}
