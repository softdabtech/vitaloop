import { expect, test } from '@playwright/test'

const authStorageState = process.env.PLAYWRIGHT_STORAGE_STATE
const accountLinks = [
  { label: 'Account Settings', path: '/account' },
  { label: 'Profile & Safety', path: '/health-profile' },
  { label: 'Subscription', path: '/subscription' },
  { label: 'Billing History', path: '/billing-history' },
  { label: 'Check-in History', path: '/check-ins' },
  { label: 'Help', path: '/help-center' },
]

test.use({
  viewport: { width: 390, height: 844 },
  ...(authStorageState ? { storageState: authStorageState } : {}),
})

test('authenticated Account navigation works at 390px', async ({ page }) => {
  test.skip(!authStorageState, 'Set PLAYWRIGHT_STORAGE_STATE to an authorized test session')

  await page.goto('/account/')
  await expect(page.getByRole('button', { name: 'Account', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/account\/?$/)

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  const menu = page.getByRole('menu', { name: 'Account menu' })
  await expect(menu).toBeVisible()

  for (const item of accountLinks) {
    await expect(menu.getByRole('menuitem', { name: item.label })).toBeVisible()
  }

  const menuBounds = await menu.boundingBox()
  const supportButton = page.getByRole('button', { name: /open support chat/i })
  if (await supportButton.isVisible()) {
    const supportBounds = await supportButton.boundingBox()
    expect(menuBounds && supportBounds).toBeTruthy()
    expect(
      menuBounds!.x < supportBounds!.x + supportBounds!.width &&
      menuBounds!.x + menuBounds!.width > supportBounds!.x &&
      menuBounds!.y < supportBounds!.y + supportBounds!.height &&
      menuBounds!.y + menuBounds!.height > supportBounds!.y,
    ).toBe(false)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  for (const [index, item] of accountLinks.entries()) {
    if (index > 0) {
      await page.getByRole('button', { name: 'Account', exact: true }).click()
    }
    await page.getByRole('menuitem', { name: item.label }).click()
    await expect(page).toHaveURL(new RegExp(`${item.path}/?$`))
    await expect(page.getByRole('button', { name: 'Account', exact: true })).toHaveAttribute('aria-current', 'page')
  }

  await page.goto('/account')
  await expect(page).toHaveURL(/\/account\/?$/)
  await page.goto('/health-profile/')
  await page.reload()
  await expect(page).toHaveURL(/\/health-profile\/?$/)
  await expect(page.getByText('Onboarding', { exact: true })).toHaveCount(0)
})
