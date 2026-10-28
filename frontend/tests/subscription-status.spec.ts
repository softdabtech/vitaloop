import { test, expect } from '@playwright/test'

// E2E: Subscription Status (USER_TESTING_GUIDE.md, Scenario 7)
test.describe('Subscription Status', () => {
  test('User sees Premium subscription as active', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://vitaloop.today/login')
    await page.fill('input[type="email"]', 'a@a.com')
    await page.fill('input[type="password"]', 'Aaaaaa')
    await page.click('button:has-text("Sign In")')
    await page.waitForNavigation()

    // 2. Go to Settings → Subscription or profile menu
    await page.click('img[alt*="profile" i], [data-testid="profile-menu"]')
    await page.click('text=/Settings|Subscription/i')
    await expect(page).toHaveURL(/subscription|settings/i)

    // 3. Verify plan, status, features
    await expect(page.locator('text=/Plan: Premium|Premium Plan/i')).toBeVisible()
    await expect(page.locator('text=/Status: Active|Active/i')).toBeVisible()
    await expect(page.locator('text=/Features unlocked|Premium features/i')).toBeVisible()
  })
})
