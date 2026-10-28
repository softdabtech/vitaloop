# 🔗 UA & EN Integration Guide - OpenAI + Knowledge Base Setup

**Date:** 2026-06-30  
**Status:** Ready for configuration

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED INFRASTRUCTURE                     │
├─────────────────────────────────────────────────────────────┤
│  Backend: http://localhost:8006 (Analysis Service)          │
│  Database: Supabase (knowledge_rules table)                 │
│  LLM: OpenAI (gpt-4o-mini text, gpt-4o vision)            │
└─────────────────────────────────────────────────────────────┘
           ↑                    ↑                    ↑
           │                    │                    │
    ┌──────┴──────┐    ┌────────┴────────┐    ┌─────┴──────┐
    │  EN Frontend    │    │  UA Frontend    │    │ CRM Backend │
    │ (vitaloop/     │    │ (vitaloop_ua/  │    │             │
    │  frontend)     │    │  frontend)     │    │ (crm.app)   │
    └────────────────┘    └─────────────────┘    └─────────────┘
         GET /api/v1/analyze/pdf              
         GET /api/v1/health
```

---

## What's Already Set Up (Shared)

### ✅ Backend Analysis Service
- **Location**: `backend/app/services/`
- **Supports**:
  - PDF analysis (text + vision)
  - Image analysis (PNG, JPG, TIFF)
  - Table parsing (XLSX, CSV)
  - Biomarker extraction
  - Protocol generation

### ✅ Knowledge Database (Supabase)
- **Table**: `knowledge_rules`
- **Status**: Active rules stored with:
  - Rule ID, key, name, description
  - Input entities & conditions
  - Outputs & confidence scoring
  - Doctor discussion requirements
  - Evidence levels & sources

### ✅ Frontends
| Version | Location | API Endpoint | Status |
|---------|----------|--------------|--------|
| **EN** | `vitaloop/frontend` | `/api/v1/*` | ✓ Ready |
| **UA** | `vitaloop_ua/frontend` | `/api/v1/*` | ✓ Ready |

**Both frontends use relative paths** (`/api`), so they automatically connect to the backend through nginx proxy.

---

## What Needs Configuration (CRITICAL)

### 1. OpenAI API Key on Production Server

**Current Status:** ❌ Not configured (will fall back to regex parsing)

**Location to Configure:**
```bash
ssh root@159.65.252.227

# Add to systemd service or .env:
export OPENAI_API_KEY="sk-proj-..."

# Verify:
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models \
  | head -20
```

**What Gets Enabled:**
- ✅ Vision API for scanned PDFs
- ✅ Advanced biomarker detection
- ✅ Context-aware recommendations from knowledge base
- ✅ Pattern recognition across multiple markers

---

## How UA Connects to OpenAI & Knowledge Base

### Request Flow (PDF Upload)

**User uploads PDF via UA Frontend:**
```
1. User: https://ua.vitaloop.today/upload
2. Selects file + symptoms
3. Frontend: POST /api/v1/analyze/pdf
   ↓
4. Nginx routes → Backend (http://127.0.0.1:8006)
   ↓
5. Backend queries Supabase:
   a) Load active rules from knowledge_rules table
   b) Get recommendation templates
   ↓
6. OpenAI GPT-4o-mini analyzes:
   a) PDF text extraction
   b) Biomarker recognition
   ↓
7. Evaluate with rules from Supabase
   ↓
8. Generate personalized protocol
   ↓
9. Return results to UA Frontend
```

### Config Chain

**Frontend (vitaloop_ua/frontend) → Backend → OpenAI + Supabase**

```javascript
// vitaloop_ua/src/api/client.ts
const apiBaseUrl = '/api'  // Relative path
// ↓ Nginx proxy (vitaloop.today/api → 127.0.0.1:8006)
// ↓
// backend/app/config.py
openai_api_key: str = ""  // ← NEEDS TO BE SET via env var
openai_model: str = "gpt-4o-mini"
// ↓ OpenAI API
// ↓ Supabase queries via supabase_service
```

---

## Setup Checklist

### Phase 1: Verify Shared Infrastructure (Local Dev)
- [ ] Backend running: `curl http://127.0.0.1:8006/health`
- [ ] Supabase connected: `SELECT COUNT(*) FROM knowledge_rules WHERE active = true;`
- [ ] Both frontends load: http://localhost:5173 (EN) + http://localhost:5174 (UA)

### Phase 2: Production Server Configuration
- [ ] Get OpenAI API key from team/console
- [ ] SSH to production: `ssh root@159.65.252.227`
- [ ] Set env var in backend service
- [ ] Verify health check shows OpenAI configured
- [ ] Test PDF upload from EN: https://vitaloop.today/upload
- [ ] Test PDF upload from UA: https://ua.vitaloop.today/upload

### Phase 3: Validation
- [ ] Upload test PDF in EN → Check if analysis works
- [ ] Upload same PDF in UA → Results should be identical (same backend)
- [ ] Check logs for errors: `tail -100 /var/log/vitaloop/backend.log`
- [ ] Verify knowledge rules are being applied

---

## Important: NO Separate UA Backend Needed

❌ **DO NOT create separate backend for UA** - it's unnecessary because:

1. **Analysis is language-agnostic**
   - Biomarker values are numbers
   - OpenAI handles input in any language
   - Supabase rules apply globally

2. **UI handles localization**
   - EN frontend: English labels
   - UA frontend: Ukrainian labels
   - Same data, different presentation

3. **Shared Knowledge Base**
   - `knowledge_rules` table is universal
   - Rules work for both EN/UA users
   - No duplication needed

**Example:**
```python
# Backend (same for EN & UA)
biomarker = {
  'name': 'Ferritin',
  'value': 45,
  'unit': 'ng/mL',
  'status': 'BORDERLINE'
}
```

```javascript
// EN Frontend
markerName = 'Ferritin'  // English label

// UA Frontend
markerName = 'Феритин'   // Ukrainian label
// Same data, translated UI
```

---

## Files Modified for UA Connection

✅ **No changes needed** - UA frontend already connects to shared backend!

**Proof:**
- `vitaloop_ua/src/api/client.ts` uses relative paths → Nginx proxy handles routing
- API endpoint: `/api/v1/analyze/pdf` (same for both)
- Backend config reads from environment → Works for both

---

## Troubleshooting

### Issue: "Analysis failed"
```bash
# Check if OpenAI key is set
ssh root@159.65.252.227
echo $OPENAI_API_KEY

# If empty, set it:
echo 'export OPENAI_API_KEY="sk-..."' >> /etc/environment
systemctl restart vitaloop-backend

# Check logs
tail -50 /var/log/vitaloop/backend.log | grep -i openai
```

### Issue: "Knowledge base is empty"
```bash
# Check Supabase connection
SELECT COUNT(*) FROM knowledge_rules WHERE active = true;

# Should return > 0. If 0, populate it from EN setup
```

### Issue: "UA Frontend returns EN results"
```
This is CORRECT - same backend, same analysis.
Only the UI labels differ.
```

---

## Next Steps

1. **Get OpenAI API key** from team
   - Option A: Use existing key from EN setup
   - Option B: Create new key in OpenAI console

2. **Set on production server**
   ```bash
   ssh root@159.65.252.227
   sudo nano /etc/vitaloop/.env
   # Add: OPENAI_API_KEY=sk-proj-...
   # Save and exit
   
   systemctl restart vitaloop-backend
   ```

3. **Test both versions**
   - https://vitaloop.today/upload → Upload PDF
   - https://ua.vitaloop.today/upload → Upload same PDF
   - Results should be identical

4. **Monitor logs**
   ```bash
   ssh root@159.65.252.227
   tail -f /var/log/vitaloop/backend.log | grep -i analyze
   ```

---

## Documentation References
- [ANALYSIS_AND_CABINET_DIAGNOSTIC.md](./ANALYSIS_AND_CABINET_DIAGNOSTIC.md) - Full system diagnostics
- [PRODUCTION_SETUP_EN.md](./vitaloop/PRODUCTION_SETUP_EN.md) - EN deployment guide
- [PRODUCTION_SETUP_UA.md](./vitaloop_ua/PRODUCTION_SETUP_UA.md) - UA deployment guide

---

**Summary:** ✅ UA is ready - just needs OpenAI API Key on server!
