import { describe, expect, it } from 'vitest'
import { isCabinetRoutePath } from './App.jsx'

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
