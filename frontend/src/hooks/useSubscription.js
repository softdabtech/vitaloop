import { useUserEntitlements } from './useQueries.js'

export function useSubscription() {
  const { data, isLoading, refetch } = useUserEntitlements()
  const resolved = data || {}
  const premium = Boolean(resolved.is_premium)
  const uploadLimit = premium ? Infinity : (resolved.features?.upload_limit ?? 1)

  return {
    subStatus: String(resolved.billing_status || 'free').toLowerCase(),
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
