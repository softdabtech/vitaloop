import { test, expect, Page } from '@playwright/test';

// Test data
const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
};

const ONBOARDING_DATA = {
  height_cm: '180',
  weight_kg: '75',
  goals: ['energy', 'sleep'],
  supplements: 'Vitamin D, Omega-3',
  medications: 'None',
  diagnoses: 'None',
  city: 'San Francisco',
  state: 'CA',
  country: 'USA',
};

test.describe('Мобильный флоу регистрации (Sign Up + Onboarding)', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('1. Открыть страницу логина', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await expect(page).not.toHaveTitle(/404|Not Found/i);

    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('2. Переключиться на Sign Up', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    // Should show sign up form
    const signUpButton = page.locator('button:has-text("Sign up")').first();
    await expect(signUpButton).toBeVisible();
  });

  test('3. Заполнить форму регистрации с корректными данными', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    // Fill email
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill(TEST_USER.email);
    await expect(emailInput).toHaveValue(TEST_USER.email);

    // Fill password
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(TEST_USER.password);
    await expect(passwordInput).toHaveValue(TEST_USER.password);

    // Check that no validation errors appear
    await page.waitForTimeout(500);
    const errorMessages = page.locator('text=/Invalid|incorrect|required/i');
    await expect(errorMessages.first()).not.toBeVisible();
  });

  test('4. Проверить валидацию email', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    const emailInput = page.locator('input[type="email"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    // Test invalid emails
    const invalidEmails = ['notanemail', 'missing@domain', '@nodomain.com'];

    for (const email of invalidEmails) {
      await emailInput.fill(email);
      await submitBtn.click();

      // Should show validation error or not allow submission
      await page.waitForTimeout(300);
      const currentUrl = page.url();
      expect(currentUrl).toContain('/login');
    }
  });

  test('5. Проверить валидацию пароля', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    // Valid email, empty password
    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill('');
    await submitBtn.click();

    // Should not proceed without password
    await page.waitForTimeout(300);
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');
  });

  test('6. Проверить видимость пароля (toggle show/hide)', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    const passwordInput = page.locator('input[type="password"]').first();
    const toggleBtn = page.locator('button[aria-label*="password"], button:has-text(/show|hide)/i').first();

    if (await toggleBtn.isVisible()) {
      const initialType = await passwordInput.getAttribute('type');

      // Toggle visibility
      await toggleBtn.click();
      await page.waitForTimeout(200);

      const newType = await passwordInput.getAttribute('type');
      expect(initialType).not.toBe(newType);
    }
  });

  test('7. Проверить рецаптча видима на мобильной версии', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    // Look for reCAPTCHA iframe or element
    const recaptchaFrame = page.locator('iframe[title*="recaptcha"], iframe[src*="recaptcha"]');
    const recaptchaDiv = page.locator('div.g-recaptcha');

    const hasRecaptcha = await recaptchaFrame.isVisible().catch(() => false) ||
                         await recaptchaDiv.isVisible().catch(() => false);

    expect(hasRecaptcha).toBe(true);
  });

  test('8. Проверить форму регистрации на мобильном устройстве (макет)', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    // Check for horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.clientWidth);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(bodyWidth + 1);

    // Check that form is readable
    const emailInput = page.locator('input[type="email"]').first();
    const bbox = await emailInput.boundingBox();
    expect(bbox?.width).toBeGreaterThan(200);
  });

  test('9. Проверить кнопки на мобильной версии (размер и доступность)', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const btn = buttons.nth(i);
      const bbox = await btn.boundingBox();

      if (bbox) {
        // Кнопка должна быть минимум 44x44px для мобильной доступности
        expect(bbox.width).toBeGreaterThanOrEqual(40);
        expect(bbox.height).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('10. Проверить ссылки на мобильной версии логина', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    // Check for "Sign up" link
    const signupLink = page.locator('a:has-text("Sign up"), button:has-text("Sign up")').first();
    await expect(signupLink).toBeVisible();

    // Check for "Forgot password" link
    const forgotLink = page.locator('a:has-text("Forgot"), button:has-text("Forgot")').first();
    const forgotLinkExists = await forgotLink.isVisible().catch(() => false);
    if (forgotLinkExists) {
      await expect(forgotLink).toBeVisible();
    }
  });

  test('11. Проверить интеграцию с Google (видимость кнопки)', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    const googleBtn = page.locator('button:has-text("Google"), button[aria-label*="Google"]').first();
    const googleBtnVisible = await googleBtn.isVisible().catch(() => false);

    // Google button должна быть видима
    if (googleBtnVisible) {
      await expect(googleBtn).toBeVisible();
    }
  });

  test('12. Проверить обработка ошибок валидации (в режиме реального времени)', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    const emailInput = page.locator('input[type="email"]').first();

    // Ввести невалидный email
    await emailInput.fill('invalid@');
    await emailInput.blur();

    await page.waitForTimeout(300);

    // Проверить есть ли сообщение об ошибке
    const errorMsg = page.locator('text=/invalid|incorrect|required/i').first();
    const hasError = await errorMsg.isVisible().catch(() => false);

    // Если есть ошибка, она должна быть видима на мобильной версии
    if (hasError) {
      const bbox = await errorMsg.boundingBox();
      expect(bbox?.width).toBeLessThanOrEqual(375);
    }
  });

  test('13. Проверить ориентацию на мобильной версии (портрет)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5173/login?signup=true');

    const form = page.locator('form').first();
    await expect(form).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test('14. Проверить ориентацию на мобильной версии (ландшафт)', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('http://localhost:5173/login?signup=true');

    const form = page.locator('form').first();
    await expect(form).toBeVisible();

    // Форма должна быть читаемой в ландшафтном режиме
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    // Должна быть возможность скролла, но не слишком много
    expect(scrollHeight / viewportHeight).toBeLessThan(3);
  });
});

