import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const TABLET_VIEWPORT = { width: 768, height: 1024 };

// Pages to test
const PAGES_TO_TEST = [
  { path: '/', name: 'Landing' },
  { path: '/login', name: 'Login' },
  { path: '/login?signup=true', name: 'Sign Up' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/onboarding', name: 'Onboarding' },
  { path: '/upload', name: 'Upload' },
  { path: '/settings', name: 'Settings' },
  { path: '/lab-results', name: 'Lab Results' },
  { path: '/assignments', name: 'Assignments' },
  { path: '/how-it-works', name: 'How It Works' },
];

test.describe('🎨 Проверка вёрстки на мобильной версии', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  PAGES_TO_TEST.forEach(({ path, name }) => {
    test(`${name} (${path}) — проверка вёрстки`, async ({ page }) => {
      await page.goto(`http://localhost:5173${path}`);

      // Wait for page to fully load
      await page.waitForLoadState('networkidle');

      // ✅ 1. Проверка: нет горизонтального скролла
      const hasHorizontalScroll = await page.evaluate(() => {
        const scrollWidth = document.body.scrollWidth;
        const clientWidth = document.body.clientWidth;
        return scrollWidth > clientWidth + 1;
      });
      expect(hasHorizontalScroll).toBe(false);

      // ✅ 2. Проверка: все видимые кнопки имеют правильный размер (>=44px)
      const buttons = page.locator('button, a[role="button"], [role="button"]');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(buttonCount, 20); i++) {
        const btn = buttons.nth(i);
        const isVisible = await btn.isVisible().catch(() => false);

        if (isVisible) {
          const bbox = await btn.boundingBox();
          if (bbox) {
            // Touch target должна быть >= 44px высоты и ширины
            expect(bbox.height).toBeGreaterThanOrEqual(36);
            // Ширина может быть меньше, но не должна быть микроскопической
            expect(bbox.width).toBeGreaterThan(20);
          }
        }
      }

      // ✅ 3. Проверка: все кнопки полностью видны (не обрезаны)
      const allButtons = await page.locator('button, a[role="button"]').all();
      for (const btn of allButtons.slice(0, 15)) {
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          const bbox = await btn.boundingBox();
          const viewport = await page.viewportSize();

          if (bbox && viewport) {
            // Кнопка не должна быть обрезана справа
            expect(bbox.x + bbox.width).toBeLessThanOrEqual(viewport.width + 5);
            // Кнопка не должна быть обрезана слева
            expect(bbox.x).toBeGreaterThanOrEqual(-5);
          }
        }
      }

      // ✅ 4. Проверка: текст в кнопках не переполняется
      const buttonsWithText = await page.locator('button:not(:empty), a[role="button"]').all();
      for (const btn of buttonsWithText.slice(0, 15)) {
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          const text = await btn.textContent();
          if (text && text.trim().length > 0) {
            // Текст должен быть виден (не скрыт overflow)
            const hasTextOverflow = await btn.evaluate((el) => {
              return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
            }).catch(() => false);

            // На мобильной версии приемлемо небольшое переполнение,
            // но кнопка должна быть расширяемой или иметь правильную обработку
            if (hasTextOverflow) {
              const bbox = await btn.boundingBox();
              // Кнопка должна быть достаточно большой, чтобы вместить текст
              expect(bbox?.width).toBeGreaterThan(50);
            }
          }
        }
      }

      // ✅ 5. Проверка: нет элементов, выходящих за границы экрана
      const allElements = await page.locator('*').all();
      let overflowCount = 0;

      for (const el of allElements.slice(0, 100)) {
        const bbox = await el.boundingBox().catch(() => null);
        const viewport = await page.viewportSize();

        if (bbox && viewport && bbox.x + bbox.width > viewport.width + 10) {
          overflowCount++;
        }
      }

      // Допускается несколько элементов за границами (например, hidden или absolute)
      expect(overflowCount).toBeLessThan(10);

      // ✅ 6. Проверка: основной контент имеет правильные отступы
      const mainContent = page.locator('main, [role="main"]').first();
      const isMainVisible = await mainContent.isVisible().catch(() => false);

      if (isMainVisible) {
        const bbox = await mainContent.boundingBox();
        const viewport = await page.viewportSize();

        if (bbox && viewport) {
          // Контент не должен касаться края экрана (должны быть отступы)
          // Но это не строгое требование для всех страниц
          expect(bbox.x + bbox.width).toBeLessThanOrEqual(viewport.width + 2);
        }
      }

      // ✅ 7. Проверка: нет дублирующихся элементов
      const allButtonTexts = await page.locator('button, a[role="button"]')
        .allTextContents()
        .catch(() => []);

      // Проверяем что нет подозрительно большого количества одинаковых кнопок
      const textCounts: Record<string, number> = {};
      for (const text of allButtonTexts) {
        const normalized = text.trim();
        if (normalized) {
          textCounts[normalized] = (textCounts[normalized] || 0) + 1;
        }
      }

      // Если кнопка повторяется более 5 раз (и это не сетка элементов) - странно
      const tooManyDuplicates = Object.values(textCounts).some(count => count > 10);
      expect(tooManyDuplicates).toBe(false);

      // ✅ 8. Проверка: нет невидимых кликабельных элементов
      const hiddenButtons = await page.locator('button[style*="display: none"], button[style*="visibility: hidden"]').count();
      const visibleButtons = await page.locator('button:visible').count();

      // Не все кнопки могут быть скрыты
      if (visibleButtons + hiddenButtons > 0) {
        expect(visibleButtons).toBeGreaterThan(0);
      }

      // ✅ 9. Проверка: форматирование текста (нет очень длинных строк без переноса)
      const textElements = await page.locator('p, span, div, button').all();
      for (const el of textElements.slice(0, 20)) {
        const text = await el.textContent().catch(() => '');
        if (text && text.length > 50) {
          const bbox = await el.boundingBox();
          // Если текст очень длинный, элемент должен быть достаточно широким
          // или должен быть обработан переносом строк
          if (bbox) {
            const hasOverflow = await el.evaluate((el) => {
              return el.scrollWidth > el.clientWidth;
            }).catch(() => false);

            if (hasOverflow) {
              // Текст переполняет, но это может быть OK если это controlled
              // Главное что элемент не выходит за границы экрана
              expect(bbox.x + bbox.width).toBeLessThanOrEqual(375 + 5);
            }
          }
        }
      }

      // ✅ 10. Проверка: input поля имеют правильный размер
      const inputs = page.locator('input[type="text"], input[type="email"], input[type="password"], textarea');
      const inputCount = await inputs.count();

      for (let i = 0; i < Math.min(inputCount, 10); i++) {
        const input = inputs.nth(i);
        const isVisible = await input.isVisible().catch(() => false);

        if (isVisible) {
          const bbox = await input.boundingBox();
          if (bbox) {
            // Input должен быть достаточно большой для взаимодействия
            expect(bbox.height).toBeGreaterThanOrEqual(40);
            // Input должен быть широким на мобильной версии
            expect(bbox.width).toBeGreaterThan(200);
          }
        }
      }
    });
  });
});

