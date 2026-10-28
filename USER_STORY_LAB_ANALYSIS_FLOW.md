# 📋 User Story: Lab Analysis Flow (Полный флоу обработки анализов)

## 🎯 Что происходит при загрузке анализа

Пользователь загружает файл с результатами лабораторных анализов (PDF или текст). Система анализирует файл, извлекает биомаркеры, сравнивает их с нормами, и генерирует персонализированный протокол лечения.

---

## 📊 Архитектура флоу

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER UPLOADS LAB RESULTS                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. FRONTEND (Upload.jsx)                                            │
│     └─> Select PDF file or paste text                               │
│     └─> Optional: add lab name, test date, symptoms                 │
│     └─> POST /analyze/pdf (PDF) OR POST /analyze (text)             │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  2. BACKEND INPUT VALIDATION (analyze.py)                            │
│     └─> Check file type (PDF) or text length (20+ chars)            │
│     └─> Validate OCR confidence (0-100)                             │
│     └─> Normalize symptoms (deduplicate, trim)                      │
│     └─> Check freemium quota (1 upload for free users)              │
│     └─> Create idempotency key to prevent duplicates                │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  3. PDF ANALYSIS OR TEXT EXTRACTION                                  │
│                                                                       │
│  PATH A: PDF FILE (ClaudePDFAnalyzer.analyze_lab_pdf)              │
│  ─────────────────────────────────────────────                      │
│  └─> Base64 encode PDF                                              │
│  └─> Send to Claude API with vision capability                      │
│  └─> Claude analyzes PDF image directly                             │
│  └─> Returns structured JSON with biomarkers                        │
│                                                                       │
│  PATH B: EXTRACTED TEXT (extract_biomarkers via Claude)            │
│  ─────────────────────────────────────────────────────              │
│  └─> Normalize text (remove nulls, collapse spacing)                │
│  └─> Send to Claude with lab text                                   │
│  └─> Claude extracts biomarkers from text                           │
│  └─> Returns structured JSON with biomarkers                        │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  4. CLAUDE ANALYSIS (Both paths use same prompt structure)          │
│                                                                       │
│  PROMPT INPUT:                                                       │
│  ├─> Lab text/PDF content                                           │
│  ├─> User symptoms (if provided)                                    │
│  ├─> Instructions: extract biomarkers, categorize, prioritize      │
│  └─> Request: protocol recommendations                              │
│                                                                       │
│  CLAUDE PROCESSING:                                                  │
│  ├─> Extract ALL biomarkers with values and ranges                  │
│  ├─> Categorize each as: OPTIMAL, BORDERLINE, DEFICIENT, ELEVATED  │
│  ├─> Identify TOP PRIORITY issues (critical first)                  │
│  ├─> Generate supplement protocol with dosages                      │
│  ├─> Recommend retest schedule                                      │
│  └─> Provide health summary                                         │
│                                                                       │
│  RESPONSE FORMAT (JSON):                                             │
│  ├─> biomarkers: [                                                  │
│  │   {                                                               │
│  │     name: "Vitamin D (25-OH)"                                    │
│  │     value: 18                                                    │
│  │     unit: "ng/mL"                                                │
│  │     ref_low: 30                                                  │
│  │     ref_high: 100                                                │
│  │     status: "DEFICIENT"                                          │
│  │     category: "vitamins"                                         │
│  │   }                                                               │
│  │ ]                                                                 │
│  ├─> top_priority: [urgent issues with risk factors]               │
│  ├─> protocol: [supplement recommendations with dosages]            │
│  ├─> retest_schedule: [when to retest which markers]               │
│  └─> summary: [key findings and timeline]                          │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  5. DATABASE STORAGE (Supabase)                                     │
│                                                                       │
│  Save lab_upload:                                                    │
│  └─> Table: lab_uploads                                             │
│  └─> Fields: id, user_id, extracted_text, lab_name, status        │
│  └─> Status: "processing" → "done" / "failed"                      │
│  └─> Stores: analysis_method, summary, top_priority, retest info   │
│                                                                       │
│  Save biomarkers:                                                    │
│  └─> Table: biomarkers                                              │
│  └─> Fields: id, upload_id, user_id, name, value, unit            │
│  └─> Additional: ref_low, ref_high, status, category               │
│  └─> ~85+ biomarkers typically extracted per lab                    │
│                                                                       │
│  Save protocol:                                                      │
│  └─> Table: protocols                                               │
│  └─> Fields: id, user_id, upload_id, recommendations               │
│  └─> Stores: supplement names, dosages, timing, duration           │
│  └─> Stores: rationale for each recommendation                      │
│                                                                       │
│  Timeline event:                                                     │
│  └─> Table: timeline                                                │
│  └─> Event: "lab_analyzed"                                          │
│  └─> Metadata: biomarker count, analysis method, upload_id          │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  6. FRONTEND RESPONSE & DISPLAY (Results.jsx)                       │
│                                                                       │
│  Immediate response includes:                                       │
│  ├─> upload_id (unique identifier)                                  │
│  ├─> biomarkers (full list with values and ranges)                 │
│  ├─> top_priority (critical issues highlighted)                    │
│  ├─> protocol (supplement recommendations)                          │
│  ├─> retest_schedule (when to recheck)                             │
│  ├─> summary (key findings)                                        │
│  └─> analysis_time (how long it took)                              │
│                                                                       │
│  DISPLAY IN RESULTS PAGE:                                           │
│  └─> Biomarkers sorted by status priority:                         │
│      ├─> DEFICIENT (red) - critical attention needed               │
│      ├─> ELEVATED (orange) - abnormal, needs review                │
│      ├─> BORDERLINE (amber) - borderline, monitor                  │
│      └─> OPTIMAL (green) - everything ok                           │
│                                                                       │
│  └─> For each biomarker show:                                       │
│      ├─> Name (translated to English if needed)                    │
│      ├─> Current value                                              │
│      ├─> Reference range (low-high)                                │
│      ├─> Visual range bar showing position                         │
│      ├─> Status badge (color-coded)                                │
│      └─> Trend (if compared to previous tests)                     │
│                                                                       │
│  └─> TOP PRIORITY section shows:                                    │
│      ├─> Most critical biomarkers                                  │
│      ├─> Current values vs optimal                                 │
│      ├─> Health risks explained                                    │
│      └─> Urgency level (HIGH, MEDIUM, LOW)                        │
│                                                                       │
│  └─> PROTOCOL section shows:                                        │
│      ├─> Supplement recommendations                                │
│      ├─> Exact dosages (e.g., "5000 IU daily")                    │
│      ├─> Timing (morning with food, etc)                           │
│      ├─> Duration (e.g., "12 weeks")                               │
│      ├─> Priority level (HIGH, MEDIUM, LOW)                       │
│      ├─> Rationale (why this supplement helps)                     │
│      └─> iHerb links to purchase supplements                       │
│                                                                       │
│  └─> RETEST SCHEDULE shows:                                        │
│      ├─> Which biomarkers to retest                                │
│      ├─> Recommended timing (e.g., "after 8 weeks")               │
│      └─> Reason for retesting                                      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Детальный флоу по шагам

