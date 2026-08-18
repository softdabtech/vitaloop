import { useQuery } from '@tanstack/react-query'
import api from '../lib/api.js'
import { supabase, hasSupabaseConfig } from '../lib/supabase.js'

function readAccessTokenFromSupabaseStorage() {
  if (typeof window === 'undefined') return null

  try {
    const key = Object.keys(window.localStorage).find((item) => item.startsWith('sb-') && item.endsWith('-auth-token'))
    if (!key) return null

    const raw = window.localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    return parsed?.access_token || parsed?.currentSession?.access_token || null
  } catch {
    return null
  }
}

async function hasActiveAccessToken() {
  if (hasSupabaseConfig) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) return true
  }

  return Boolean(readAccessTokenFromSupabaseStorage())
}

// Dashboard summary (stats, assignments)
export const useDashboardSummary = () =>
  useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/summary')
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000,   // 10 min cache
  })

// Progress tracking (biomarkers across uploads)
export const useProgress = () =>
  useQuery({
    queryKey: ['progress'],
    queryFn: async () => {
      const { data } = await api.get('/progress')
      return Array.isArray(data) ? data : []
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

// Insights timeline + list
export const useInsights = () =>
  useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const { data } = await api.get('/insights')
      return data || []
    },
    staleTime: 10 * 60 * 1000, // 10 min
    gcTime: 20 * 60 * 1000,
  })

// Timeline events
export const useTimeline = () =>
  useQuery({
    queryKey: ['timeline'],
    queryFn: async () => {
      const { data } = await api.get('/timeline')
      return data || []
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

// Health score
export const useHealthScore = () =>
  useQuery({
    queryKey: ['health-score'],
    queryFn: async () => {
      const { data } = await api.get('/insights/health-score')
      return data || null
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  })

// Lab results by upload ID
export const useLabResults = (uploadId) =>
  useQuery({
    queryKey: ['lab-results', uploadId],
    queryFn: async () => {
      const { data } = await api.get(`/results/${uploadId}`)
      return data || []
    },
    enabled: !!uploadId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

// User profile
export const useUserProfile = () =>
  useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile')
      return data || null
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

// User entitlements (subscriptions, features)
export const useUserEntitlements = () =>
  useQuery({
    queryKey: ['user-entitlements'],
    queryFn: async () => {
      const freeEntitlements = {
        is_premium: false,
        billing_status: 'free',
        plan_key: 'free',
        has_active_subscription: false,
        features: { upload_limit: 1, lab_history: true, trend_analysis: false, advanced_protocol: false, symptom_lab_plan: true, checkins: false },
      }

      const hasToken = await hasActiveAccessToken()
      if (!hasToken) {
        return freeEntitlements
      }

      try {
        const { data } = await api.get('/auth/entitlements')
        const entitlements = data?.entitlements || data || {}
        const billingStatus = String(entitlements?.billing_status || entitlements?.subscription_status || 'free').toLowerCase()
        const isPremium = typeof entitlements?.is_premium === 'boolean'
          ? entitlements.is_premium
          : Boolean(entitlements?.has_active_subscription || entitlements?.subscription_active || billingStatus === 'active')

        return {
          ...freeEntitlements,
          ...entitlements,
          is_premium: isPremium,
          billing_status: billingStatus,
          plan_key: entitlements?.plan_key || entitlements?.plan_name || (isPremium ? 'personal' : 'free'),
          has_active_subscription: Boolean(isPremium || entitlements?.has_active_subscription || entitlements?.subscription_active),
          features: {
            ...freeEntitlements.features,
            ...(entitlements?.features || {}),
          },
        }
      } catch (error) {
        if (error?.response?.status === 401) {
          return freeEntitlements
        }
        throw error
      }
    },
    staleTime: 15 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

// Symptom check session/context
export const useQuestionnaireSession = () =>
  useQuery({
    queryKey: ['questionnaire-session'],
    queryFn: async () => {
      const { data } = await api.get('/questionnaire/session')
      return data || {}
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

// Biomarker normalization for a specific lab
export const useBiomarkerNormalize = (uploadId) =>
  useQuery({
    queryKey: ['biomarker-normalize', uploadId],
    queryFn: async () => {
      const { data } = await api.get(`/biomarker/normalize/${uploadId}`)
      return data || {}
    },
    enabled: !!uploadId,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

// Lab results list (all uploads)
export const useLabResultsList = () =>
  useQuery({
    queryKey: ['lab-results-list'],
    queryFn: async () => {
      const { data } = await api.get('/lab-results')
      return Array.isArray(data) ? data : []
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

// Assignments (from practitioners)
export const useAssignments = () =>
  useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const { data } = await api.get('/assignments')
      return Array.isArray(data) ? data : []
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
