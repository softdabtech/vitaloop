import { test, expect } from '@playwright/test'

// E2E: View Progress (USER_TESTING_GUIDE.md, Scenario 3)
test.describe('View Progress', () => {
  test('User can see lab history and health tracking', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://vitaloop.today/login')
    await page.fill('input[type="email"]', 'a@a.com')
    await page.fill('input[type="password"]', 'Aaaaaa')
    await page.click('button:has-text("Sign In")')
    await page.waitForNavigation()

    // 2. Go to Progress/My Labs tab
    await page.click('text=/Progress|My Labs/i')
    await expect(page).toHaveURL(/progress|labs/i)

    // 3. Verify lab uploads, dates, biomarkers, trends
    await expect(page.locator('text=/Uploaded Labs|Lab History/i')).toBeVisible()
    await expect(page.locator('text=/Hemoglobin|Glucose|Cholesterol/i')).toBeVisible()
    await expect(page.locator('text=/Date|Test Date/i')).toBeVisible()
    // Trend visualization (if available)
    const trend = page.locator('canvas, svg, [data-testid="trend-chart"]')
    if (await trend.count() > 0) {
      await expect(trend).toBeVisible()
    }
  })
})
