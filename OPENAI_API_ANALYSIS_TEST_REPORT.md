# OpenAI API Analysis & Upload Page Test Report
**Date:** May 27, 2026  
**Status:** ⚠️ Mixed configuration in code; production LLM checks currently use OpenAI API

---

## Key Finding: Mixed Provider Paths

⚠️ The backend has two different AI paths:
- OpenAI-compatible path (used by text/manual analysis and health synthetic checks)
- Anthropic-specific PDF path (`ClaudePDFAnalyzer`)

Production currently reports OpenAI as active provider for LLM health checks (`https://api.openai.com/v1`, `gpt-4o-mini`).

### Current Implementation

| Feature | Provider | File | Status |
|---------|----------|------|--------|
| **PDF Analysis** | Anthropic-specific client | `backend/app/services/claude_pdf_analyzer.py` | ✅ Implemented |
| **Text Analysis** | OpenAI-compatible endpoint (`active_llm_*`) | `backend/app/services/claude_service.py` | ✅ Implemented |
| **Manual Entry** | OpenAI-compatible endpoint (`active_llm_*`) | `backend/app/routers/analysis/analyze.py` | ✅ Implemented |
| **PNG/JPG Support** | ❌ NOT Implemented | — | ✗ Missing |

---

## Backend Analysis

### 1. PDF Analysis Endpoint: `POST /analyze/pdf`
**File:** `backend/app/routers/analysis/analyze.py:73-195`

```python
async def analyze_lab_pdf(file: UploadFile):
    # Uses ClaudePDFAnalyzer from claude_pdf_analyzer.py
    analysis = await pdf_analyzer.analyze_lab_pdf(temp_path, symptoms=symptoms)
```

**Claude PDF Analyzer** (`claude_pdf_analyzer.py`):
- ✅ Reads PDF as base64
- ✅ Uses Claude's `document` content type for vision analysis
- ✅ Extracts biomarkers with values and reference ranges
- ✅ Generates personalized supplement protocol
- ✅ Identifies top priority issues and retest schedule
- ✅ Timeout handling: 60-120 seconds

**Supported Analysis:**
- Full biomarker extraction (name, value, unit, status, category)
- Reference range detection
- Status categorization: OPTIMAL, BORDERLINE, DEFICIENT, ELEVATED
- Protocol generation with dosages and timing
- Top priority identification
- Retest schedule

---

### 2. Manual Biomarker Entry: `POST /analyze/manual`
**File:** `backend/app/routers/analysis/analyze.py:614-681`

```python
async def analyze_manual_biomarkers(request: ManualAnalysisRequest):
    # Validates entries
    # Converts to standard units
    # Creates upload record
    # Generates protocol via Claude
```

**Features:**
- ✅ Dropdown selection of predefined biomarkers
- ✅ Value + unit input
- ✅ Validation: positive numbers, range checks
- ✅ Unit conversion to standard units
- ✅ Protocol generation via Claude
- ✅ Freemium quota enforcement (1 entry for free users)

**Endpoint:** `GET /analyze/biomarkers/options` (returns dropdown list)

---

### 3. Text Analysis: `POST /analyze` (legacy)
**File:** `backend/app/routers/analysis/analyze.py:290-512`

- Accepts raw OCR text
- Calls `extract_biomarkers()` from Claude service
- Supports idempotency keys for retry safety
- Returns biomarkers and analysis metadata

---

## Frontend Implementation

### Upload Page: `/upload`
**File:** `frontend/src/pages/Upload.jsx`

**Supported File Types:**
```javascript
const SUPPORTED_FILE_TYPES = ['application/pdf']  // ← ONLY PDFs!
```

**Tab Switcher:**
- 📄 Upload PDF / Photo ← **Label says "Photo" but NOT implemented**
- ✋ Enter Manually ✅ **Working**

**Upload Zone Component:**
```javascript
accept: { 'application/pdf': ['.pdf'] }  // Only PDFs accepted
```

---

## Test Results

### ❌ What's NOT Working

1. **PNG/JPG Files:** 
   - Frontend accepts only PDFs (line 21, 46 in Upload.jsx)
   - UploadZone component only accepts `application/pdf` (line 13)
   - Backend `/analyze/pdf` only validates PDF files (line 99)
   - **Status:** Not implemented

2. **Photo Upload:**
   - Tab label says "Upload PDF / Photo" but no code supports it
   - Validation rejects PNG/JPG files
   - **Status:** UI label is misleading

### ✅ What IS Working

1. **PDF Analysis:**
   - Claude API with document vision capability
   - Full biomarker extraction
   - Protocol generation
   - **Status:** ✅ Fully implemented

2. **Manual Biomarker Entry:**
   - Dropdown selection from predefined list
   - Value input with unit conversion
   - Claude-based protocol generation
   - **Status:** ✅ Fully implemented

---

## Code Architecture

### Service Layer Hierarchy