### STEP 1: Frontend Upload (Upload.jsx)

**User действия:**
1. Нажимает "Upload Lab Results"
2. Выбирает PDF файл ИЛИ копирует текст результатов
3. Опционально добавляет:
   - Lab name (e.g., "Invitro Lab")
   - Test date (когда были сданы анализы)
   - Symptoms (например: "fatigue, brain fog, hair loss")
4. Нажимает "Analyze"

**Frontend отправляет:**
```javascript
// For PDF:
POST /analyze/pdf
{
  file: <PDF File>,
  lab_name?: "Invitro Lab",
  symptoms?: ["fatigue", "brain fog"]
}

// For text:
POST /analyze
{
  extracted_text: "RBC: 4.5 M/uL, Hemoglobin: 13.2 g/dL, ...",
  lab_name?: "Invitro Lab",
  test_date?: "2026-05-15",
  ocr_confidence?: 85,
  symptoms?: ["fatigue", "brain fog"]
}
```

---

### STEP 2: Input Validation (Backend)

**Checks:**
- ✅ File type: must be PDF for /analyze/pdf
- ✅ Text length: minimum 20 characters (ИЛИ PDF not empty)
- ✅ OCR confidence: 0-100 if provided
- ✅ Symptoms: deduplicate, trim whitespace, max 10 per request
- ✅ Freemium quota: Free users get 1 upload (use BiomarkerService.check_freemium_biomarker_quota)

