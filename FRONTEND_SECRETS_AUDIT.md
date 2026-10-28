# Frontend Secrets Audit Report
**Date:** September 7, 2026  
**Status:** AUDIT PLAN  
**Objective:** Verify frontend doesn't contain hardcoded secrets

---

## CRITICAL RULE

🔴 **NEVER expose in frontend:**
- Service role keys (only anon key allowed)
- API keys for backend services
- Database passwords
- JWT secrets
- Private keys

✅ **OK to expose in frontend:**
- Supabase anon key (public, read-only)
- Supabase URL
- OpenAI model name (not the key)
- Public configuration

---

## WHAT TO AUDIT

### 1. Environment Variables

**Files to check:**
```
frontend/.env
frontend/.env.local
frontend/.env.production
frontend/src/config.js
frontend/src/constants.js
frontend/vite.config.js
```

**What we're looking for:**
```bash
# BAD - Should NOT be in frontend:
VITE_OPENAI_API_KEY=sk-proj-xxxxx
VITE_SUPABASE_SERVICE_KEY=eyJhbGc...
VITE_DATABASE_PASSWORD=xxxxx
VITE_JWT_SECRET=xxxxx

# GOOD - OK to be in frontend:
VITE_SUPABASE_URL=https://bfjxkzydonhwmafnyktt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc... (anon key only)
VITE_API_BASE_URL=https://api.vitaloop.today
VITE_LLM_MODEL=gpt-4o
```

### 2. Supabase Client Initialization

**File:** `frontend/src/lib/supabase.js`

**Check:**
```javascript
// BAD ❌
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  'https://...',
  'SERVICE_ROLE_KEY'  // ❌ WRONG - should be anon key
)

// GOOD ✅
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY  // ✅ CORRECT
)
```

### 3. Git History

**Risk:** Secret accidentally committed, then removed

**Check:**
```bash
# Search git history for secrets
git log -p -S "sk_" -- frontend/
git log -p -S "sk-proj-" -- frontend/
git log -p -S "SERVICE_ROLE" -- frontend/

# If found: Use git-filter-branch to remove
```

### 4. Build Artifacts

**Risk:** Secrets in compiled bundles

**Check:**
```bash
# Check built files for secrets
grep -r "sk_" frontend/dist/
grep -r "sk-proj-" frontend/dist/
grep -r "SERVICE_ROLE" frontend/dist/
grep -r "password" frontend/dist/
```

### 5. node_modules

**Risk:** Dependencies contain secrets in their code

**Check:**
```bash
# Audit dependencies
npm audit
npm list # Check for vulnerable versions

# Search node_modules for hardcoded API keys
grep -r "sk_" node_modules/ | head -5
# (Most dependencies shouldn't have real keys)
```

### 6. Source Code Comments

**Risk:** Secrets mentioned in code comments

**Check:**
```bash
# Search for references to secrets
grep -r "api.*key\|secret\|password" frontend/src/ | \
  grep -v "Mock\|TODO\|example"
```

---

## AUDIT CHECKLIST

### Environment Configuration
- [ ] `.env` file checked for secrets
- [ ] `.env.local` doesn't exist in git
- [ ] `.env.production` doesn't contain real secrets
- [ ] `vite.config.js` doesn't expose secrets
- [ ] `.gitignore` includes `.env.local`

### Supabase Client
- [ ] Supabase anon key used (not service role)
- [ ] Keys loaded from environment variables
- [ ] No hardcoded keys in source code
- [ ] RLS policies secure data at database level

### Git History
- [ ] No secrets in git history
- [ ] No leaked keys in old commits
- [ ] Git filter applied if needed
- [ ] No evidence of secret patterns

### Build Output
- [ ] No secrets in `dist/` folder
- [ ] `dist/` not committed to git
- [ ] Build process clean (no leaks)

### Dependencies
- [ ] NPM audit passes
- [ ] No suspicious packages
- [ ] Known vulnerabilities patched
- [ ] Node modules not committed

### Code Review
- [ ] No secrets in code comments
- [ ] No hardcoded URLs with credentials
- [ ] Test files don't have real secrets
- [ ] Example code is actually example only

---

## WHAT SHOULD BE IN FRONTEND

```javascript
// ✅ CORRECT: Frontend config
const config = {
  // Supabase public access only
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  
  // API endpoints
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  
  // Model names (not keys)
  llmModel: import.meta.env.VITE_LLM_MODEL,
  
  // Public configuration
  appVersion: '1.0.0',
  environment: import.meta.env.MODE,
}

export default config
```

---

## WHAT SHOULD NEVER BE IN FRONTEND