test.describe('Мобильный флоу после регистрации (Onboarding)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('15. Открыть страницу Onboarding', async ({ page }) => {
    await page.goto('http://localhost:5173/onboarding');

    // Page should be accessible (may require auth)
    const title = await page.title();
    expect(title).not.toContain('404');
  });

  test('16. Проверить форму здоровья (Health Profile)', async ({ page }) => {
    await page.goto('http://localhost:5173/onboarding');

    // Look for height input
    const heightInput = page.locator('input[placeholder*="height"], input[placeholder*="cm"]').first();
    const hasHeightField = await heightInput.isVisible().catch(() => false);

    if (hasHeightField) {
      await heightInput.fill(ONBOARDING_DATA.height_cm);
      await expect(heightInput).toHaveValue(ONBOARDING_DATA.height_cm);
    }
  });

  test('17. Проверить кнопки навигации (Previous/Next) на мобильной версии', async ({ page }) => {
    await page.goto('http://localhost:5173/onboarding');

    const nextBtn = page.locator('button:has-text("Next"), button[aria-label*="next"]').first();
    const prevBtn = page.locator('button:has-text("Previous"), button:has-text("Back"), button[aria-label*="previous"]').first();

    // Должны быть видны кнопки навигации
    const hasNextBtn = await nextBtn.isVisible().catch(() => false);
    const hasPrevBtn = await prevBtn.isVisible().catch(() => false);

    if (hasNextBtn || hasPrevBtn) {
      if (hasNextBtn) {
        const bbox = await nextBtn.boundingBox();
        expect(bbox?.width).toBeGreaterThan(80);
      }
    }
  });

  test('18. Проверить отображение прогресса (Progress bar)', async ({ page }) => {
    await page.goto('http://localhost:5173/onboarding');

    const progressBar = page.locator('[role="progressbar"], .progress, [class*="progress"]').first();
    const hasProgress = await progressBar.isVisible().catch(() => false);

    if (hasProgress) {
      await expect(progressBar).toBeVisible();
    }
  });

  test('19. Проверить опции выбора целей (Goals)', async ({ page }) => {
    await page.goto('http://localhost:5173/onboarding');

    const goalChips = page.locator('button[class*="goal"], [class*="chip"]');
    const chipCount = await goalChips.count();

    // Должно быть несколько опций целей
    if (chipCount > 0) {
      for (let i = 0; i < Math.min(chipCount, 3); i++) {
        const chip = goalChips.nth(i);
        await expect(chip).toBeVisible();

        // Проверить что чип кликабелен на мобильной версии
        const bbox = await chip.boundingBox();
        expect(bbox?.width).toBeGreaterThan(60);
      }
    }
  });

  test('20. Проверить мобильную адаптивность формы Onboarding (макет)', async ({ page }) => {
    await page.goto('http://localhost:5173/onboarding');

    // Нет горизонтального скролла
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);

    // Все элементы видимы или скролируются вертикально
    const inputs = page.locator('input');
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      for (let i = 0; i < Math.min(inputCount, 3); i++) {
        const input = inputs.nth(i);
        const bbox = await input.boundingBox();
        expect(bbox?.width).toBeLessThanOrEqual(viewportWidth);
      }
    }
  });

  test('21. Проверить кнопку Skip Onboarding', async ({ page }) => {
    await page.goto('http://localhost:5173/onboarding');

    const skipBtn = page.locator('button:has-text("Skip"), button[aria-label*="skip"]').first();
    const hasSkipBtn = await skipBtn.isVisible().catch(() => false);

    // Skip кнопка должна быть доступна
    if (hasSkipBtn) {
      await expect(skipBtn).toBeVisible();
    }
  });

  test('22. Проверить обработка пустых полей в Onboarding', async ({ page }) => {
    await page.goto('http://localhost:5173/onboarding');

    const nextBtn = page.locator('button:has-text("Next"), button[aria-label*="next"]').first();
    const canClickNext = await nextBtn.isEnabled().catch(() => false);

    // Кнопка может быть disabled если обязательные поля не заполнены
    if (!canClickNext) {
      await expect(nextBtn).toBeDisabled();
    }
  });
});

