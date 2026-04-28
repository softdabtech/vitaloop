import { test, expect } from '@playwright/test'

// E2E: Get Health Insights (USER_TESTING_GUIDE.md, Scenario 4)
test.describe('Health Insights', () => {
  test('User can view personalized health recommendations', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://vitaloop.today/login')
    await page.fill('input[type="email"]', 'a@a.com')
    await page.fill('input[type="password"]', 'Aaaaaa')
    await page.click('button:has-text("Sign In")')
    await page.waitForNavigation()

    // 2. Go to Insights tab
    await page.click('text=/Insights/i')
    await expect(page).toHaveURL(/insights/i)

    // 3. Check for health score, metrics, recommendations, risk flags
    await expect(page.locator('text=/Health Score|Score/i')).toBeVisible()
    await expect(page.locator('text=/Recommendation|Advice|Tip/i')).toBeVisible()
    await expect(page.locator('text=/Risk|Flag/i')).toBeVisible()
    await expect(page.locator('text=/Key Metrics|Metrics/i')).toBeVisible()
  })
})