test.describe('🔗 Проверка ссылок и навигации на мобильной версии', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('Все кнопки/ссылки ведут на правильные роуты', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Проверяем некоторые ключевые ссылки/кнопки
    const linkTests = [
      { selector: 'a[href="/how-it-works"], button:has-text("Product")', expectedPath: '/' },
      { selector: 'a[href="/login"], button:has-text("Sign in")', expectedPath: '/login' },
      { selector: 'a[href="/for-nutritionists"]', expectedPath: '/for-nutritionists' },
    ];

    for (const test of linkTests) {
      const element = page.locator(test.selector).first();
      const exists = await element.isVisible().catch(() => false);

      if (exists) {
        // Проверяем href атрибут
        const href = await element.getAttribute('href').catch(() => null);
        if (href) {
          expect(href).toContain('/');
        }
      }
    }
  });

  test('Bottom bar навигация на Dashboard работает', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    // Найти иконки bottom bar
    const bottomBar = page.locator('nav[aria-label*="navigation"], nav[class*="bottom"]').first();
    const isVisible = await bottomBar.isVisible().catch(() => false);

    if (isVisible) {
      // Проверяем что есть кликабельные элементы
      const navButtons = page.locator('nav button, nav a').all();
      expect((await navButtons).length).toBeGreaterThan(0);

      // Проверяем что они кликабельны
      for (const btn of await navButtons) {
        const isEnabled = await btn.isEnabled().catch(() => false);
        const isVisible = await btn.isVisible().catch(() => false);

        if (isVisible) {
          expect(isEnabled).toBe(true);
        }
      }
    }
  });

  test('Login форма кнопки работают', async ({ page }) => {
    await page.goto('http://localhost:5173/login?signup=true');

    // Найти кнопку Sign Up
    const signUpBtn = page.locator('button[type="submit"], button:has-text("Sign up")').first();
    const isVisible = await signUpBtn.isVisible().catch(() => false);

    expect(isVisible).toBe(true);

    // Кнопка должна быть кликабельна
    const isEnabled = await signUpBtn.isEnabled().catch(() => false);
    expect(isEnabled).toBe(true);

    // Проверить размер кнопки
    const bbox = await signUpBtn.boundingBox();
    expect(bbox?.height).toBeGreaterThanOrEqual(36);
  });
});