```javascript
// ❌ WRONG: Backend secrets exposed
const config = {
  openaiKey: 'sk-proj-xxxxx',           // ❌ NO
  supabaseServiceKey: 'eyJhbGc...',     // ❌ NO
  databasePassword: 'xxxxx',             // ❌ NO
  jwtSecret: 'xxxxx',                    // ❌ NO
  stripeSecretKey: 'sk_live_xxxxx',     // ❌ NO
  resendApiKey: 're_xxxxx',              // ❌ NO
}
```

---

## COMMON MISTAKES

### Mistake 1: Using Service Role Key
```javascript
// ❌ WRONG
const supabase = createClient(url, SERVICE_ROLE_KEY)

// ✅ CORRECT
const supabase = createClient(url, ANON_KEY)
```

**Why:** Service role has all database access, anon key is read-only

### Mistake 2: Hardcoding API Keys
```javascript
// ❌ WRONG
const apiKey = 'sk-proj-xxxxx'

// ✅ CORRECT
const apiKey = import.meta.env.VITE_OPENAI_API_KEY
// Then it's loaded from .env, NOT exposed in frontend
```

**Why:** Hardcoded keys end up in the compiled bundle

### Mistake 3: Not Using .env

```javascript
// ❌ WRONG (in version control)
export const API_KEY = 'sk-xxxxx'

// ✅ CORRECT (environment variable)
export const API_KEY = import.meta.env.VITE_API_KEY
```

**Why:** Environment variables aren't committed to git

### Mistake 4: Committing .env Files
```bash
# ❌ WRONG
git add .env
git add .env.local

# ✅ CORRECT
.env.local        # In .gitignore
.env.development  # In .gitignore
.env.production   # In .gitignore (use secrets manager instead)
```

---

## VERIFICATION COMMANDS

### Quick Check
```bash
cd frontend

# 1. Check for secret patterns
grep -r "sk_\|sk-proj-\|SERVICE_ROLE\|API_KEY.*=" src/ | \
  grep -v "env\|import\|TODO" || echo "✅ No hardcoded secrets found"

# 2. Check .env files
ls -la | grep "\.env"
# Should show: .env.example only (not .env.local or .env.production)

# 3. Check git history
git log -p -S "sk_" -- . | wc -l
# Should return 0
```

### Comprehensive Check
```bash
# 1. Source code
find src -name "*.js" -o -name "*.jsx" | \
  xargs grep -l "sk_\|SERVICE_ROLE\|Database.*password"

# 2. Config files
grep -r "secret\|apiKey\|password" . --include="*.config.*" | \
  grep -v node_modules | grep -v dist

# 3. Git history
git log --all --source --grep="secret\|api.*key" | wc -l

# 4. Dist folder (after build)
npm run build && grep -r "sk_" dist/ || echo "✅ Build clean"
```

---

## ACTION PLAN

### Immediate (This Week)
- [ ] Run quick check commands above
- [ ] Review .env files
- [ ] Check Supabase client setup
- [ ] Verify git history clean

### Short Term (Week 2)
- [ ] Document frontend secrets policy
- [ ] Add pre-commit hook to prevent secrets
- [ ] Create example .env file
- [ ] Audit all dependencies

### Medium Term (Week 3+)
- [ ] Implement automated secret scanning
- [ ] Set up GitHub secret scanning
- [ ] Train team on secrets best practices
- [ ] Regular audits (monthly)

---

## PRE-COMMIT HOOK

**File:** `.git/hooks/pre-commit`

```bash
#!/bin/bash
# Prevent committing secrets

echo "🔍 Checking for secrets..."

# Patterns to block
PATTERNS=(
  "sk_"
  "sk-proj-"
  "SERVICE_ROLE"
  "SUPABASE_SERVICE_KEY"
  "API_KEY.*="
  "password.*="
)

for pattern in "${PATTERNS[@]}"; do
  if git diff --cached | grep "$pattern"; then
    echo "❌ Potential secret detected: $pattern"
    echo "Commit blocked!"
    exit 1
  fi
done

echo "✅ No secrets detected"
exit 0
```

---

## COMPLIANCE

| Standard | Requirement | Status |
|----------|-------------|--------|
| OWASP | No secrets in frontend | ⏳ TODO |
| CWE-798 | No hardcoded credentials | ⏳ TODO |
| NIST | Secrets management documented | ⏳ TODO |
| SOC 2 | Access controls verified | ⏳ TODO |

---

## FINDINGS TEMPLATE

### Executive Summary
- [ ] Secrets found in frontend: YES / NO
- [ ] Secrets exposed in bundle: YES / NO
- [ ] Git history clean: YES / NO
- [ ] Risk level: 🟢 GREEN / 🟡 YELLOW / 🔴 RED

### Detailed Findings
1. ...
2. ...
3. ...

### Recommendations
1. ...
2. ...
3. ...

---

**Status:** Audit plan ready, awaiting implementation  
**Owner:** Frontend team  
**Last Updated:** September 7, 2026  
**Next Review:** September 14, 2026
