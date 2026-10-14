import { describe, expect, it } from 'vitest'
import { isCabinetRoutePath, shouldRedirectToOnboarding } from './App.jsx'

describe('cabinet route classification', () => {
  it('classifies Help Center with cabinet routes', () => {
    expect(isCabinetRoutePath('/help-center')).toBe(true)
    expect(isCabinetRoutePath('/help-center/article')).toBe(true)
  })

  it('keeps public Help outside the cabinet shell', () => {
    expect(isCabinetRoutePath('/help')).toBe(false)
    expect(isCabinetRoutePath('/help/section/billing')).toBe(false)
  })
})

describe('onboarding route guard', () => {
  it('does not redirect while onboarding state is unresolved', () => {
    expect(shouldRedirectToOnboarding({
      onboardingStateKnown: false,
      requiresOnboarding: true,
      allowBeforeOnboarding: false,
    })).toBe(false)
  })

  it('redirects only for an explicit required state', () => {
    expect(shouldRedirectToOnboarding({
      onboardingStateKnown: true,
      requiresOnboarding: true,
      allowBeforeOnboarding: false,
    })).toBe(true)
    expect(shouldRedirectToOnboarding({
      onboardingStateKnown: true,
      requiresOnboarding: false,
      allowBeforeOnboarding: false,
    })).toBe(false)
  })
})
