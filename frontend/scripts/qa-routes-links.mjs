import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const appPath = path.join(root, 'src', 'App.jsx')
const settingsPath = path.join(root, 'src', 'pages', 'Settings.jsx')
const adminShellPath = path.join(root, 'src', 'components', 'admin', 'AdminShell.jsx')
const landingPath = path.join(root, 'src', 'pages', 'Landing.jsx')

function fail(message) {
  console.error(`QA_FAIL: ${message}`)
  process.exit(1)
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing file: ${filePath}`)
  return fs.readFileSync(filePath, 'utf8')
}

function assert(condition, message) {
  if (!condition) fail(message)
}

const app = read(appPath)
const settings = read(settingsPath)
const adminShell = read(adminShellPath)
const landing = read(landingPath)

const routeRegex = /<Route\s+path="([^"]+)"/g
const routePaths = new Set()
for (const match of app.matchAll(routeRegex)) {
  routePaths.add(match[1])
}

const requiredRoutes = [
  '/',
  '/login',
  '/dashboard',
  '/settings',
  '/ops',
  '/crm/programs',
  '/crm/clients',
  '/crm/practitioners',
  '/crm/activity',
  '/onboarding',
  '/questionnaire',
  '/check-ins',
  '/insights',
  '/404.html',
  '*',
]

for (const route of requiredRoutes) {
  assert(routePaths.has(route), `Missing required route: ${route}`)
}

assert(app.includes('path="/checkin" element={<Navigate to="/check-ins" replace />}'), 'Legacy redirect /checkin -> /check-ins missing')
assert(app.includes('path="/timeline" element={<Navigate to="/insights" replace />}'), 'Legacy redirect /timeline -> /insights missing')

const hasReminderCheckboxes = (settings.match(/type="checkbox"/g) || []).length
assert(hasReminderCheckboxes >= 1, 'Expected checkbox input in Settings reminders section')
assert(settings.includes("weekly_digest") && settings.includes("checkin_reminders") && settings.includes("product_updates"), 'Missing reminder keys in Settings')
assert(settings.includes('Weekly digest') && settings.includes('Check-in email') && settings.includes('Product updates'), 'Missing reminder labels in Settings')

const navToRegex = /to:\s*'([^']+)'/g
const adminTargets = [...adminShell.matchAll(navToRegex)].map((m) => m[1])
for (const target of adminTargets) {
  const route = target.split('?')[0]
  const knownRoute = routePaths.has(route) || ['\/admin', '/dashboard', '/settings', '/ops'].includes(route)
  assert(knownRoute, `Admin nav target has no matching route: ${target}`)
}

assert(!landing.includes("title: 'Health Avatar'"), 'Landing still contains Health Avatar mockup card')

console.log('QA_OK: routes, links, checkboxes validated')
