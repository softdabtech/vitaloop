import { test, expect } from '@playwright/test'

// E2E: Sidebar Navigation Links (USER_TESTING_GUIDE.md, Scenario 8)
test.describe('Sidebar Navigation', () => {
  test('All sidebar links are clickable and route correctly', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://vitaloop.today/login')
    await page.fill('input[type="email"]', 'a@a.com')
    await page.fill('input[type="password"]', 'Aaaaaa')
    await page.click('button:has-text("Sign In")')
    await page.waitForNavigation()

    // 2. Sidebar links to check (text or aria-label)
    const sidebarLinks = [
      { label: 'Dashboard', url: /dashboard/ },
      { label: 'Progress', url: /progress/ },
      { label: 'Insights', url: /insights/ },
      { label: 'Timeline', url: /timeline/ },
      { label: 'Questionnaire', url: /questionnaire/ },
      { label: 'Settings', url: /settings/ },
      { label: 'Subscription', url: /subscription/ },
    ]

    for (const link of sidebarLinks) {
      // Click sidebar link
      await page.click(`nav >> text=${link.label}`)
      // Check URL
      await expect(page).toHaveURL(link.url)
      // Optionally, check page heading
      await expect(page.locator('h1, h2')).toContainText(link.label, { ignoreCase: true })
    }
  })
})
