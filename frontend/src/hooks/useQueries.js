import { useQuery, useQueries } from '@tanstack/react-query'
import api from '../lib/api.js'

// Cache durations
const CACHE_DURATION = {
  dashboard: 5 * 60 * 1000, // 5 minutes
  progress: 5 * 60 * 1000,
  insights: 10 * 60 * 1000, // 10 minutes
  user: 30 * 60 * 1000, // 30 minutes
  results: 5 * 60 * 1000,
}

// Dashboard summary
export const useDashboardSummary = () => {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/dashboard/summary').then(res => res.data),
    staleTime: CACHE_DURATION.dashboard,
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 mins after unused
    retry: 1,
  })
}

// Progress data
export const useProgress = () => {
  return useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get('/progress').then(res => res.data),
    staleTime: CACHE_DURATION.progress,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  })
}

// Insights
export const useInsights = () => {
  return useQuery({
    queryKey: ['insights'],
    queryFn: () => api.get('/insights').then(res => res.data),
    staleTime: CACHE_DURATION.insights,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  })
}

// User profile
export const useUserProfile = () => {
  return useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => api.get('/user/profile').then(res => res.data),
    staleTime: CACHE_DURATION.user,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })
}

// Lab results by ID
export const useLabResults = (labId) => {
  return useQuery({
    queryKey: ['labs', labId],
    queryFn: () => api.get(`/labs/${labId}`).then(res => res.data),
    staleTime: CACHE_DURATION.results,
    gcTime: 30 * 60 * 1000,
    enabled: !!labId, // Only run if labId exists
    retry: 1,
  })
}

// Normalized biomarker data from single source of truth (backend)
// Backend handles all status calculations - no logic duplication
export const useBiomarkerNormalize = (labId, enabled = true) => {
  return useQuery({
    queryKey: ['biomarker', 'normalize', labId],
    queryFn: () => api.post(`/biomarker/normalize/${labId}`).then(res => res.data),
    staleTime: CACHE_DURATION.results,
    gcTime: 30 * 60 * 1000,
    enabled: enabled && !!labId,
    retry: 2,  // Retry more for important biomarker data
  })
}

// User entitlements for feature flags
export const useUserEntitlements = () => {
  return useQuery({
    queryKey: ['user', 'entitlements'],
    queryFn: () => api.get('/user/entitlements').then(res => res.data),
    staleTime: CACHE_DURATION.user,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })
}
