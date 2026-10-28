import { test, expect } from '@playwright/test';

const routes = [
  '/',
  '/how-it-works',
  '/example-report',
  '/for-nutritionists',
  '/for-investors',
  '/privacy',
  '/terms',
  '/login',
  '/login?signup=true',
  '/dashboard',
  '/upload',
  '/lab-results',
  '/assignments',
  '/progress',
  '/insights',
  '/check-ins',
  '/onboarding',
  '/questionnaire',
  '/settings',
  '/ops',
  '/crm/programs',
  '/crm/practitioners',
  '/crm/clients',
  '/crm/activity',
];

test.describe('Мобильная smoke-проверка роутов', () => {
  for (const route of routes) {
    test(`route ${route} не падает и отображается корректно`, async ({ page }) => {
      await page.goto(`http://localhost:5173${route}`);
      await expect(page).not.toHaveTitle(/404|Not Found|Ошибка/i);
      await expect(page.locator('body')).not.toContainText(/error|not found|ошибка|404/i);
      // Проверка, что основной контент видим
      await expect(page.locator('body')).toBeVisible();
      // Проверка на отсутствие горизонтального скролла
      const scroll = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
      expect(scroll).toBeFalsy();
    });
  }
});
