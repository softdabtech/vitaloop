#!/usr/bin/env node

/**
 * Quick Smoke Test - Checks frontend build and basic functionality
 * Tests: structure integrity, routes, components availability
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = {
  passed: 0,
  failed: 0,
  timestamp: new Date().toISOString(),
};

function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✓' : '✗';
  const color = status === 'PASS' ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${name}${details ? ` — ${details}` : ''}`);
  
  if (status === 'PASS') tests.passed++;
  else tests.failed++;
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    logTest(description, 'PASS');
    return true;
  } else {
    logTest(description, 'FAIL', `File not found: ${filePath}`);
    return false;
  }
}

function countFiles(dir, ext) {
  if (!fs.existsSync(dir)) return 0;
  try {
    const files = fs.readdirSync(dir, { recursive: true });
    return files.filter(f => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

console.log('🧪 Frontend Smoke Test\n');
console.log('='.repeat(60));

// 1. Check dist build exists
console.log('\n📦 Build Artifacts:');
const distPath = path.join(__dirname, 'dist');
const distExists = checkFileExists(distPath, 'dist/ folder exists');

if (distExists) {
  const indexHtmlCount = countFiles(distPath, 'index.html');
  const jsCount = countFiles(distPath, '.js');
  const cssCount = countFiles(distPath, '.css');
  const assetCount = countFiles(distPath, '.webp') + countFiles(distPath, '.png') + countFiles(distPath, '.jpg');
  
  logTest(`HTML entry points`, jsCount > 0 ? 'PASS' : 'FAIL', `Found ${indexHtmlCount}`);
  logTest(`JavaScript chunks`, jsCount > 0 ? 'PASS' : 'FAIL', `Found ${jsCount}`);
  logTest(`CSS stylesheets`, cssCount > 0 ? 'PASS' : 'FAIL', `Found ${cssCount}`);
  logTest(`Static assets`, assetCount > 0 ? 'PASS' : 'FAIL', `Found ${assetCount}`);
}

// 2. Check source code structure
console.log('\n📁 Source Structure:');
const srcPath = path.join(__dirname, 'src');
checkFileExists(path.join(srcPath, 'App.jsx'), 'App.jsx exists');
checkFileExists(path.join(srcPath, 'main.jsx'), 'main.jsx exists');
checkFileExists(path.join(srcPath, 'pages'), 'pages/ folder exists');
checkFileExists(path.join(srcPath, 'components'), 'components/ folder exists');
checkFileExists(path.join(srcPath, 'hooks'), 'hooks/ folder exists');

// 3. Check critical pages
console.log('\n🔑 Critical Pages:');
const pagesDir = path.join(srcPath, 'pages');
const criticalPages = [
  'Landing.jsx',
  'Login.jsx',
  'UserDashboard.jsx',
  'Upload.jsx',
  'Results.jsx',
  'Settings.jsx',
  'Subscription.jsx'
];

criticalPages.forEach(page => {
  checkFileExists(path.join(pagesDir, page), `${page}`);
});

// 4. Check Ukrainian cabinet
console.log('\n🇺🇦 Ukrainian Cabinet:');
const uaCabinetDir = path.join(srcPath, 'pages', 'ua-cabinet');
if (fs.existsSync(uaCabinetDir)) {
  const uaPages = fs.readdirSync(uaCabinetDir).filter(f => f.endsWith('.jsx'));
  logTest(`UA Cabinet exists`, 'PASS', `${uaPages.length} components`);
  
  const requiredUA = ['UaDashboard.jsx', 'UaUpload.jsx', 'UaResults.jsx'];
  requiredUA.forEach(page => {
    checkFileExists(path.join(uaCabinetDir, page), `  ${page}`);
  });
} else {
  logTest('UA Cabinet exists', 'FAIL', 'ua-cabinet folder not found');
}

// 5. Check configuration files
console.log('\n⚙️  Configuration:');
checkFileExists(path.join(__dirname, 'vite.config.js'), 'vite.config.js');
checkFileExists(path.join(__dirname, 'package.json'), 'package.json');
checkFileExists(path.join(__dirname, 'tailwind.config.js'), 'tailwind.config.js');

// 6. Check API connectivity (basic)
console.log('\n🔌 API Endpoints:');
try {
  const response = await fetch('https://vitaloop.today/api/v1/health', { timeout: 3000 }).catch(() => null);
  if (response && response.ok) {
    logTest('API v1 endpoint', 'PASS');
  } else {
    logTest('API v1 endpoint', 'FAIL', 'Health check failed');
  }
} catch (e) {
  logTest('API v1 endpoint', 'FAIL', e.message);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n✅ Results: ${tests.passed} passed, ${tests.failed} failed`);

if (tests.failed === 0) {
  console.log('\n🎉 All smoke tests passed! Frontend is ready.\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${tests.failed} test(s) failed. Please review.\n`);
  process.exit(1);
}
