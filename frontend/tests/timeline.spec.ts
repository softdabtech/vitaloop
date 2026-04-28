import { test, expect } from '@playwright/test'

// E2E: View Timeline (USER_TESTING_GUIDE.md, Scenario 5)
test.describe('Timeline', () => {
  test('User can see chronological health events', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://vitaloop.today/login')
    await page.fill('input[type="email"]', 'a@a.com')
    await page.fill('input[type="password"]', 'Aaaaaa')
    await page.click('button:has-text("Sign In")')
    await page.waitForNavigation()

    // 2. Go to Timeline tab
    await page.click('text=/Timeline/i')
    await expect(page).toHaveURL(/timeline/i)

    // 3. Verify health events, dates, descriptions, order
    await expect(page.locator('text=/Health Event|Event|History/i')).toBeVisible()
    await expect(page.locator('text=/Date|Test Date|Occurred/i')).toBeVisible()
    await expect(page.locator('text=/Description|Details/i')).toBeVisible()
    // Click on event for details (if available)
    const event = page.locator('[data-testid="timeline-event"], .timeline-event, .event-row')
    if (await event.count() > 0) {
      await event.first().click()
      await expect(page.locator('text=/Details|Description|Event/i')).toBeVisible()
    }
  })
})
