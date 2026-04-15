import { useEffect, useState } from 'react'
import api from '../lib/api.js'

const DEFAULT_STATE = {
  role: 'end_user',
  requires_onboarding: false,
  current_stage: 'complete',
  completed: true,
  checklist: {
    profile_basics: true,
    location: true,
    complaints: true,
    first_upload: true,
    onboarding_complete: true,
  },
}

export function useOnboardingState() {
  const [state, setState] = useState(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const { data } = await api.get('/auth/onboarding/state')
        if (active && data) {
          setState({ ...DEFAULT_STATE, ...data, checklist: { ...DEFAULT_STATE.checklist, ...(data.checklist || {}) } })
        }
      } catch {
        if (active) {
          setState(DEFAULT_STATE)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return { state, loading }
}
