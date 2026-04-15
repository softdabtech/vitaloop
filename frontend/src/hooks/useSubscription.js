import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './useAuth.js'

export function useSubscription() {
  const { user } = useAuth()
  const [subStatus, setSubStatus] = useState('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setSubStatus('free')
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('users')
      .select('sub_status')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setSubStatus(data.sub_status)
        setLoading(false)
      })
      .catch(() => {
        setSubStatus('free')
        setLoading(false)
      })
  }, [user])

  return { subStatus, isActive: subStatus === 'active', loading }
}
