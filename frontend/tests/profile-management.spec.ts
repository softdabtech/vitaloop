import { test, expect } from '@playwright/test'

// E2E: Profile Management (USER_TESTING_GUIDE.md, Scenario 1)
test.describe('Profile Management', () => {
  test('User can update and persist profile info', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://vitaloop.today/login')
    await page.fill('input[type="email"]', 'a@a.com')
    await page.fill('input[type="password"]', 'Aaaaaa')
    await page.click('button:has-text("Sign In")')
    await page.waitForNavigation()

    // 2. Go to profile/settings
    await page.click('img[alt*="profile" i], [data-testid="profile-menu"]')
    await page.click('text=/Settings|Profile/i')

    // 3. Update fields
    await page.fill('input[name="firstName"]', 'TestFirst')
    await page.fill('input[name="lastName"]', 'TestLast')
    await page.selectOption('select[name="timezone"]', { label: 'Europe/Kyiv' })
    await page.fill('input[name="preferences"]', 'autotest')

    // 4. Save
    await page.click('button:has-text("Save")')

    // 5. Reload and verify
    await page.reload()
    await expect(page.locator('input[name="firstName"]')).toHaveValue('TestFirst')
    await expect(page.locator('input[name="lastName"]')).toHaveValue('TestLast')
    await expect(page.locator('select[name="timezone"]')).toHaveValue(/Europe\/Kyiv/)
    await expect(page.locator('input[name="preferences"]')).toHaveValue('autotest')
  })
})