**If validation fails:**
```javascript
// Error 400: Invalid file type
{ detail: "Please upload a valid PDF file", code: "INVALID_FILE_TYPE" }

// Error 422: Text too short
{ detail: "Extracted text is too short", code: "LAB_TEXT_TOO_SHORT" }

// Error 402: Quota exceeded
{ 
  detail: "Biomarker quota exceeded",
  code: "BIOMARKER_QUOTA_EXCEEDED",
  used_by: "2026-05-17T21:28:00Z"  // when quota resets
}
```

---

### STEP 3: PDF Analysis or Text Extraction

#### PATH A: PDF Processing (ClaudePDFAnalyzer)

```python
# File: backend/app/services/claude_pdf_analyzer.py

async def analyze_lab_pdf(pdf_path: str, symptoms: list[str]):
    1. Validate PDF (not empty, < 10MB)
    2. Base64 encode PDF
    3. Call Claude API with:
       - Vision capability (sees PDF as image)
       - Structured prompt for biomarker extraction
       - User symptoms context
    4. Claude returns JSON with:
       - biomarkers: list of extracted markers
       - top_priority: critical issues
       - protocol: supplement recommendations
       - retest_schedule: follow-up schedule
       - summary: key findings
    5. Return structured analysis
```

**Key difference from text:**
- Claude can see the visual layout of the lab report
- Better accuracy with lab logos and formatting
- Handles different lab report styles

---

#### PATH B: Text Extraction (extract_biomarkers)

```python
# File: backend/app/services/claude_service.py

async def extract_biomarkers(text: str, symptoms: list[str]):
    1. Normalize text (remove nulls, collapse whitespace)
    2. Call Claude API with:
       - Raw lab text
       - Same biomarker extraction prompt
       - User symptoms context
    3. Claude returns JSON (same structure as PDF)
    4. Return biomarkers with categorization
```

**Key difference:**
- Works with plain text extracted by OCR
- Faster processing (no vision encoding)
- Uses same prompt structure as PDF

---

### STEP 4: Claude Analysis (Detailed)

**Claude Prompt Structure:**

```
1. SYSTEM: "You are an expert medical lab analyst"

2. ANALYSIS REQUIREMENTS:
   - Extract ALL biomarkers with values and reference ranges
   - Categorize each: OPTIMAL, BORDERLINE, DEFICIENT, ELEVATED
   - Identify TOP PRIORITY issues (most critical first)
   - Generate evidence-based supplement protocol
   - Provide retest schedule

3. PROTOCOL REQUIREMENTS:
   - Use specific supplement names
   - Include exact dosages (e.g., "5000 IU")
   - Specify timing (morning with food, etc)
   - Include duration in weeks
   - Explain rationale for each recommendation
   - Reference biomarker values that support each

4. USER CONTEXT:
   - User symptoms if provided
   - Lab name
   - Test date
   - Previous test data if available

5. OUTPUT FORMAT: Return ONLY JSON
```

**Claude Processing:**

