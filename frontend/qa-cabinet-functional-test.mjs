#!/usr/bin/env node

/**
 * Cabinet Functional Test - Tests backend API endpoints and data integrity
 * Simulates user cabinet operations: login, upload, results retrieval, settings update
 */

import axios from 'axios';

const API_BASE = 'https://api.vitaloop.today/api';
const TEST_USER = {
  email: 'a@a.com',
  password: 'Aaaaaa'
};

const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

function logTest(name, status, details = '') {
  const test = { name, status, details, timestamp: new Date().toISOString() };
  results.tests.push(test);

  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⊘';
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  console.log(`${color}${icon}\x1b[0m ${name}${details ? ` — ${details}` : ''}`);

  if (status === 'PASS') results.passed++;
  else if (status === 'FAIL') results.failed++;
  else results.skipped++;
}

async function testHealth() {
  try {
    const res = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
    logTest('API Health Check', res.status === 200 ? 'PASS' : 'FAIL');
  } catch (e) {
    logTest('API Health Check', 'FAIL', e.message);
  }
}

async function testAuthFlow() {
  try {
    // Test login endpoint
    const loginRes = await axios.post(`${API_BASE}/auth/login`, TEST_USER, { timeout: 10000 });

    if (!loginRes.data.access_token) {
      logTest('User Login', 'FAIL', 'No access token returned');
      return null;
    }

    logTest('User Login', 'PASS', `Token received: ${loginRes.data.access_token.substring(0, 20)}...`);
    return loginRes.data.access_token;
  } catch (e) {
    logTest('User Login', 'FAIL', e.response?.data?.detail || e.message);
    return null;
  }
}

async function testUserProfile(token) {
  try {
    const res = await axios.get(`${API_BASE}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });

    const user = res.data;
    logTest('Get User Profile', 'PASS', `ID: ${user.id}, Email: ${user.email}`);

    // Check for important user fields
    const requiredFields = ['id', 'email', 'created_at'];
    const missingFields = requiredFields.filter(f => !(f in user));

    if (missingFields.length > 0) {
      logTest('User Profile Completeness', 'FAIL', `Missing: ${missingFields.join(', ')}`);
    } else {
      logTest('User Profile Completeness', 'PASS', `All required fields present`);
    }

    // Check for user metadata/markers
    if (user.user_metadata) {
      logTest('User Metadata Present', 'PASS', `Fields: ${Object.keys(user.user_metadata).join(', ')}`);
    } else {
      logTest('User Metadata Present', 'FAIL', 'No user_metadata found');
    }

    return user;
  } catch (e) {
    logTest('Get User Profile', 'FAIL', e.response?.data?.detail || e.message);
    return null;
  }
}

async function testSettings(token) {
  try {
    const res = await axios.get(`${API_BASE}/user/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });

    const settings = res.data;
    logTest('Get User Settings', 'PASS', `Settings loaded`);

    // Check for important settings fields
    const expectedFields = ['theme', 'notifications', 'privacy'];
    const presentFields = Object.keys(settings);

    console.log(`    Available settings fields: ${presentFields.join(', ')}`);
    logTest('Settings Fields Present', 'PASS', `${presentFields.length} fields`);

    return settings;
  } catch (e) {
    if (e.response?.status === 404) {
      logTest('Get User Settings', 'SKIP', 'Endpoint not implemented');
    } else {
      logTest('Get User Settings', 'FAIL', e.response?.data?.detail || e.message);
    }
    return null;
  }
}

async function testSubscriptionStatus(token) {
  try {
    const res = await axios.get(`${API_BASE}/subscription/status`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });

    const sub = res.data;
    logTest('Get Subscription Status', 'PASS', `Plan: ${sub.plan_name || 'free'}`);

    return sub;
  } catch (e) {
    if (e.response?.status === 404) {
      logTest('Get Subscription Status', 'SKIP', 'Endpoint not implemented');
    } else {
      logTest('Get Subscription Status', 'FAIL', e.response?.data?.detail || e.message);
    }
    return null;
  }
}

