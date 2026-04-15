import { useCallback, useEffect, useRef, useState } from 'react'

export function useCRMQuery(queryFn, deps = [], options = {}) {
  const { enabled = true, initialData = null } = options
  const [data, setData] = useState(initialData)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const mountedRef = useRef(true)

  const run = useCallback(async () => {
    if (!enabled) return null

    setLoading(true)
    setError(null)
    try {
      const next = await queryFn()
      if (mountedRef.current) setData(next)
      return next
    } catch (err) {
      if (mountedRef.current) setError(err)
      throw err
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [enabled, queryFn])

  useEffect(() => {
    mountedRef.current = true
    run().catch(() => {})
    return () => {
      mountedRef.current = false
    }
  }, deps)

  return {
    data,
    error,
    loading,
    setData,
    refetch: run,
  }
}

export function useCRMMutation(mutateFn) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (payload) => {
    setLoading(true)
    setError(null)
    try {
      return await mutateFn(payload)
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [mutateFn])

  return {
    loading,
    error,
    mutate: run,
  }
}
