# 🚀 OpenAI + UA Integration - Quick Checklist

**Date:** 2026-06-30  
**Goal:** Connect UA frontend to OpenAI + shared knowledge base

---

## ✅ What's Already Done

| Component | Status | Details |
|-----------|--------|---------|
| **EN Frontend** | ✅ Ready | vitaloop/frontend (47 pages, 96 components) |
| **UA Frontend** | ✅ Ready | vitaloop_ua/frontend (17/17 smoke tests pass) |
| **Shared Backend** | ✅ Ready | vitaloop/backend (analysis service) |
| **Knowledge Base** | ✅ Ready | Supabase table `knowledge_rules` |
| **API Connection** | ✅ Ready | Both use relative paths `/api` |
| **PDF Support** | ✅ Ready | PDF, PNG, JPG, TIFF, XLSX, CSV |

---

## 🔴 WHAT NEEDS TO BE DONE

### 1. Get OpenAI API Key (5 minutes)
```bash
# Option A: Use existing key if available
# Option B: Create new from https://platform.openai.com/api/keys

export OPENAI_API_KEY="sk-proj-..."
```

### 2. Deploy to Production Server (5 minutes)
```bash
cd /Users/oleksii/projects/vitaloop
chmod +x scripts/setup-openai-production.sh
./scripts/setup-openai-production.sh sk-proj-...
```

**What the script does:**
- ✅ SSH to production server
- ✅ Adds key to `/etc/vitaloop/.env`
- ✅ Restarts vitaloop-backend service
- ✅ Verifies health endpoint
- ✅ Tests analysis endpoint

### 3. Test Both Versions (5 minutes)
```
1. Open https://vitaloop.today/upload
   - Upload PDF with lab results
   - Check analysis works

2. Open https://ua.vitaloop.today/upload
   - Upload SAME PDF
   - Results should be identical
   - UI should be in Ukrainian
```

### 4. Monitor (Ongoing)
```bash
ssh root@159.65.252.227
tail -f /var/log/vitaloop/backend.log | grep -i "openai\|analyze"
```

---

## 📋 Why UA Doesn't Need Separate Backend

❌ **Wrong:** Separate backend + separate OpenAI key + separate database
✅ **Right:** One backend + one OpenAI key + one knowledge base

```
Data flow is identical for both:

UA Upload → Backend → OpenAI + Supabase → Results
EN Upload → Backend → OpenAI + Supabase → Results

The only difference is the FRONTEND LANGUAGE:
- EN shows "Ferritin" (English)
- UA shows "Феритин" (Ukrainian)
```

---

## 🔍 What Gets Analyzed

### When OpenAI Key is Set (Full Mode):
- ✅ PDF text extraction (OCR)
- ✅ Scanned documents (vision API)
- ✅ Complex table parsing
- ✅ Biomarker detection
- ✅ Unit conversion
- ✅ Context-aware recommendations
- ✅ Knowledge base integration
- ✅ Personalized protocols

### Without OpenAI Key (Fallback Mode):
- ⚠️ Regex-based parsing (40% accuracy)
- ⚠️ Simple formats only
- ⚠️ 4 hardcoded protocols (D, Mg, Fe, B12)
- ⚠️ No context understanding

---

## 📊 Current Status After Setup

### EN Version (vitaloop.today)
```
├─ Frontend: ✅ Ready
├─ Backend: ✅ Ready
├─ OpenAI: (after setup) ✅ Ready
├─ Knowledge Base: ✅ Supabase connected
└─ Analysis: (after setup) ✅ Full mode
```

### UA Version (ua.vitaloop.today)
```
├─ Frontend: ✅ Ready
├─ Backend: ✅ Shared with EN
├─ OpenAI: (after setup) ✅ Shared with EN
├─ Knowledge Base: ✅ Shared with EN
└─ Analysis: (after setup) ✅ Full mode (identical to EN)
```

---

## 🆘 If Something Goes Wrong

### Backend won't start
```bash
ssh root@159.65.252.227
sudo journalctl -u vitaloop-backend -n 50
# Check for OPENAI_API_KEY errors
```

### Analysis returns 404
```bash
curl https://api.vitaloop.today/health
# Should show backend is running
```

### Wrong language showing
```
# EN frontend at https://vitaloop.today/upload should show English
# UA frontend at https://ua.vitaloop.today/upload should show Ukrainian
# If not, check Nginx configuration
```

---

## 📚 Documentation Created

1. **UA_EN_INTEGRATION_GUIDE.md** - Architecture & integration details
2. **PRODUCTION_SETUP_EN.md** - EN deployment & operations
3. **PRODUCTION_SETUP_UA.md** - UA deployment & operations
4. **ANALYSIS_AND_CABINET_DIAGNOSTIC.md** - Full diagnostics
5. **setup-openai-production.sh** - Automated setup script

---

## ✨ After Setup Complete

Both EN and UA versions will:
- ✅ Upload PDFs with high accuracy
- ✅ Recognize 100+ biomarkers
- ✅ Convert units automatically
- ✅ Generate personalized protocols
- ✅ Access shared knowledge base
- ✅ Provide context-aware recommendations
- ✅ Work for Ukrainian and English users

---

**Time to Complete:** ~15 minutes  
**Risk Level:** Low (read-only changes on EN, just adding env var)  
**Rollback:** Remove OPENAI_API_KEY from env, restart backend → Falls back to regex mode  

**Ready to proceed?** Execute: `./scripts/setup-openai-production.sh sk-proj-...`
