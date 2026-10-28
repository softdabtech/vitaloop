import { test, expect } from '@playwright/test'
import path from 'path'

// E2E: Lab Upload & Analysis (USER_TESTING_GUIDE.md, Scenario 2)
test.describe('Lab Upload & Analysis', () => {
  test('User can upload lab results and see biomarker analysis', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://vitaloop.today/login')
    await page.fill('input[type="email"]', 'a@a.com')
    await page.fill('input[type="password"]', 'Aaaaaa')
    await page.click('button:has-text("Sign In")')
    await page.waitForNavigation()

    // 2. Go to Upload Lab Results/Analysis tab
    await page.click('text=/Upload Lab Results|Analysis/i')
    await expect(page).toHaveURL(/upload|analysis/i)

    // 3. Click New Upload
    await page.click('button:has-text("New Upload")')

    // 4. Paste lab results text
    await page.fill('textarea', `Complete Blood Count\nHemoglobin 14.2 g/dL (13.5-17.5)\nWBC 6.1 x10^9/L (4.0-11.0)\nPlatelets 250 x10^9/L (150-400)\n\nMetabolic Panel\nGlucose 92 mg/dL (70-99)\nCreatinine 0.95 mg/dL (0.7-1.3)\n\nLipid Panel\nTotal Cholesterol 182 mg/dL\nHDL 58 mg/dL\nLDL 103 mg/dL\nTriglycerides 105 mg/dL`)

    // 5. Add optional details
    await page.fill('input[name="labName"]', 'Quest Diagnostics')
    await page.fill('input[name="testDate"]', '2026-04-28')
    // Symptoms: select any (if present)
    const symptoms = page.locator('input[type="checkbox"]')
    if (await symptoms.count() > 0) {
      await symptoms.first().check()
    }

    // 6. Click Analyze
    await page.click('button:has-text("Analyze")')

    // 7. Wait for results
    await page.waitForSelector('text=Biomarkers', { timeout: 30000 })

    // 8. Verify biomarkers extracted and displayed
    await expect(page.locator('text=Biomarkers')).toBeVisible()
    await expect(page.locator('text=Hemoglobin')).toBeVisible()
    await expect(page.locator('text=Glucose')).toBeVisible()
    await expect(page.locator('text=Total Cholesterol')).toBeVisible()
  })
})
