# 🧪 QUICK TEST - OpenAI + UA Integration

**Date:** 2026-06-30  
**Status:** Ready to test  

---

## ✅ Verify Backend is Ready

```bash
# 1. Check service is running
ssh root@159.65.252.227 "systemctl status vitaloop-backend | grep Active"
# Expected: Active: active (running)

# 2. Verify OpenAI key is set
ssh root@159.65.252.227 "cat /etc/vitaloop/.env | grep OPENAI"
# Expected: OPENAI_API_KEY=sk-proj-Nm7clbku-...

# 3. Check backend logs for OpenAI initialization
ssh root@159.65.252.227 "tail -20 /var/log/vitaloop/backend.log"
# Expected: No OPENAI errors, backend initialized
```

---

## 🌍 Test EN Version

**URL:** https://vitaloop.today/upload

**Steps:**
1. Click "Upload" button
2. Select PDF file with lab results (blood work recommended)
3. Click "Analyze"
4. Wait for results
5. Verify:
   - ✅ Shows biomarker list (not just raw data)
   - ✅ Shows recommendations in English
   - ✅ Shows confidence levels
   - ✅ Shows doctor discussion flags if needed

**If it works:** ✅ OpenAI is connected  
**If it doesn't:** Check logs: `ssh root@159.65.252.227 'tail -50 /var/log/vitaloop/backend.log | grep -i error'`

---

## 🇺🇦 Test UA Version

**URL:** https://ua.vitaloop.today/upload

**Steps:**
1. Click "Завантажити" (Upload button)
2. Select SAME PDF file as EN test
3. Click "Аналізувати" (Analyze)
4. Wait for results
5. Verify:
   - ✅ Shows SAME biomarkers as EN (identical analysis)
   - ✅ Shows recommendations in Ukrainian
   - ✅ Shows confidence levels (same as EN)
   - ✅ UI is in Ukrainian

**Expected Difference:**
- EN shows: "Ferritin: 45 ng/mL (BORDERLINE)"
- UA shows: "Феритин: 45 ng/mL (МЕЖОВА)" ← Only language differs!

**If results differ:** Something is wrong (report issue)  
**If results are identical:** ✅ Perfect! UA properly connected

---

## 🔄 Side-by-Side Comparison

**Test with same PDF on both:**

```
┌─────────────────────────────────────┐
│ EN: https://vitaloop.today/upload   │
├─────────────────────────────────────┤
│ Upload PDF                          │
│ ↓                                   │
│ Results:                            │
│ • Ferritin: 45 (BORDERLINE)         │
│ • B12: 320 (LOW)                    │
│ • Vitamin D: 28 (INSUFFICIENT)      │
│ [Recommendations in English]        │
└─────────────────────────────────────┘

┌──────────────────────────────────────┐
│ UA: https://ua.vitaloop.today/upload │
├──────────────────────────────────────┤
│ Upload PDF                           │
│ ↓                                    │
│ Results:                             │
│ • Феритин: 45 (МЕЖОВА)              │
│ • B12: 320 (НИЗЬКО)                 │
│ • Вітамін D: 28 (НЕДОСТАТНЬО)       │
│ [Рекомендації на українській]       │
└──────────────────────────────────────┘

✅ SAME ANALYSIS, DIFFERENT LANGUAGE
```

---

## 📊 What OpenAI Enables

### ✅ Now Working (Post-Deployment)
- [ ] Vision API for scanned PDFs
- [ ] Advanced biomarker detection
- [ ] Context-aware recommendations
- [ ] Multiple language support (EN + UA)
- [ ] Personalized protocol generation
- [ ] Knowledge base integration

### Before (Fallback Mode)
- ✗ Vision API: Not working
- ✗ Detection: Limited to regex patterns
- ✗ Recommendations: Only 4 hardcoded protocols
- ✗ Knowledge base: Not accessible
- ✗ Languages: Only English fallback

---

## 🚨 Troubleshooting

### Issue: "Upload fails with error"
```bash
ssh root@159.65.252.227 "tail -50 /var/log/vitaloop/backend.log"
# Look for: "OPENAI", "error", "exception"
# Check if key format is correct: starts with sk-proj-
```

### Issue: "Results look wrong or incomplete"
```bash
# Verify OpenAI key is actually being used:
ssh root@159.65.252.227 "ps aux | grep vitaloop-backend"
# Should show: /var/www/VITALOOP/backend/.venv/bin/python3 uvicorn

# Check if service needs restart:
ssh root@159.65.252.227 "systemctl restart vitaloop-backend"
# Then try upload again
```

### Issue: "UA shows English instead of Ukrainian"
```
This would indicate a deployment issue with the UA frontend.
Check: https://ua.vitaloop.today/ loads in Ukrainian
If not, redeploy UA frontend:
cd /Users/oleksii/projects/vitaloop_ua
npm ci && npm run build
chmod +x ../scripts/deploy-frontend-dist.sh
../scripts/deploy-frontend-dist.sh
```

### Issue: "EN and UA results are different"
```
This should NOT happen - they share the same backend!
If results differ:
1. Check both use same backend: curl https://vitaloop.today/health
2. Verify backend is not using old binary: ps aux | grep vitaloop-backend
3. Restart backend: ssh root@159.65.252.227 'systemctl restart vitaloop-backend'
```

---

## ✅ Success Indicators

### Green Flags ✅
- [ ] EN upload → Gets analysis in English
- [ ] UA upload → Gets analysis in Ukrainian
- [ ] Same PDF → Same biomarkers, same values
- [ ] Recommendations → Different language, same content
- [ ] No errors in logs

### Red Flags 🚩
- [ ] Upload hangs or returns 500 error
- [ ] Results are in wrong language
- [ ] EN and UA give different numbers
- [ ] OpenAI errors in logs
- [ ] Backend won't start

---

## 📝 Logging Commands

```bash
# Real-time logs (live updates)
ssh root@159.65.252.227 'tail -f /var/log/vitaloop/backend.log'

# Last 100 lines
ssh root@159.65.252.227 'tail -100 /var/log/vitaloop/backend.log'

# Filter for OpenAI calls
ssh root@159.65.252.227 'tail -100 /var/log/vitaloop/backend.log | grep -i openai'

# Filter for errors
ssh root@159.65.252.227 'tail -100 /var/log/vitaloop/backend.log | grep -i error'

# Watch for new uploads
ssh root@159.65.252.227 'tail -f /var/log/vitaloop/backend.log | grep -i analyze'

# Check systemd journal
ssh root@159.65.252.227 'journalctl -u vitaloop-backend -n 50'
```

---

## 📋 Test Case Template

**Date:** ____  
**Tester:** ____  
**PDF Used:** ____  

### EN Test
- [ ] Page loads
- [ ] Upload works
- [ ] Analysis completes
- [ ] Results in English
- [ ] Biomarkers recognized: ___
- [ ] Recommendations shown

### UA Test
- [ ] Page loads (in Ukrainian)
- [ ] Upload works
- [ ] Analysis completes
- [ ] Results in Ukrainian
- [ ] Biomarkers match EN: ___
- [ ] Recommendations in Ukrainian

### Comparison
- [ ] Same biomarkers EN vs UA
- [ ] Same values EN vs UA
- [ ] Only language differs
- [ ] Recommendations align

**Status:** [ ] PASS [ ] FAIL  
**Notes:** ________________

---

**Next Steps:** Run tests above, report results! 🚀
