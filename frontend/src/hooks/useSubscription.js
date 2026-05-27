import { useEffect, useState, useCallback } from 'react'
import { useAuth } from './useAuth.js'
import api from '../lib/api.js'
import { useUserEntitlements } from './useQueries.js'

export function useSubscription() {
  const { user } = useAuth()
  const { data: entitlements, loading: entitlementLoading, refetch: refetchEntitlements } = useUserEntitlements()
  const [subStatus, setSubStatus] = useState('free')
  const [isPremium, setIsPremium] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const [uploadLimit, setUploadLimit] = useState(null)
  const [uploadsRemaining, setUploadsRemaining] = useState(null)
  const [planName, setPlanName] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!user) {
      setSubStatus('free')
      setIsPremium(false)
      setLoading(false)
      return
    }

    setLoading(true)
    const resolve = async () => {
      try {
        await refetchEntitlements()
      } finally {
        const resolved = entitlements || {}
        const premium = Boolean(resolved.is_premium)
        setSubStatus(String(resolved.billing_status || 'free').toLowerCase())
        setIsPremium(premium)
        setPlanName(resolved.plan_key || null)
        setUploadCount(0)
        setUploadLimit(premium ? Infinity : (resolved.features?.upload_limit ?? 1))
        setUploadsRemaining(premium ? Infinity : (resolved.features?.upload_limit ?? 1))
        setLoading(false)
      }
    }

    resolve().catch(async () => {
      try {
        const { data } = await api.get('/auth/me')
        const premium = Boolean(data?.has_active_subscription || data?.subscription_active || data?.global_role !== 'end_user')
        setSubStatus(String(data?.subscription_status || 'free').toLowerCase())
        setIsPremium(premium)
        setPlanName(data?.plan_name ?? null)
        setUploadCount(0)
        setUploadLimit(premium ? Infinity : 1)
        setUploadsRemaining(premium ? Infinity : 1)
      } finally {
        setLoading(false)
      }
    })
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return {
    subStatus,
    isActive: isPremium, // Use isPremium (which checks both auth and stripe) instead of just subStatus
    isPremium,
    uploadCount,
    uploadLimit,
    uploadsRemaining,
    planName,
    loading,
    refresh,
  }
}
