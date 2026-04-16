import { useEffect, useState } from 'react'
import api from '../lib/api.js'

const LOADING_STATE = {
  role: 'end_user',
  requires_onboarding: null,
  current_stage: null,
  completed: null,
  checklist: {},
}

const FALLBACK_STATE = {
  role: 'end_user',
  requires_onboarding: true,
  current_stage: 'profile',
  completed: false,
  checklist: {
    profile_basics: false,
    location: false,
    complaints: false,
    first_upload: false,
    questionnaire_completed: false,
    onboarding_complete: false,
  },
}

export function useOnboardingState() {
  const [state, setState] = useState(LOADING_STATE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const { data } = await api.get('/auth/onboarding/state')
        if (active && data) {
          setState({ ...FALLBACK_STATE, ...data, checklist: { ...FALLBACK_STATE.checklist, ...(data.checklist || {}) } })
        }
      } catch {
        // API failed - assume onboarding is needed for safety.
        if (active) {
          setState(FALLBACK_STATE)
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
