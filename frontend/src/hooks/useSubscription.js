import { useUserEntitlements, useDashboardSummary } from './useQueries.js'

export function useSubscription() {
  const { data, isLoading, refetch } = useUserEntitlements()
  // uploadLimit alone is just the free-tier cap, not how many analyses are
  // actually left — dashboard-summary's stats.total_uploads is the same
  // per-user lab_uploads count the backend quota check itself is built on
  // (see supabase_service.get_user_upload_count, "used for freemium
  // gating"), so it's reused here rather than adding a new endpoint.
  const { data: dashboardSummary, isLoading: dashboardLoading } = useDashboardSummary()
  const resolved = data || {}
  const premium = Boolean(resolved.is_premium)
  const uploadLimit = premium ? Infinity : (resolved.features?.upload_limit ?? 1)
  const uploadCount = Number(dashboardSummary?.stats?.total_uploads || 0)
  const uploadsRemaining = premium ? Infinity : Math.max(0, uploadLimit - uploadCount)

  return {
    subStatus: String(resolved.billing_status || 'free').toLowerCase(),
    isActive: premium,
    isPremium: premium,
    uploadCount,
    uploadLimit,
    uploadsRemaining,
    planName: resolved.plan_key || null,
    loading: isLoading || dashboardLoading,
    refresh: refetch,
  }
}
