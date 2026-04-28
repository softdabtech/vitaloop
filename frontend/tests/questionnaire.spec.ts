import { test, expect } from '@playwright/test'

// E2E: Complete Questionnaire (USER_TESTING_GUIDE.md, Scenario 6)
test.describe('Questionnaire', () => {
  test('User can complete health questionnaire', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://vitaloop.today/login')
    await page.fill('input[type="email"]', 'a@a.com')
    await page.fill('input[type="password"]', 'Aaaaaa')
    await page.click('button:has-text("Sign In")')
    await page.waitForNavigation()

    // 2. Go to Questionnaire/Assessment tab
    await page.click('text=/Questionnaire|Assessment/i')
    await expect(page).toHaveURL(/questionnaire|assessment/i)

    // 3. Start new assessment
    await page.click('button:has-text("Start New Assessment")')

    // 4. Answer questions (loop through questions)
    for (let i = 0; i < 10; i++) {
      // Select first available answer
      const options = page.locator('input[type="radio"], input[type="checkbox"]')
      if (await options.count() > 0) {
        await options.first().check()
      }
      // Next or Submit
      if (await page.locator('button:has-text("Next")').count() > 0) {
        await page.click('button:has-text("Next")')
      } else if (await page.locator('button:has-text("Submit")').count() > 0) {
        await page.click('button:has-text("Submit")')
        break
      }
    }

    // 5. View results/score
    await expect(page.locator('text=/Result|Score|Assessment Complete/i')).toBeVisible()
  })
})
