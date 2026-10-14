import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MobileBottomBar, { MOBILE_NAV_ITEMS, MOBILE_SUBNAV } from './MobileBottomBar.jsx'

function renderNavigation(initialEntry = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MobileBottomBar />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  delete document.body.dataset.vtlMobileSubnav
})

describe('MobileBottomBar', () => {
  it('exposes exactly one five-destination mobile navigation model', () => {
    renderNavigation()

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy()
    expect(MOBILE_NAV_ITEMS).toHaveLength(5)
    expect(MOBILE_NAV_ITEMS.map((item) => item.label)).toEqual(['Home', 'Results', 'Upload', 'My Plan', 'Account'])
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('opens My Plan with Action Plan / Protocol and Lab Plan access', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    renderNavigation()

    fireEvent.click(screen.getByRole('button', { name: 'My Plan' }))

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'vtl-mobile-subnav-change',
      detail: { openSubnav: 'plan' },
    }))
    expect(document.body.dataset.vtlMobileSubnav).toBe('plan')
    expect(MOBILE_SUBNAV.plan.map((item) => item.label)).toEqual(['Action Plan / Protocol', 'Lab Plan'])
    expect(screen.getByRole('menu', { name: 'My Plan menu' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Action Plan / Protocol' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Lab Plan' })).toBeTruthy()
  })

  it('opens Account with Profile & Safety, Subscription, and Help access', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    renderNavigation()

    fireEvent.click(screen.getByRole('button', { name: 'Account' }))

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'vtl-mobile-subnav-change',
      detail: { openSubnav: 'account' },
    }))
    expect(document.body.dataset.vtlMobileSubnav).toBe('account')
    expect(MOBILE_SUBNAV.account.map((item) => item.label)).toEqual(['Profile & Safety', 'Subscription', 'Help'])
    expect(screen.getByRole('menu', { name: 'Account menu' })).toBeTruthy()
  })

  it('publishes a closed state without reopening chat when a submenu closes', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    renderNavigation()

    fireEvent.click(screen.getByRole('button', { name: 'My Plan' }))
    fireEvent.click(screen.getByRole('button', { name: 'My Plan' }))

    expect(dispatchSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'vtl-mobile-subnav-change',
      detail: { openSubnav: null },
    }))
    expect(document.body.dataset.vtlMobileSubnav).toBeUndefined()
  })

  it('keeps labels and controls within the mobile layout contract', () => {
    renderNavigation()

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-11')
      expect(button.className).toContain('min-w-0')
    }

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(navigation.className).toContain('vtl-mobile-bottom-nav')
  })
})
