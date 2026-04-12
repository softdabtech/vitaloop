import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAppStore = create(
  persist(
    (set) => ({
      showPaywall: false,
      disclaimerAccepted: false,
      setShowPaywall: (v) => set({ showPaywall: v }),
      acceptDisclaimer: () => set({ disclaimerAccepted: true }),
    }),
    { name: 'vitaloop-app' }
  )
)
