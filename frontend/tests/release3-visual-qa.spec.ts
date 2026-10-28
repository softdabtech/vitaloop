import { expect, test } from '@playwright/test'

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE

test.use({
  viewport: { width: 1440, height: 1000 },
  ...(storageState ? { storageState } : {}),
})

for (const route of ['/upload', '/health-profile', '/help-center']) {
  test(`Release 3 desktop: ${route} renders without horizontal overflow`, async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_STORAGE_STATE, 'Set PLAYWRIGHT_STORAGE_STATE to a local authorized session')

    await page.goto(route)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('main, [role="main"]').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test.describe('Release 3 mobile interaction contract', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Upload segmented control, Help navigation, and focus targets are usable at 390px', async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_STORAGE_STATE, 'Set PLAYWRIGHT_STORAGE_STATE to a local authorized session')

    await page.goto('/upload')
    await expect(page).not.toHaveURL(/\/login/)
    const manualTab = page.getByRole('tab', { name: /enter manually/i })
    await expect(manualTab).toBeVisible()
    await expect(manualTab).toHaveCSS('min-height', '44px')
    await manualTab.focus()
    await expect(manualTab).toBeFocused()
    await manualTab.click()
    await expect(manualTab).toHaveAttribute('aria-selected', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.goto('/help-center')
    await expect(page).not.toHaveURL(/\/login/)
    const topics = page.getByRole('button', { name: /browse all topics/i })
    await expect(topics).toBeVisible()
    await expect(topics).toHaveCSS('min-height', '44px')
    await topics.click()
    await expect(page.getByRole('navigation')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
