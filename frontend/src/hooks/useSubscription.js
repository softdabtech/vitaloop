import { useEffect, useState, useCallback } from 'react'
import { useAuth } from './useAuth.js'
import api from '../lib/api.js'

export function useSubscription() {
  const { user } = useAuth()
  const [subStatus, setSubStatus] = useState('free')
  const [isPremium, setIsPremium] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const [uploadLimit, setUploadLimit] = useState(1)
  const [uploadsRemaining, setUploadsRemaining] = useState(1)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!user) {
      setSubStatus('free')
      setIsPremium(false)
      setLoading(false)
      return
    }

    setLoading(true)

    const fetchSubscription = async (attempt = 0) => {
      try {
        const [{ data: stripeData }, authMeResp] = await Promise.all([
          api.get('/stripe/subscription'),
          api.get('/auth/me').catch(() => null),
        ])

        const authMe = authMeResp?.data || null
        const authStatus = String(authMe?.subscription_status || (authMe?.has_active_subscription ? 'active' : 'free')).toLowerCase()
        const authPremium = Boolean(
          authMe?.has_active_subscription
          || authMe?.subscription_active
          || authStatus === 'active'
          || authMe?.global_role !== 'end_user'
        )

        const stripeStatus = String(stripeData?.sub_status ?? 'free').toLowerCase()
        const stripePremium = Boolean(stripeData?.is_premium)
        const isPremiumResolved = authPremium || stripePremium
        const subStatusResolved = isPremiumResolved ? 'active' : stripeStatus

        setSubStatus(subStatusResolved)
        setIsPremium(isPremiumResolved)
        setUploadCount(stripeData?.upload_count ?? 0)
        setUploadLimit(isPremiumResolved ? Infinity : (stripeData?.upload_limit ?? 1))
        setUploadsRemaining(isPremiumResolved ? Infinity : (stripeData?.uploads_remaining ?? 0))
        return
      } catch {
        try {
          const { data } = await api.get('/auth/me')
          const status = String(data?.subscription_status || (data?.has_active_subscription ? 'active' : 'free')).toLowerCase()
          const premium = Boolean(data?.has_active_subscription || data?.subscription_active || status === 'active' || data?.global_role !== 'end_user')

          setSubStatus(status)
          setIsPremium(premium)

          // Conservative defaults when stripe endpoint is unavailable.
          // Do not force free-plan limits for premium users.
          setUploadCount(0)
          setUploadLimit(premium ? Infinity : 1)
          setUploadsRemaining(premium ? Infinity : 1)
          return
        } catch {
          if (attempt < 1) {
            await new Promise((resolve) => setTimeout(resolve, 900))
            return fetchSubscription(attempt + 1)
          }

          setSubStatus('free')
          setIsPremium(false)
          setUploadCount(0)
          setUploadLimit(1)
          setUploadsRemaining(1)
        }
      }
    }

    fetchSubscription().finally(() => setLoading(false))
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return {
    subStatus,
    isActive: isPremium, // Use isPremium (which checks both auth and stripe) instead of just subStatus
    isPremium,
    uploadCount,
    uploadLimit,
    uploadsRemaining,
    loading,
    refresh,
  }
}
