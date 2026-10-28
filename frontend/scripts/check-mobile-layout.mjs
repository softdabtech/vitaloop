#!/usr/bin/env node

import http from 'http';
import { parse } from 'url';

const BASE_URL = 'http://localhost:5173';

const PAGES_TO_CHECK = [
  { path: '/', name: 'Landing' },
  { path: '/login', name: 'Login' },
  { path: '/login?signup=true', name: 'Sign Up' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/onboarding', name: 'Onboarding' },
  { path: '/upload', name: 'Upload' },
  { path: '/settings', name: 'Settings' },
  { path: '/lab-results', name: 'Lab Results' },
];

console.log('🎨 БЫСТРАЯ ПРОВЕРКА ВЁРСТКИ НА МОБИЛЬНОЙ ВЕРСИИ\n');
console.log('=' .repeat(70) + '\n');

const results = [];
let completed = 0;

function checkPage(page) {
  const url = BASE_URL + page.path;

  http.get(url, { timeout: 5000 }, (res) => {
    let html = '';
    res.on('data', chunk => { html += chunk; });
    res.on('end', () => {
      const checks = {
        hasButtons: html.includes('<button'),
        hasInputs: html.includes('<input'),
        hasLinks: html.includes('<a'),
        hasNav: html.includes('<nav') || html.includes('navigation'),
        has100vw: html.includes('100vw') || html.includes('100%') && html.includes('overflow'),
        hasMainContent: html.includes('<main') || html.includes('[role="main"]'),
      };

      results.push({
        path: page.path,
        name: page.name,
        status: res.statusCode,
        ok: res.statusCode === 200,
        checks,
      });

      completed++;
      if (completed === PAGES_TO_CHECK.length) {
        printResults();
      }
    });
  }).on('error', (err) => {
    results.push({
      path: page.path,
      name: page.name,
      status: 'ERROR',
      ok: false,
      error: err.message,
    });

    completed++;
    if (completed === PAGES_TO_CHECK.length) {
      printResults();
    }
  });
}

function printResults() {
  console.log('📱 РЕЗУЛЬТАТЫ ПРОВЕРКИ ВЁРСТКИ\n');

  const passed = results.filter(r => r.ok).length;

  results.forEach(r => {
    const symbol = r.ok ? '✅' : '❌';
    const status = r.error ? `ERROR: ${r.error}` : `HTTP ${r.status}`;
    console.log(`${symbol} ${r.name.padEnd(20)} ${r.path.padEnd(25)} ${status}`);

    if (r.ok && r.checks) {
      const checks = r.checks;
      const findings = [];

      if (checks.hasButtons) findings.push('buttons');
      if (checks.hasInputs) findings.push('inputs');
      if (checks.hasLinks) findings.push('links');
      if (checks.hasNav) findings.push('nav');
      if (checks.has100vw) findings.push('⚠️  100vw (может быть горизонтальный скролл!)');

      if (findings.length > 0) {
        console.log(`   └─ Найдено: ${findings.join(', ')}`);
      }
    }
  });

  console.log('\n' + '=' .repeat(70));

  console.log(`\n📊 ИТОГО: ${passed}/${results.length} страниц загруженo\n`);

  // Warnings
  const pagesWith100vw = results.filter(r => r.checks?.has100vw);
  if (pagesWith100vw.length > 0) {
    console.log('⚠️  ВНИМАНИЕ: Страницы с потенциальным горизонтальным скроллом:');
    pagesWith100vw.forEach(r => {
      console.log(`   - ${r.name} (${r.path})`);
    });
    console.log('\nРекомендация: Проверить CSS, убедиться что контейнеры не шире чем viewport\n');
  }

  console.log('🎯 ЧТО ПРОВЕРИТЬ ВРУЧНУЮ:');
  console.log(`   1. Откройте http://localhost:5173 в браузере мобильной версии`);
  console.log(`   2. Поворачивайте экран между портретом и ландшафтом`);
  console.log(`   3. Убедитесь что:
      ✓ Нет горизонтального скролла
      ✓ Кнопки не "плывут" при rotate
      ✓ Все элементы видны полностью
      ✓ Текст в кнопках не обрезан
      ✓ Input поля полностью видны`);

  console.log('\n📋 Детальный чеклист: MOBILE_LAYOUT_VERIFICATION.md\n');
}

PAGES_TO_CHECK.forEach(page => checkPage(page));
