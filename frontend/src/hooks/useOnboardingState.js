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
    account_setup_complete: false,
    first_health_loop_started: false,
    first_health_loop_complete: false,
  },
  account_setup_complete: false,
  first_health_loop_started: false,
  first_health_loop_complete: false,
}

export function useOnboardingState({ enabled = true } = {}) {
  const [state, setState] = useState(LOADING_STATE)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    if (!enabled) {
      setState(LOADING_STATE)
      setLoading(true)
      return () => {
        active = false
      }
    }

    setLoading(true)
    async function load() {
      try {
        const { data } = await api.get('/auth/onboarding/state', { timeout: 6000 })
        if (active && data) {
          setState({ ...FALLBACK_STATE, ...data, checklist: { ...FALLBACK_STATE.checklist, ...(data.checklist || {}) } })
        }
      } catch {
        if (active) {
          setState(LOADING_STATE)
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
  }, [attempt, enabled])

  return {
    state,
    loading,
    retry: () => setAttempt((value) => value + 1),
  }
}