```json
{
  "biomarkers": [
    {
      "name": "Vitamin D (25-OH)",
      "value": 18,
      "unit": "ng/mL",
      "ref_low": 30,
      "ref_high": 100,
      "status": "DEFICIENT",
      "category": "vitamins"
    },
    {
      "name": "Hemoglobin",
      "value": 13.2,
      "unit": "g/dL",
      "ref_low": 13.5,
      "ref_high": 17.5,
      "status": "BORDERLINE",
      "category": "blood_health"
    }
  ],
  "top_priority": [
    {
      "biomarker_name": "Vitamin D",
      "current_value": 18,
      "optimal_level": 50,
      "urgency": "HIGH",
      "risk": "Immune dysfunction, bone health, mood disorders"
    }
  ],
  "protocol": [
    {
      "supplement": "Vitamin D3",
      "dosage": "5000 IU",
      "timing": "morning_with_food",
      "frequency": "daily",
      "duration_weeks": 12,
      "priority": "HIGH",
      "rationale": "Address deficiency, improve immune function"
    },
    {
      "supplement": "Iron (with Vitamin C)",
      "dosage": "18 mg",
      "timing": "morning_empty_stomach",
      "frequency": "daily",
      "duration_weeks": 8,
      "priority": "MEDIUM",
      "rationale": "Support hemoglobin production"
    }
  ],
  "retest_schedule": [
    {
      "biomarker": "Vitamin D",
      "weeks": 8,
      "reason": "Check supplementation effectiveness"
    },
    {
      "biomarker": "Hemoglobin",
      "weeks": 6,
      "reason": "Monitor iron supplementation response"
    }
  ],
  "summary": {
    "key_findings": "Primary vitamin D deficiency with borderline hemoglobin",
    "estimated_improvement_timeline": "4-8 weeks with supplementation",
    "lifestyle_recommendations": [
      "Increase sun exposure 20 min/day",
      "Include iron-rich foods in diet"
    ]
  }
}
```

---

### STEP 5: Database Storage

**Table: lab_uploads**
```sql
CREATE TABLE lab_uploads (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  extracted_text TEXT,  -- Raw OCR text or PDF metadata
  lab_name VARCHAR(100),
  test_date DATE,
  ocr_confidence FLOAT,
  status VARCHAR(20),   -- 'processing', 'done', 'failed'
  analysis_method VARCHAR(50),  -- 'claude_pdf' or 'claude_text'
  summary JSONB,        -- Key findings from Claude
  top_priority JSONB,   -- Critical issues
  retest_schedule JSONB,-- When to retest
  biomarker_count INT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Table: biomarkers**
```sql
CREATE TABLE biomarkers (
  id UUID PRIMARY KEY,
  upload_id UUID NOT NULL,  -- Link to lab_uploads
  user_id UUID NOT NULL,
  name VARCHAR(200),        -- "Vitamin D (25-OH)"
  value FLOAT,              -- 18
  unit VARCHAR(50),         -- "ng/mL"
  ref_low FLOAT,            -- 30
  ref_high FLOAT,           -- 100
  status VARCHAR(20),       -- 'OPTIMAL', 'BORDERLINE', etc
  category VARCHAR(100),    -- 'vitamins', 'blood_health'
  created_at TIMESTAMP
)
```

**Table: protocols**
```sql
CREATE TABLE protocols (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  upload_id UUID NOT NULL,  -- Link to lab_uploads
  recommendations JSONB,    -- Array of supplement protocols
  prompt_version VARCHAR(50),
  created_at TIMESTAMP
)
```

---

### STEP 6: Frontend Display (Results.jsx)

**Data returned to frontend:**
```javascript
{
  upload_id: "550e8400-e29b-41d4-a716-446655440000",
  biomarkers: [
    {
      id: "...",
      name: "Vitamin D (25-OH)",
      value: 18,
      unit: "ng/mL",
      ref_low: 30,
      ref_high: 100,
      status: "DEFICIENT",
      category: "vitamins"
    },
    // ... more biomarkers
  ],
  top_priority: [...],
  protocol: [...],
  retest_schedule: [...],
  summary: {...},
  analysis_time: 12.5  // seconds
}
```

**Frontend rendering:**

1. **Biomarker sorting:**
   - Sort by status priority: DEFICIENT (0) → ELEVATED (1) → BORDERLINE (2) → OPTIMAL (3)
   - Within same status: sort by importance

2. **Status categorization:**
   ```javascript
   const STATUS_META = {
     DEFICIENT: { color: 'rose', badge: 'bg-rose-50 text-rose-700' },
     ELEVATED: { color: 'orange', badge: 'bg-orange-50 text-orange-700' },
     BORDERLINE: { color: 'amber', badge: 'bg-amber-50 text-amber-700' },
     OPTIMAL: { color: 'emerald', badge: 'bg-emerald-50 text-emerald-700' }
   }
   ```

3. **Visual display per biomarker:**
   ```
   ┌─────────────────────────────────────────────────────┐
   │ Vitamin D (25-OH)                        [DEFICIENT] │
   ├─────────────────────────────────────────────────────┤
   │ Current: 18 ng/mL                                   │
   │ Range:   30 - 100 ng/mL                             │
   │ Status:  ████░░░░░░░░░░░░░░░  (18%)                │
   │ Risk:    Immune dysfunction, bone health            │
   │ Action:  Vitamin D3 5000 IU daily for 12 weeks      │
   └─────────────────────────────────────────────────────┘
   ```

4. **Tabs/Sections:**
   - **Overview Tab:** All biomarkers with visual range bars
   - **Top Priority Tab:** Critical issues with risks
   - **Protocol Tab:** Supplement recommendations with dosages
   - **Trends Tab:** Compare to previous tests (if available)
   - **Retest Tab:** Schedule for follow-up testing

---

## 📈 What Users See

### After Upload: Results Page

**Section 1: Top Priority Issues**
```
🔴 HIGH PRIORITY FINDINGS