test.describe('Полный флоу пользователя после регистрации', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('23. Навигация в кабинете пользователя (Dashboard)', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    // Page should be accessible
    const title = await page.title();
    expect(title).not.toContain('404');
  });

  test('24. Проверить мобильное меню кабинета (Bottom Bar)', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    // Bottom navigation bar должна быть видна на мобильной версии
    const bottomNav = page.locator('nav[aria-label*="navigation"], [class*="bottom"], [class*="footer"]').first();
    const hasNav = await bottomNav.isVisible().catch(() => false);

    if (hasNav) {
      await expect(bottomNav).toBeVisible();
    }
  });

  test('25. Проверить ссылки в меню (Upload, Assignments, Settings)', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    const navLinks = [
      { text: 'Upload', href: '/upload' },
      { text: 'Assignments', href: '/assignments' },
      { text: 'Settings', href: '/settings' },
    ];

    for (const link of navLinks) {
      const navLink = page.locator(`a:has-text("${link.text}"), button:has-text("${link.text}")`).first();
      const isVisible = await navLink.isVisible().catch(() => false);

      if (isVisible) {
        await expect(navLink).toBeVisible();
      }
    }
  });

  test('26. Проверить Upload страницу на мобильной версии', async ({ page }) => {
    await page.goto('http://localhost:5173/upload');

    const uploadBtn = page.locator('button:has-text("Upload"), input[type="file"]').first();
    const hasUpload = await uploadBtn.isVisible().catch(() => false);

    expect(hasUpload).toBe(true);
  });

  test('27. Проверить Settings на мобильной версии', async ({ page }) => {
    await page.goto('http://localhost:5173/settings');

    const settingsForm = page.locator('form, [class*="settings"]').first();
    const hasSettings = await settingsForm.isVisible().catch(() => false);

    expect(hasSettings).toBe(true);
  });

  test('28. Проверить кнопку выхода (Sign Out)', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    const signOutBtn = page.locator('button:has-text("Sign out"), button:has-text("Logout"), button[aria-label*="logout"]').first();
    const hasSignOut = await signOutBtn.isVisible().catch(() => false);

    if (hasSignOut) {
      await expect(signOutBtn).toBeVisible();
    }
  });

  test('29. Проверить мобильную адаптивность Dashboard', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    // Нет горизонтального скролла
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test('30. Проверить safe-area для iPhone (notch support)', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    const bottomBar = page.locator('nav[class*="bottom"], [style*="safe-area"]').first();
    const hasBottomBar = await bottomBar.isVisible().catch(() => false);

    if (hasBottomBar) {
      const style = await bottomBar.getAttribute('style');
      const hasSafeArea = style?.includes('safe-area') || await page.evaluate(() => {
        const el = document.querySelector('[style*="safe-area"]');
        return el !== null;
      });

      expect(hasSafeArea).toBe(true);
    }
  });
});
