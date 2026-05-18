#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESULTS = {
  timestamp: new Date().toISOString(),
  structure: {},
  pages: [],
  routes: [],
  components: [],
  features: [],
  issues: [],
  missing: [],
  recommendations: []
};

// Read all pages and routes
function auditPages() {
  const pagesDir = path.join(__dirname, 'src/pages');
  const pages = fs.readdirSync(pagesDir);

  pages.forEach(file => {
    if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(path.join(pagesDir, file), 'utf-8');
      RESULTS.pages.push({
        file,
        hasAuth: content.includes('useAuth') || content.includes('requireAuth'),
        hasNavigation: content.includes('useNavigate') || content.includes('Link'),
        hasAPI: content.includes('axios') || content.includes('fetch'),
        hasState: content.includes('useState') || content.includes('useStore'),
        size: content.length
      });
    }
  });
}

// Read router configuration
function auditRoutes() {
  const routerPath = path.join(__dirname, 'src/router.jsx');
  if (fs.existsSync(routerPath)) {
    const content = fs.readFileSync(routerPath, 'utf-8');
    const routeMatches = content.match(/path:\s*["'`]([^"'`]+)["'`]/g) || [];
    routeMatches.forEach(match => {
      const route = match.replace(/path:\s*["'`]|["'`]/g, '');
      RESULTS.routes.push(route);
    });
  }
}

// Audit components
function auditComponents() {
  const componentsDir = path.join(__dirname, 'src/components');

  function readComponents(dir, prefix = '') {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        readComponents(filePath, prefix + file + '/');
      } else if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
        RESULTS.components.push(prefix + file);
      }
    });
  }

  if (fs.existsSync(componentsDir)) {
    readComponents(componentsDir);
  }
}

// Audit features
function auditFeatures() {
  const srcDir = path.join(__dirname, 'src');
  const content = fs.readFileSync(path.join(__dirname, 'src/App.jsx'), 'utf-8');

  // Check for major features
  const features = [
    { name: 'Authentication', regex: /useAuth|AuthProvider|auth/ },
    { name: 'Dashboard', regex: /Dashboard|dashboard/ },
    { name: 'File Upload', regex: /Upload|upload|dropzone/ },
    { name: 'Results Display', regex: /Results|results|biomarkers/ },
    { name: 'Protocol Generation', regex: /Protocol|protocol/ },
    { name: 'User Profile', regex: /Profile|profile|cabinet/ },
    { name: 'Payments', regex: /stripe|payment|premium/ },
    { name: 'Notifications', regex: /toast|notification|alert/ },
  ];

  features.forEach(feature => {
    const found = feature.regex.test(content);
    RESULTS.features.push({
      name: feature.name,
      implemented: found
    });
  });
}

// Check for common issues
function checkCommonIssues() {
  const srcDir = path.join(__dirname, 'src');

  function checkFile(file) {
    const content = fs.readFileSync(file, 'utf-8');

    // Check for console.log in production
    if (content.includes('console.log')) {
      RESULTS.issues.push(`Debug logs found in ${file.replace(srcDir, '')}`);
    }

    // Check for deprecated React patterns
    if (content.includes('componentWillMount') || content.includes('componentWillReceiveProps')) {
      RESULTS.issues.push(`Deprecated React lifecycle in ${file.replace(srcDir, '')}`);
    }

    // Check for missing keys in lists
    if (content.match(/\.map\([^)]*\)\s*=>\s*[(<]/)) {
      if (!content.includes('key=')) {
        RESULTS.issues.push(`Potential missing key prop in ${file.replace(srcDir, '')}`);
      }
    }
  }

  function walkDir(dir) {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath);
      } else if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
        try {
          checkFile(filePath);
        } catch (e) {
          // Ignore
        }
      }
    });
  }

  walkDir(srcDir);
}

// Detect missing features
function checkMissingFeatures() {
  const pagesDir = path.join(__dirname, 'src/pages');
  const pages = fs.readdirSync(pagesDir);

  const expectedPages = [
    'Login',
    'Dashboard',
    'Upload',
    'Results',
    'Cabinet',
    'Profile'
  ];

  expectedPages.forEach(page => {
    const exists = pages.some(f => f.toLowerCase().includes(page.toLowerCase()));
    if (!exists) {
      RESULTS.missing.push(`${page} page not found`);
    }
  });
}

// Generate recommendations
function generateRecommendations() {
  if (RESULTS.pages.length < 5) {
    RESULTS.recommendations.push('Add more page templates for different user flows');
  }

  if (RESULTS.issues.length > 0) {
    RESULTS.recommendations.push('Clean up debug code and fix deprecated patterns');
  }

  RESULTS.recommendations.push('Ensure all routes have proper authentication guards');
  RESULTS.recommendations.push('Add loading states to all async operations');
  RESULTS.recommendations.push('Implement error boundaries for crash handling');
  RESULTS.recommendations.push('Add proper logging for analytics');
}

// Main audit
console.log('🔍 Starting Cabinet Audit...\n');

auditPages();
auditRoutes();
auditComponents();
auditFeatures();
checkCommonIssues();
checkMissingFeatures();
generateRecommendations();

console.log('📊 AUDIT RESULTS\n');
console.log('='.repeat(60));
console.log(`Pages found: ${RESULTS.pages.length}`);
console.log(`Routes found: ${RESULTS.routes.length}`);
console.log(`Components: ${RESULTS.components.length}`);
console.log('='.repeat(60));

console.log('\n📄 Pages:\n');
RESULTS.pages.forEach(page => {
  console.log(`  ✓ ${page.file}`);
  if (page.hasAuth) console.log('    - Has authentication');
  if (page.hasAPI) console.log('    - Makes API calls');
  if (page.hasState) console.log('    - Has state management');
});

console.log('\n🗺️  Routes:\n');
RESULTS.routes.forEach(route => {
  console.log(`  ✓ ${route}`);
});

console.log('\n⚙️  Features:\n');
RESULTS.features.forEach(feature => {
  console.log(`  ${feature.implemented ? '✓' : '✗'} ${feature.name}`);
});

if (RESULTS.issues.length > 0) {
  console.log('\n⚠️  Issues Found:\n');
  RESULTS.issues.forEach(issue => {
    console.log(`  ⚠ ${issue}`);
  });
}

if (RESULTS.missing.length > 0) {
  console.log('\n❌ Missing Features:\n');
  RESULTS.missing.forEach(missing => {
    console.log(`  ✗ ${missing}`);
  });
}

console.log('\n💡 Recommendations:\n');
RESULTS.recommendations.forEach((rec, i) => {
  console.log(`  ${i + 1}. ${rec}`);
});

// Save detailed report
const reportPath = path.join(__dirname, 'CABINET_AUDIT_REPORT.json');
fs.writeFileSync(reportPath, JSON.stringify(RESULTS, null, 2));
console.log(`\n✅ Detailed report saved to: ${reportPath}\n`);
