import { useSubscription } from '../hooks/useSubscription.js'
import { useFeature } from '../hooks/useFeature.js'

/**
 * Feature access control component
 * Wraps feature content with access checks
 *
 * Usage:
 * <FeatureGate feature="insights" onLocked={showPaywall}>
 *   <InsightsContent />
 * </FeatureGate>
 */
export default function FeatureGate({ children, feature, fallback, onLocked }) {
  const { hasAccess, isLoading } = useFeature(feature)

  if (isLoading) {
    return <div className="flex items-center justify-center h-[300px]">Loading...</div>
  }

  if (!hasAccess) {
    if (onLocked) {
      onLocked()
    }
    return fallback || (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h3 className="font-semibold text-amber-900">Premium feature</h3>
        <p className="mt-2 text-sm text-amber-700">
          {feature} is available with a Vitaloop Premium subscription.
        </p>
      </div>
    )
  }

  return children
}
