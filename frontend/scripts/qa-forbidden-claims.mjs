/**
 * P13 Trust & Claims guard (docs/TRUST_AND_CLAIMS_GUIDELINES.md §2/§7).
 *
 * Scans user-facing frontend source for phrases that overclaim medical
 * certainty or regulatory status VITALOOP does not have. This is the CI
 * enforcement §7 of the guidelines flagged as a known gap — a phrase list
 * check, not a full compliance review, but it turns the checklist into
 * something that actually fails a build instead of relying on someone
 * remembering to re-read the guidelines before shipping new copy.
 *
 * Deliberately scoped to src/pages and src/components (user-facing copy) —
 * NOT src/lib, tests, or scripts, where "diagnose"/"treatment" can appear
 * in code comments or non-clinical contexts (e.g. UI-layout A/B language)
 * without meaning anything medical.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const scanDirs = ['src/pages', 'src/components'].map((dir) => path.join(root, dir))

// Each entry: a forbidden phrase, matched case-insensitively, with
// optional safe context that neutralizes it (so "does not diagnose" or
// "not a treatment" stay allowed — the guidelines exist to ban asserting
// these as fact, not to ban discussing the boundary itself).
const FORBIDDEN_PATTERNS = [
  { phrase: /confirmed diagnosis/i },
  { phrase: /diagnosis confirmed/i },
  { phrase: /fda[-\s]?(cleared|approved)/i },
  { phrase: /clinically proven to cure/i },
  { phrase: /guaranteed to (work|cure|heal)/i },
  { phrase: /replaces your doctor/i, safeIfNearby: /(does not|isn't|is not|won't|will not|never)/i },
]

function fail(message) {
  console.error(`QA_FAIL: ${message}`)
  process.exit(1)
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
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

const violations = []

for (const dir of scanDirs) {
  for (const file of walk(dir)) {
    const content = fs.readFileSync(file, 'utf8')
    const relPath = path.relative(root, file)
    for (const { phrase, safeIfNearby } of FORBIDDEN_PATTERNS) {
      const match = content.match(phrase)
      if (!match) continue
      const index = match.index ?? 0
      const windowStart = Math.max(0, index - 60)
      const windowEnd = Math.min(content.length, index + match[0].length + 60)
      const surrounding = content.slice(windowStart, windowEnd)
      if (safeIfNearby && safeIfNearby.test(surrounding)) continue
      const lineNumber = content.slice(0, index).split('\n').length
      violations.push(`${relPath}:${lineNumber} — forbidden phrase "${match[0]}"`)
    }
  }
}

if (violations.length) {
  fail(`Found ${violations.length} forbidden-claim violation(s):\n${violations.join('\n')}\n\nSee docs/TRUST_AND_CLAIMS_GUIDELINES.md §2.`)
}

console.log('QA_OK: no forbidden medical/regulatory claims found in src/pages or src/components.')