```
Upload.jsx (Frontend)
    ↓
POST /analyze/pdf (FastAPI Router)
    ↓
ClaudePDFAnalyzer
    ↓
AsyncAnthropic (Claude API)
    ↓ (Uses document type for vision)
Claude 3.5 Sonnet (default)
```

### Authentication & Rate Limiting

- ✅ User authentication required (Depends: `get_current_user`)
- ✅ Freemium quota enforced: 1 analysis for free users
- ✅ Idempotency keys for safe retries
- ✅ Session timeout: 60 seconds for analysis

---

## Recommended Fixes

### Issue 1: Misleading UI Label
**Fix:** Remove "/ Photo" from tab label or implement PNG/JPG support

```jsx
// Line 287 in Upload.jsx - CHANGE FROM:
📄 Upload PDF / Photo

// CHANGE TO:
📄 Upload PDF
```

### Issue 2: Add Image Support (If Desired)
If PNG/JPG support is wanted, Claude API supports image analysis:

1. Update UploadZone.jsx to accept images:
```javascript
accept: { 
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg']
}
```

2. Create new endpoint `POST /analyze/image` in analyze.py
3. Use Claude's image content type instead of document type
4. Similar extraction logic as PDF analyzer

---

## Quota System

**Freemium Limits (Free Users):**
- Max 1 biomarker entry total (PDF upload OR manual entry, not both)
- Enforced in `BiomarkerService.check_freemium_biomarker_quota()`

**Premium Users:**
- Unlimited uploads
- Unlimited manual entries

---

## API Configuration Status

### Environment Setup
- **Anthropic SDK Version:** 0.28.0 (requirements.txt)
- **Default Model:** `claude-sonnet-4-20250514` (Claude Sonnet 4)
- **Analysis Timeout:** 120 seconds
- **Max Tokens:** 8192
- **PDF Max Size:** 10MB

### Configuration Sources
1. **Primary:** Claude API (Anthropic) - `settings.anthropic_api_key`
2. **Fallback:** DigitalOcean Claude API - `settings.digitalocean_claude_base_url`
3. **Alternative:** Route LLM (Abacus AI) - for smart routing

### Current API Key Status
⚠️ **ANTHROPIC_API_KEY not set in environment variables**
- Must be configured via `.env` file or environment variables
- If not set, PDF analysis will fail with connection error
- Manual entry may also fail during protocol generation

---

## Test Instructions for `/upload` Page

### Prerequisites
1. Ensure `ANTHROPIC_API_KEY` is set:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Start backend server:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload
   ```

3. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

### Test Case 1: PDF Upload
1. Navigate to `https://localhost:5173/upload` (or `https://vitaloop.today/upload`)
2. Click "📄 Upload PDF"
3. Select a lab report PDF (under 10MB)
4. (Optional) Add lab name: "LabCorp"
5. (Optional) Add symptoms: "Fatigue", "Headaches"
6. Drop file or click "Choose File"
7. **Expected:** 
   - Analysis progress indicator
   - 30-120 second analysis time
   - Redirect to results page with biomarkers
   - Generated protocol with supplements

### Test Case 2: Manual Biomarker Entry
1. Navigate to `/upload`
2. Click "✋ Enter Manually"
3. Click "+ Add Biomarker"
4. Select from dropdown (e.g., "Hemoglobin", "Glucose")
5. Enter value (e.g., 14.5)
6. Select unit (e.g., "g/dL")
7. Click "Analyze"
8. **Expected:**
   - Entry validation
   - Unit conversion to standard units
   - Protocol generation via Claude
   - Results page with biomarkers

### Test Case 3: PNG/JPG Upload (Should Fail)
1. Try to upload PNG or JPG file
2. **Expected:** 
   - Error: "Unsupported file type. Please upload a PDF file."
   - File is rejected

---

## Error Codes by Status

| Status | Code | Meaning |
|--------|------|---------|
| 400 | INVALID_FILE_TYPE | File is PNG/JPG (not PDF) |
| 402 | BIOMARKER_QUOTA_EXCEEDED | Free user limit reached (1) |
| 408 | ANALYSIS_TIMEOUT | PDF too complex/large (>120s) |
| 422 | BIOMARKERS_NOT_EXTRACTED | Lab report format not recognized |
| 503 | ANALYSIS_SERVICE_UNAVAILABLE | Claude API connection error |
| 504 | ANALYSIS_TIMEOUT | Analysis didn't complete in time |

---

## Conclusion

✅ **OpenAI API is currently reachable and active in production LLM health checks**  
✅ **PDF flow remains Anthropic-specific** (`ClaudePDFAnalyzer`)  
❌ **PNG/JPG image support is NOT implemented** (UI label is misleading)  
⚠️ If the product requirement is "OpenAI only", PDF analyzer must be migrated from Anthropic SDK to an OpenAI-compatible implementation.

### Key Takeaway
The system is **not exclusively Anthropic**. It is currently **mixed**:
- **Text/manual analysis:** OpenAI-compatible `chat/completions` via `active_llm_*`
- **PDF analysis:** Anthropic SDK (`AsyncAnthropic`) path
