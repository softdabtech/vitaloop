#!/usr/bin/env node

import http from 'http';

const BASE_URL = 'http://localhost:5173';

const PAGES_TO_CHECK = [
  { path: '/login', name: 'Login Page', requiredElements: ['<input', '<button', 'form'] },
  { path: '/login?signup=true', name: 'Sign Up Page', requiredElements: ['<input', '<button', 'form'] },
  { path: '/auth/confirmation', name: 'Email Confirmation', requiredElements: ['<button', 'email'] },
  { path: '/onboarding', name: 'Onboarding', requiredElements: ['<input', '<button', 'Onboarding'] },
  { path: '/dashboard', name: 'Dashboard', requiredElements: ['Dashboard', '<button', 'nav'] },
  { path: '/upload', name: 'Upload Page', requiredElements: ['<button', '<input', 'Upload'] },
  { path: '/settings', name: 'Settings', requiredElements: ['<input', '<button', 'Settings'] },
];

console.log('🔍 Проверка флоу регистрации на мобильной версии\n');
console.log('='.repeat(60) + '\n');

let completed = 0;
const results = [];

function checkPage(page) {
  const url = BASE_URL + page.path;

  http.get(url, { timeout: 5000 }, (res) => {
    let html = '';
    res.on('data', chunk => { html += chunk; });
    res.on('end', () => {
      const status = res.statusCode;
      const hasError = html.includes('404') || html.includes('error') || status >= 400;

      const hasElements = page.requiredElements.every(el => {
        if (el === 'text') return html.length > 100;
        // Check for presence in HTML or data attributes (React compiled code)
        return html.includes(el) || html.includes(el.split('[')[0]);
      });

      results.push({
        path: page.path,
        name: page.name,
        status: status,
        ok: status === 200 && !hasError && hasElements,
        hasError,
        hasElements,
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
  const passed = results.filter(r => r.ok).length;
  const total = results.length;

  console.log('📱 РЕЗУЛЬТАТЫ ПРОВЕРКИ ФЛОУ РЕГИСТРАЦИИ\n');

  results.forEach(r => {
    const symbol = r.ok ? '✅' : '❌';
    const status = r.error ? `ERROR: ${r.error}` : `HTTP ${r.status}`;
    const details = r.ok ? '' : (r.hasError ? '(has error)' : !r.hasElements ? '(missing elements)' : '');
    console.log(`${symbol} ${r.name.padEnd(25)} ${r.path.padEnd(25)} ${details}`.trim());
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 ИТОГО: ${passed}/${total} страниц работают корректно\n`);

  const flowSteps = [
    { name: 'Sign Up', required: ['/login?signup=true'] },
    { name: 'Email Confirmation', required: ['/auth/confirmation'] },
    { name: 'Onboarding', required: ['/onboarding'] },
    { name: 'Dashboard', required: ['/dashboard'] },
  ];

  console.log('🔄 ПРОВЕРКА ОСНОВНЫХ ЭТАПОВ ФЛОУ:\n');

  flowSteps.forEach(step => {
    const stepOk = step.required.every(path =>
      results.find(r => r.path === path)?.ok
    );
    const symbol = stepOk ? '✅' : '⚠️ ';
    console.log(`${symbol} ${step.name}`);
  });

  console.log('\n');

  if (passed === total) {
    console.log('✨ ВСЕ СТРАНИЦЫ ФЛОУ РЕГИСТРАЦИИ РАБОТАЮТ!\n');
  } else {
    console.log(`⚠️  ${total - passed} страниц нуждаются в проверке\n`);
  }
}

PAGES_TO_CHECK.forEach(page => checkPage(page));
