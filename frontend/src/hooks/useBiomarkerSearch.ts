import { useMemo } from 'react'

export function useBiomarkerSearch(biomarkers: any[], searchQuery: string) {
  return useMemo(() => {
    if (!searchQuery.trim()) return biomarkers

    const q = searchQuery.toLowerCase()
    return biomarkers.filter(b =>
      b.name?.toLowerCase().includes(q) ||
      b.code?.toLowerCase().includes(q) ||
      b.category?.toLowerCase().includes(q)
    )
  }, [biomarkers, searchQuery])
}

export function useBiomarkerFilter(biomarkers: any[], status?: string) {
  return useMemo(() => {
    if (!status) return biomarkers
    return biomarkers.filter(b => b.status === status)
  }, [biomarkers, status])
}

export function useBiomarkerSort(biomarkers: any[], sortBy: 'priority' | 'name' | 'value' = 'priority') {
  return useMemo(() => {
    const sorted = [...biomarkers]

    const statusRank = { DEFICIENT: 0, ELEVATED: 1, BORDERLINE: 2, OPTIMAL: 3 }

    if (sortBy === 'priority') {
      sorted.sort((a, b) => (statusRank[a.status] ?? 4) - (statusRank[b.status] ?? 4))
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    } else if (sortBy === 'value') {
      sorted.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    }

    return sorted
  }, [biomarkers, sortBy])
}
