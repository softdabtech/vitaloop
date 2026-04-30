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
        const { data } = await api.get('/stripe/subscription')
        setSubStatus(data.sub_status ?? 'free')
        setIsPremium(data.is_premium ?? false)
        setUploadCount(data.upload_count ?? 0)
        setUploadLimit(data.upload_limit ?? 1)
        setUploadsRemaining(data.uploads_remaining ?? 0)
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
          setUploadLimit(premium ? null : 1)
          setUploadsRemaining(premium ? null : 1)
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
    isActive: subStatus === 'active',
    isPremium,
    uploadCount,
    uploadLimit,
    uploadsRemaining,
    loading,
    refresh,
  }
}
