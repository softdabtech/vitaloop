import { useUserEntitlements } from './useQueries.js'

export function useSubscription() {
  const { data, isLoading, refetch } = useUserEntitlements()
  const resolved = data || {}
  const billingStatus = String(resolved.billing_status || 'free').toLowerCase()
  const premium = typeof resolved.is_premium === 'boolean'
    ? resolved.is_premium
    : Boolean(resolved.has_active_subscription || billingStatus === 'active')
  const uploadLimit = premium ? Infinity : (resolved.features?.upload_limit ?? 1)

  return {
    subStatus: billingStatus,
    isActive: premium,
    isPremium: premium,
    uploadCount: 0,
    uploadLimit,
    uploadsRemaining: uploadLimit,
    planName: resolved.plan_key || null,
    loading: isLoading,
    refresh: refetch,
  }
}