Vitamin D (25-OH) Deficiency
├─ Current: 18 ng/mL (optimal: 50)
├─ Risk: Immune dysfunction, mood changes
└─ Action: Start Vitamin D3 5000 IU daily

Hemoglobin Borderline
├─ Current: 13.2 g/dL (should be: 13.5-17.5)
├─ Risk: Fatigue, reduced oxygen capacity
└─ Action: Iron supplementation + dietary changes
```

**Section 2: Complete Biomarker List**
```
All Biomarkers (85 found)

🔴 DEFICIENT (3):
  • Vitamin D (25-OH): 18 ng/mL [30-100]
  • Iron: 12 mcg/dL [15-30]
  • B12: 180 pg/mL [200-900]

🟡 BORDERLINE (5):
  • Hemoglobin: 13.2 g/dL [13.5-17.5]
  • Magnesium: 1.8 mg/dL [1.9-2.5]
  • Fasting Glucose: 98 mg/dL [70-100]

🟠 ELEVATED (2):
  • Triglycerides: 180 mg/dL [<150]
  • CRP: 3.2 mg/L [<1.0]

🟢 OPTIMAL (75):
  • White Blood Cells: 7.2 K/uL [4.5-11.0]
  • Albumin: 4.1 g/dL [3.5-5.5]
  ... (71 more)
```

**Section 3: Supplement Protocol**
```
💊 PERSONALIZED PROTOCOL

Priority 1: Vitamin D3
├─ Dosage: 5000 IU daily
├─ Timing: Morning with breakfast
├─ Duration: 12 weeks
├─ Rationale: Your D level is low (18), optimal is 50
├─ Benefits: Immune support, bone health, mood
└─ 🛒 Buy on iHerb (5% discount code included)

Priority 2: Iron + Vitamin C
├─ Dosage: 18 mg iron + 250 mg vitamin C
├─ Timing: Morning on empty stomach
├─ Duration: 8 weeks
├─ Rationale: Support hemoglobin production
└─ 🛒 Buy on iHerb

Priority 3: Magnesium Glycinate
├─ Dosage: 400 mg daily
├─ Timing: Evening before bed
├─ Duration: Ongoing
├─ Rationale: Stress relief, better sleep
└─ 🛒 Buy on iHerb

Note: These recommendations are evidence-based
and should be reviewed with your healthcare provider.
```

**Section 4: Retest Schedule**
```
📋 WHEN TO RETEST

Week 4-6:
  • Vitamin D (check initial response)
  • Iron & Hemoglobin (monitor supplementation)

Week 8:
  • Vitamin D (check effectiveness)
  • Magnesium (verify levels)

Week 12:
  • Full panel retest (see overall progress)
  • Triglycerides (monitor with lifestyle changes)
