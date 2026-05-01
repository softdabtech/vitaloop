import { useUserEntitlements } from '../hooks/useQueries'

/**
 * FeatureGate component for controlling access to paid features
 *
 * Usage:
 * <FeatureGate feature="insights" onLocked={handleUpgrade}>
 *   <InsightsPage />
 * </FeatureGate>
 */
export function FeatureGate({ feature, children, onLocked = null, fallback = null }) {
  const { data: entitlements, isLoading } = useUserEntitlements()

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading...</div>
  }

  if (!entitlements) {
    return fallback || <div className="p-8 text-center text-red-500">Unable to load permissions</div>
  }

  // Check if feature is available in active tier
  const activeTier = entitlements[entitlements.active_tier]
  const hasFeature = activeTier && activeTier[feature]

  if (!hasFeature) {
    // Call the onLocked callback if provided
    if (onLocked) {
      return onLocked(entitlements)
    }

    // Default locked message
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Feature Locked</h3>
        <p className="text-slate-600 mb-4">
          Upgrade to Premium to access {feature}
        </p>
        <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
          Upgrade Now
        </button>
      </div>
    )
  }

  return children
}

/**
 * Hook to check if user has access to a specific feature
 */
export function useFeature(featureName) {
  const { data: entitlements, isLoading } = useUserEntitlements()

  const hasAccess = () => {
    if (!entitlements) return false
    const activeTier = entitlements[entitlements.active_tier]
    return activeTier && activeTier[featureName]
  }

  return {
    hasAccess: hasAccess(),
    isLoading,
    entitlements,
  }
}
