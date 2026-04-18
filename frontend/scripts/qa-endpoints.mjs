const API_BASE = (process.env.QA_API_BASE || 'https://api.vitaloop.today').replace(/\/$/, '')

const checks = [
  { path: '/health', method: 'GET', expectStatus: 200 },
  { path: '/health/ready', method: 'GET', expectStatus: 200 },
  { path: '/auth/me', method: 'GET', expectStatus: 401 },
  { path: '/dashboard/summary', method: 'GET', expectStatus: 401 },
  { path: '/stripe/subscription', method: 'GET', expectStatus: 401 },
]

function fail(message) {
  console.error(`QA_FAIL: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const item of checks) {
  const url = `${API_BASE}${item.path}`
  const response = await fetch(url, {
    method: item.method,
    headers: {
      Origin: 'https://vitaloop.today',
      Accept: 'application/json',
    },
  })

  assert(response.status === item.expectStatus, `${item.method} ${item.path}: expected ${item.expectStatus}, got ${response.status}`)

  const acac = response.headers.get('access-control-allow-credentials')
  const vary = response.headers.get('vary') || ''

  assert(acac === 'true', `${item.path}: missing access-control-allow-credentials=true`)
  assert(vary.toLowerCase().includes('origin'), `${item.path}: missing Vary: Origin`)

  console.log(`QA_OK: ${item.method} ${item.path} -> ${response.status}`)
}

console.log('QA_OK: endpoint and CORS checks passed')
