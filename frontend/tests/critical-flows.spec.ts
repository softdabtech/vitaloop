import { test, expect } from '@playwright/test'

test.describe('Critical User Flows', () => {
  test('signup → onboarding → upload', async ({ page }) => {
    // Signup
    await page.goto('/login?signup=true')
    await expect(page.getByTestId('auth-honeypot')).toBeHidden()
    await page.getByTestId('auth-email').fill(`test-${Date.now()}@example.com`)
    await page.getByTestId('auth-password').fill('TestPassword123!')
    await page.getByTestId('auth-submit').click()
    await page.waitForNavigation()

    // Should be on onboarding
    expect(page.url()).toContain('/onboarding')

    // Step 1: Health Profile
    await page.fill('input[placeholder*="height" i]', '175')
    await page.fill('input[placeholder*="weight" i]', '72')
    await page.click('button:has-text("Next")')

    // Step 2: Supplements
    await page.fill('textarea', 'None currently')
    await page.click('button:has-text("Next")')

    // Step 3: Location
    await page.fill('input[placeholder*="city" i]', 'San Francisco')
    await page.click('button:has-text("Next")')

    // Step 4: Complaints
    await page.fill('textarea', 'Low energy')
    await page.click('button:has-text("Complete")')

    // Should redirect to dashboard
    await page.waitForNavigation()
    expect(page.url()).toContain('/dashboard')
  })

  test('upload lab results → view biomarkers', async ({ page, context }) => {
    // Login first (use existing account if available)
    await page.goto('/login')
    // ... login logic

    // Go to upload
    await page.goto('/upload')

    // Upload a file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./tests/fixtures/sample-lab.pdf')

    // Wait for upload to complete
    await page.waitForSelector('text=Analysis complete', { timeout: 30000 })

    // Should see results
    expect(page.url()).toContain('/results')
    await expect(page.locator('text=Biomarkers')).toBeVisible()
  })

  test('form responsiveness on mobile', async ({ page }) => {
    page.setViewportSize({ width: 375, height: 812 })

    await page.goto('/login')

    // Check no horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth)

    // Check button sizes
    const button = page.locator('button:has-text("Sign in")')
    const box = await button.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  })
})
