import { test, expect } from '@playwright/test'

// E2E: All clickable elements (USER_TESTING_GUIDE.md, Scenario 9)
test.describe('Clickable Elements', () => {
  test('All main clickable elements work', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://vitaloop.today/login')
    await page.fill('input[type="email"]', 'a@a.com')
    await page.fill('input[type="password"]', 'Aaaaaa')
    await page.click('button:has-text("Sign In")')
    await page.waitForNavigation()

    // 2. Collapse sidebar
    await page.click('[data-testid="sidebar-collapse"], button[aria-label*="collapse" i]')
    await expect(page.locator('nav')).toHaveClass(/collapsed|hidden/i)
    // Expand sidebar
    await page.click('[data-testid="sidebar-collapse"], button[aria-label*="collapse" i]')
    await expect(page.locator('nav')).not.toHaveClass(/collapsed|hidden/i)

    // 3. Profile menu open/close
    await page.click('img[alt*="profile" i], [data-testid="profile-menu"]')
    await expect(page.locator('text=/Settings|Logout/i')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('text=/Settings|Logout/i')).not.toBeVisible()

    // 4. Logout button
    await page.click('img[alt*="profile" i], [data-testid="profile-menu"]')
    await page.click('text=/Logout/i')
    await expect(page).toHaveURL(/login/i)
  })
})