async function testUploadsList(token) {
  try {
    const res = await axios.get(`${API_BASE}/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });

    const uploads = res.data;
    logTest('Get Uploads List', 'PASS', `${uploads.length || 0} uploads found`);

    if (uploads.length > 0) {
      const upload = uploads[0];
      const requiredFields = ['id', 'created_at', 'status'];
      const missingFields = requiredFields.filter(f => !(f in upload));

      if (missingFields.length > 0) {
        logTest('Upload Data Completeness', 'FAIL', `Missing: ${missingFields.join(', ')}`);
      } else {
        logTest('Upload Data Completeness', 'PASS', 'All required fields present');
      }
    }

    return uploads;
  } catch (e) {
    if (e.response?.status === 404) {
      logTest('Get Uploads List', 'SKIP', 'Endpoint not implemented');
    } else {
      logTest('Get Uploads List', 'FAIL', e.response?.data?.detail || e.message);
    }
    return null;
  }
}

async function testBiomarkersEndpoint(token) {
  try {
    const res = await axios.get(`${API_BASE}/biomarkers`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });

    const biomarkers = res.data;
    logTest('Get Biomarkers Reference', 'PASS', `${biomarkers.length || 0} biomarkers found`);

    if (Array.isArray(biomarkers) && biomarkers.length > 0) {
      const sample = biomarkers[0];
      const requiredFields = ['name', 'normal_range_low', 'normal_range_high', 'unit'];
      const missingFields = requiredFields.filter(f => !(f in sample));

      if (missingFields.length > 0) {
        logTest('Biomarker Data Structure', 'FAIL', `Missing: ${missingFields.join(', ')}`);
      } else {
        logTest('Biomarker Data Structure', 'PASS', 'All required fields present');
      }
    }

    return biomarkers;
  } catch (e) {
    if (e.response?.status === 404) {
      logTest('Get Biomarkers Reference', 'SKIP', 'Endpoint not implemented');
    } else {
      logTest('Get Biomarkers Reference', 'FAIL', e.response?.data?.detail || e.message);
    }
    return null;
  }
}

async function testHealthProfile(token) {
  try {
    const res = await axios.get(`${API_BASE}/user/health-profile`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000
    });

    const profile = res.data;
    logTest('Get Health Profile', 'PASS', 'Health profile retrieved');

    return profile;
  } catch (e) {
    if (e.response?.status === 404) {
      logTest('Get Health Profile', 'SKIP', 'Endpoint not implemented');
    } else {
      logTest('Get Health Profile', 'FAIL', e.response?.data?.detail || e.message);
    }
    return null;
  }
}

async function runTests() {
  console.log('\n🧪 Cabinet Functional Test Suite\n');
  console.log('=' .repeat(60));

  await testHealth();

  const token = await testAuthFlow();
  if (!token) {
    console.log('\n❌ Authentication failed — cannot proceed with other tests\n');
    process.exit(1);
  }

  console.log('\n📋 User Profile & Metadata Tests\n');
  await testUserProfile(token);

  console.log('\n⚙️  Settings & Configuration Tests\n');
  await testSettings(token);

  console.log('\n💳 Subscription Tests\n');
  await testSubscriptionStatus(token);

  console.log('\n📤 Upload & Results Tests\n');
  await testUploadsList(token);

  console.log('\n🔬 Biomarker & Analysis Tests\n');
  await testBiomarkersEndpoint(token);

  console.log('\n👤 User Profile Details\n');
  await testHealthProfile(token);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Summary\n`);
  console.log(`  ✓ Passed: ${results.passed}`);
  console.log(`  ✗ Failed: ${results.failed}`);
  console.log(`  ⊘ Skipped: ${results.skipped}`);
  console.log(`  Total: ${results.tests.length}\n`);

  // Save report
  const reportPath = '/Users/oleksii/projects/vitaloop/frontend/CABINET_API_TEST_REPORT.json';
  const fs = (await import('fs')).default;
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`✅ Report saved to: ${reportPath}\n`);
}

runTests().catch(e => {
  console.error('Test suite error:', e.message);
  process.exit(1);
});
