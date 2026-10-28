import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const srcRoot = path.join(root, 'src')
const appPath = path.join(srcRoot, 'App.jsx')

function fail(message) {
  console.error(`QA_FAIL: ${message}`)
  process.exit(1)
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing file: ${filePath}`)
  return fs.readFileSync(filePath, 'utf8')
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, out)
      continue
    }
    if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(fullPath)
  }
  return out
}

function routeToRegex(route) {
  if (route === '*') return /^.*$/
  const escaped = route
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\:([A-Za-z_][A-Za-z0-9_]*)/g, '[^/]+')
  return new RegExp(`^${escaped}$`)
}

const app = read(appPath)
const routeRegex = /<Route\s+path="([^"]+)"/g
const routes = []
for (const match of app.matchAll(routeRegex)) {
  routes.push(match[1])
}

const files = walk(srcRoot)
const idSet = new Set()
for (const filePath of files) {
  const content = read(filePath)
  for (const match of content.matchAll(/id=(?:"([^"]+)"|'([^']+)')/g)) {
    idSet.add(match[1] || match[2])
  }
}

const refPatterns = [
  /navigate\(\s*['"]([^'"]+)['"]/g,
  /\bto=\s*['"]([^'"]+)['"]/g,
  /\bhref=\s*['"]([^'"]+)['"]/g,
  /\broute:\s*['"]([^'"]+)['"]/g,
  /\bto=\{`([^`]+)`\}/g,
  /\bhref=\{`([^`]+)`\}/g,
]

const refs = []
for (const filePath of files) {
  const content = read(filePath)
  const relFile = path.relative(root, filePath)
  for (const pattern of refPatterns) {
    for (const match of content.matchAll(pattern)) {
      const value = match[1]
      if (!value) continue
      refs.push({ file: relFile, value })
    }
  }
}

const routeMatchers = routes.map((route) => ({ route, regex: routeToRegex(route) }))
const invalidRoutes = []
const invalidHashes = []

for (const ref of refs) {
  const value = ref.value

  // Ignore external links and non-path anchors.
  if (/^(https?:|mailto:|tel:|#)/.test(value)) continue
  if (!value.startsWith('/')) continue

  const [pathPart, hashPart] = value.split('#')
  const cleanPath = pathPart
    .split('?')[0]
    .replace(/\$\{[^}]+\}/g, 'x')

  const hasRouteMatch = routeMatchers.some(({ regex }) => regex.test(cleanPath))
  if (!hasRouteMatch) {
    invalidRoutes.push(ref)
  }

  if (hashPart && !/\$\{[^}]+\}/.test(hashPart) && !idSet.has(hashPart)) {
    invalidHashes.push(ref)
  }
}

if (invalidRoutes.length || invalidHashes.length) {
  if (invalidRoutes.length) {
    console.error('Invalid route references found:')
    for (const item of invalidRoutes.slice(0, 100)) {
      console.error(`- ${item.file} -> ${item.value}`)
    }
  }

  if (invalidHashes.length) {
    console.error('Invalid hash anchors found:')
    for (const item of invalidHashes.slice(0, 100)) {
      console.error(`- ${item.file} -> ${item.value}`)
    }
  }

  fail(`Found ${invalidRoutes.length} invalid route refs and ${invalidHashes.length} invalid hash refs`)
}

console.log(`QA_OK: strict links validated (routes=${routes.length}, refs=${refs.length}, ids=${idSet.size})`)
