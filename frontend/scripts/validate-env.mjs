import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const mode = process.env.MODE || process.env.NODE_ENV || 'production'

const requiredKeys = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_BASE_URL',
]

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const content = fs.readFileSync(filePath, 'utf8')
  const out = {}

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq <= 0) continue

    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    out[key] = value
  }

  return out
}

const envBase = parseEnvFile(path.join(root, '.env'))
const envMode = parseEnvFile(path.join(root, `.env.${mode}`))
const merged = {
  ...envBase,
  ...envMode,
  ...process.env,
}

const missing = requiredKeys.filter((key) => !String(merged[key] || '').trim())

if (missing.length > 0) {
  console.error('Missing required frontend env variables:')
  for (const key of missing) {
    console.error(`- ${key}`)
  }
  process.exit(1)
}

console.log(`Environment validation passed for mode: ${mode}`)
