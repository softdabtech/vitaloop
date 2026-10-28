import { useQuery } from '@tanstack/react-query'
import api from '../lib/api.js'

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile')
      return data
    },
    staleTime: 10 * 60 * 1000, // 10 min
  })
}

export function useTimeline() {
  return useQuery({
    queryKey: ['timeline'],
    queryFn: async () => {
      const { data } = await api.get('/timeline')
      return data || []
    },
  })
}

export function useInsights() {
  return useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const { data } = await api.get('/insights')
      return data || []
    },
  })
}

export function useHealthScore() {
  return useQuery({
    queryKey: ['health-score'],
    queryFn: async () => {
      const { data } = await api.get('/insights/health-score')
      return data
    },
  })
}