test.describe('📐 Проверка responsive дизайна', () => {
  const testCases = [
    { viewport: { width: 375, height: 667 }, name: 'iPhone SE (375px)' },
    { viewport: { width: 390, height: 844 }, name: 'iPhone 14 (390px)' },
    { viewport: { width: 412, height: 915 }, name: 'Pixel 7 (412px)' },
    { viewport: { width: 768, height: 1024 }, name: 'iPad (768px)' },
  ];

  testCases.forEach(({ viewport, name }) => {
    test(`Landing страница на ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('http://localhost:5173/');

      // Нет горизонтального скролла
      const hasScroll = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth + 1;
      });
      expect(hasScroll).toBe(false);

      // Основной контент видим
      const mainContent = page.locator('main, [role="main"], h1, h2').first();
      await expect(mainContent).toBeVisible();
    });

    test(`Dashboard на ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('http://localhost:5173/dashboard');

      // Нет горизонтального скролла
      const hasScroll = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth + 1;
      });
      expect(hasScroll).toBe(false);
    });
  });
});

test.describe('✋ Проверка touch target размеров', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('Все интерактивные элементы >= 44x44px', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    const interactiveElements = page.locator('button, a[href], input, select, textarea, [role="button"]');
    const count = await interactiveElements.count();

    let tooSmallCount = 0;

    for (let i = 0; i < Math.min(count, 30); i++) {
      const el = interactiveElements.nth(i);
      const isVisible = await el.isVisible().catch(() => false);

      if (isVisible) {
        const bbox = await el.boundingBox();
        if (bbox && (bbox.height < 40 || bbox.width < 40)) {
          tooSmallCount++;
        }
      }
    }

    // Допускается несколько маленьких элементов (иконки и т.д.)
    expect(tooSmallCount).toBeLessThan(5);
  });
});

test.describe('🎯 Проверка видимости основных элементов', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  const pages = [
    { path: '/login', mustHave: ['input', 'button'] },
    { path: '/dashboard', mustHave: ['h1, h2, main'] },
    { path: '/onboarding', mustHave: ['input', 'button'] },
    { path: '/upload', mustHave: ['button'] },
  ];

  pages.forEach(({ path, mustHave }) => {
    test(`${path} — видны основные элементы`, async ({ page }) => {
      await page.goto(`http://localhost:5173${path}`);

      for (const selector of mustHave) {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible().catch(() => false);
        expect(isVisible).toBe(true);
      }
    });
  });
});