```

---

## 🔐 Data Security & Privacy

**What is stored:**
- ✅ Lab text (OCR extracted, not original PDF)
- ✅ Extracted biomarkers and values
- ✅ Protocol recommendations
- ✅ Timeline events

**What is NOT stored:**
- ❌ Original PDF files
- ❌ Original lab images
- ❌ Personal health records (only extracted data)
- ❌ Claude API responses (only final JSON)

**Audit trails:**
- All lab uploads logged to audit_logs table
- User, timestamp, action recorded
- Complies with HIPAA/GDPR requirements for healthcare data

---

## ⚡ Performance Characteristics

**Typical analysis times:**
- Text extraction & analysis: **10-20 seconds**
- PDF analysis: **15-30 seconds** (includes vision processing)
- Database storage: **<1 second**
- Frontend rendering: **<1 second**

**Rate limits:**
- Free users: 1 upload per calendar month
- Premium users: Unlimited uploads
- Rate limit: 30 uploads per minute per user

**Quota tracking:**
- Stored in auth_sessions table
- Resets monthly on user's subscription start date
- Premium users bypass quota checks

---

## 🎓 Example: Complete User Journey

```
USER JOURNEY EXAMPLE:

1. User uploads PDF from Quest Labs
   └─> "Quest_Labs_2026_05_15.pdf"

2. Backend processes:
   ├─> Validates PDF format ✓
   ├─> Extracts to base64
   ├─> Calls Claude PDF vision analysis
   └─> Gets biomarker extraction

3. Claude analyzes and returns:
   ├─> 87 biomarkers extracted
   ├─> 3 DEFICIENT markers identified
   ├─> 5 BORDERLINE markers flagged
   ├─> 12 supplement protocols generated
   └─> 6 retest recommendations created

4. System stores:
   ├─> lab_uploads row (with upload metadata)
   ├─> 87 biomarker rows (each marker with status)
   ├─> protocols row (supplement recommendations)
   └─> timeline event (audit trail)

5. Frontend displays:
   ├─> Top 3 critical issues in summary
   ├─> Full 87 biomarkers sorted by status
   ├─> 12 supplement recommendations with dosages
   ├─> 6 retest dates and reasons
   └─> iHerb shopping links for all supplements

6. User actions:
   ├─> Reviews top priority findings
   ├─> Purchases recommended supplements via iHerb
   ├─> Sets calendar reminders for retest dates
   ├─> Shares protocol with doctor
   └─> Returns in 8 weeks with follow-up test

7. Follow-up visit:
   ├─> Upload new lab results
   ├─> System extracts biomarkers again
   ├─> Compares to previous test
   ├─> Shows progress (e.g., Vitamin D: 18 → 42)
   ├─> Adjusts protocol based on improvements
   └─> Celebrates wins (e.g., "Vitamin D Normal! 🎉")
```

---

## 🔧 Technical Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **PDF Upload** | FastAPI/Starlette | File validation & management |
| **PDF Analysis** | Claude API (Vision) | Extract biomarkers from images |
| **Text Analysis** | Claude API (Text) | Extract biomarkers from text |
| **LLM Model** | claude-sonnet-4 | Fast, accurate biomarker extraction |
| **Database** | Supabase (PostgreSQL) | Store uploads, biomarkers, protocols |
| **Frontend** | React + Framer Motion | Display results with animations |
| **State** | React Query | Cache lab results, manage loading |
| **UI Library** | Tailwind CSS | Consistent styling |

---

## 📊 Why This Architecture Works

1. **Flexibility:** Handles both PDF and text uploads
2. **Accuracy:** Claude vision sees actual lab report layout
3. **Speed:** Claude API returns results in 10-30 seconds
4. **Structure:** JSON format ensures consistent data
5. **Scalability:** Database stores unlimited uploads
6. **Privacy:** Original PDFs not stored, only extracted data
7. **User Experience:** Results appear immediately on Results page
8. **Mobile Friendly:** Works on phones, tablets, desktops
9. **Accessibility:** Clear color-coded status indicators
10. **Engagement:** iHerb links + retest reminders keep users engaged

---

**Last Updated:** May 17, 2026  
**Version:** 4.1.1  
**Status:** Production-ready
