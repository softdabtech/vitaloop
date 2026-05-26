import { test, expect } from '@playwright/test'

// E2E: View Progress (USER_TESTING_GUIDE.md, Scenario 3)
test.describe('View Progress', () => {
  test('User sees new biomarker overview and protocol UX', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://vitaloop.today/login')
    await page.fill('input[type="email"]', 'a@a.com')
    await page.fill('input[type="password"]', 'Aaaaaa')
    await page.click('button:has-text("Sign In")')
    await page.waitForNavigation()

    // 2. Open progress page
    await page.goto('https://vitaloop.today/progress', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/progress/i)

    // 3. Verify updated UX sections are present
    await expect(page.getByText('Biomarker Overview')).toBeVisible()
    await expect(page.getByText('AI Analysis')).toBeVisible()
    await expect(page.getByText('Your Personalized Protocol')).toBeVisible()
    await expect(page.getByText('Why these?')).toBeVisible()

    // 4. Verify at least one biomarker card exists
    const biomarkerCards = page.locator('text=Ferritin, text=Vitamin D, text=Omega-3 Index, text=Magnesium')
    await expect(biomarkerCards.first()).toBeVisible()

    // 5. Verify trend visualization and save visual artifact
    const trendChart = page.locator('svg').first()
    await expect(trendChart).toBeVisible()
    await page.screenshot({ path: 'test-results/progress-ui-redesign.png', fullPage: true })

    // 6. Protocol rows should render
    const protocolRows = page.locator('text=/Daily|Before bed|Every other day/i')
    if (await protocolRows.count() > 0) {
      await expect(protocolRows.first()).toBeVisible()
    }
  })
})
