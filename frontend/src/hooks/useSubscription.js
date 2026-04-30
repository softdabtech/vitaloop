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
    api.get('/stripe/subscription')
      .then(({ data }) => {
        setSubStatus(data.sub_status ?? 'free')
        setIsPremium(data.is_premium ?? false)
        setUploadCount(data.upload_count ?? 0)
        setUploadLimit(data.upload_limit ?? 1)
        setUploadsRemaining(data.uploads_remaining ?? 0)
      })
      .catch(async () => {
        try {
          const { data } = await api.get('/auth/me')
          const status = String(data?.subscription_status || (data?.has_active_subscription ? 'active' : 'free')).toLowerCase()
          const premium = Boolean(data?.has_active_subscription || data?.subscription_active || status === 'active' || data?.global_role !== 'end_user')

          setSubStatus(status)
          setIsPremium(premium)

          // Conservative defaults when stripe endpoint is unavailable.
          setUploadCount(0)
          setUploadLimit(1)
          setUploadsRemaining(premium ? null : 1)
        } catch {
          setSubStatus('free')
          setIsPremium(false)
        }
      })
      .finally(() => setLoading(false))
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
