# 📋 Refactor: Replace Lab Report OCR with Direct Claude API Analysis

**Status:** Ready for Implementation  
**Date Created:** May 7, 2026  
**Priority:** High  
**Estimated Time:** 4-6 hours  

---

## 📌 Objective

Replace pytesseract/pdfplumber OCR extraction with direct Claude API PDF analysis.
Claude will analyze complete lab reports and generate comprehensive biomarker analysis 
and personalized protocols in one pass.

---

## 🔄 Current State → New State

### BEFORE (Remove this)
```
1. PDF upload
2. OCR extraction (pytesseract, pdfplumber, pdf2image)
3. Text parsing for biomarkers
4. Send parsed text to Claude
5. Return protocol
```

### AFTER (Implement this)
```
1. PDF upload + validation
2. Send PDF directly to Claude API with document support
3. Claude analyzes complete lab report context
4. Claude returns structured JSON with biomarkers + protocol
5. Return comprehensive analysis
```

---

## 🛠️ Implementation Steps

### STEP 1: Update Dependencies

**File:** `requirements.txt`

#### Remove OCR dependencies:
```
- pytesseract
- pdfplumber
- pdf2image
- Pillow (if only for OCR)
```

#### Keep:
```
anthropic>=0.28.0
python-dotenv
(other existing dependencies)
```

---

### STEP 2: Create New Claude PDF Analyzer Service

**File:** `backend/app/services/claude_pdf_analyzer.py`

```python
import base64
import json
import logging
import time
from pathlib import Path
from anthropic import Anthropic, APITimeoutError, APIConnectionError

logger = logging.getLogger("vitaloop.analyzer")


class ClaudePDFAnalyzer:
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.client = Anthropic(api_key=api_key)
        self.model = model
        self.max_tokens = 8192  # Increased from 4096

    async def analyze_lab_pdf(self, pdf_path: str, symptoms: list[str] = None) -> dict:
        """
        Analyze lab report PDF directly with Claude.
        
        Args:
            pdf_path: Path to PDF file
            symptoms: User-reported symptoms for context
            
        Returns:
            {
                "success": bool,
                "biomarkers": [...],
                "top_priority": [...],
                "protocol": [...],
                "retest_schedule": [...],
                "summary": {...},
                "analysis_time": float,
                "biomarker_count": int,
                "analysis_method": "claude_pdf"
            }
        """
        start_time = time.time()
        
        try:
            # Validate PDF
            if not self._validate_pdf(pdf_path):
                raise ValueError("Invalid PDF format or file too large (max 10MB)")
            
            # Read PDF as base64
            pdf_data = self._read_pdf_as_base64(pdf_path)
            
            # Build prompt
            symptoms_text = f"\n\nUser-reported symptoms: {', '.join(symptoms)}" if symptoms else ""
            
            prompt = f"""You are an expert medical lab analyst. Analyze this complete lab report thoroughly and provide structured recommendations.

ANALYSIS REQUIREMENTS:
1. Extract ALL biomarkers with values and reference ranges
2. Categorize each: OPTIMAL, BORDERLINE, DEFICIENT, or ELEVATED
3. Identify TOP PRIORITY issues (most critical first)
4. Generate evidence-based supplement protocol
5. Provide retest schedule

PROTOCOL REQUIREMENTS:
- Use specific supplement names (not generic "take iron")
- Include exact dosages (5000 IU, 25mg, etc)
- Specify timing (morning/evening, with/without food)
- Include duration (number of weeks)
- Explain WHY each recommendation matters
- Reference the specific biomarker value that supports each recommendation

{symptoms_text}

RESPONSE FORMAT: Return ONLY valid JSON (no markdown, no explanation):
{{
    "biomarkers": [
        {{
            "name": "Vitamin D (25-OH)",
            "value": 18,
            "unit": "ng/mL",
            "reference_low": 30,
            "reference_high": 100,
            "status": "DEFICIENT",
            "category": "vitamins",
            "interpretation": "Vitamin D deficiency affects immune function and bone health"
        }}
    ],
    "top_priority": [
        {{
            "biomarker_name": "Vitamin D",
            "current_value": 18,
            "optimal_level": 50,
            "urgency": "HIGH",
            "risk": "Immune dysfunction, bone loss, potential autoimmune issues"
        }}
    ],
    "protocol": [
        {{
            "supplement": "Vitamin D3",
            "dosage": "5000 IU",
            "timing": "morning_with_food",
            "duration_weeks": 12,
            "frequency": "daily",
            "priority": "HIGH",
            "rationale": "Address critical deficiency; improves immune function and bone density",
            "recheck_value_target": 50
        }}
    ],
    "retest_schedule": [
        {{
            "biomarker": "Vitamin D",
            "weeks": 8,
            "reason": "Verify supplementation effectiveness; adjust dose if needed"
        }}
    ],
    "summary": {{
        "key_findings": "Vitamin D deficiency is primary concern requiring immediate supplementation",
        "estimated_improvement_timeline": "4-8 weeks for noticeable improvement; 12 weeks for optimal levels",
        "lifestyle_recommendations": ["Increase sun exposure 15-20 min daily", "Consider vitamin D rich foods"]
    }}
}}"""
            
            # Call Claude API with PDF document
            logger.info(f"Starting Claude analysis for PDF: {Path(pdf_path).name}")
            
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                timeout=120,  # 2 minute timeout
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }]
            )
            
            # Parse response
            analysis_text = response.content[0].text
            
            try:
                protocol = json.loads(analysis_text)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Claude response as JSON: {e}")
                logger.debug(f"Response was: {analysis_text[:500]}")
                raise ValueError("Claude response was not valid JSON")
            
            # Validate response has required fields
            required_fields = ["biomarkers", "protocol", "retest_schedule"]
            if not all(field in protocol for field in required_fields):
                raise ValueError(f"Claude response missing required fields: {required_fields}")
            
            analysis_time = time.time() - start_time
            
            # Log success metrics
            logger.info(
                f"Analysis complete: {len(protocol['biomarkers'])} biomarkers, "
                f"{len(protocol['protocol'])} recommendations, {analysis_time:.1f}s"
            )
            
            # Return response with metadata
            return {
                "success": True,
                "biomarkers": protocol.get("biomarkers", []),
                "top_priority": protocol.get("top_priority", []),
                "protocol": protocol.get("protocol", []),
                "retest_schedule": protocol.get("retest_schedule", []),
                "summary": protocol.get("summary", {}),
                "analysis_time": analysis_time,
                "biomarker_count": len(protocol.get("biomarkers", [])),
                "analysis_method": "claude_pdf"
            }
            
        except APITimeoutError:
            logger.error("Claude API timeout - analysis took too long")
            return {
                "success": False,
                "error": "Analysis timeout - PDF may be too large or complex. Please try again or split into smaller reports.",
                "error_code": "TIMEOUT"
            }
        except APIConnectionError as e:
            logger.error(f"Claude API connection error: {e}")
            return {
                "success": False,
                "error": "Connection error - unable to reach Claude API. Please try again.",
                "error_code": "CONNECTION_ERROR"
            }
        except ValueError as e:
            logger.error(f"Validation error: {e}")
            return {
                "success": False,
                "error": str(e),
                "error_code": "VALIDATION_ERROR"
            }
        except Exception as e:
            logger.error(f"Unexpected error in PDF analysis: {e}", exc_info=True)
            return {
                "success": False,
                "error": "Unexpected error during analysis. Please try again.",
                "error_code": "UNKNOWN_ERROR"
            }

    def _validate_pdf(self, pdf_path: str) -> bool:
        """Validate PDF file exists, is readable, and under size limit."""
        path = Path(pdf_path)
        
        # Check exists
        if not path.exists():
            logger.error(f"PDF not found: {pdf_path}")
            return False
        
        # Check size (max 10MB)
        max_size = 10 * 1024 * 1024
        if path.stat().st_size > max_size:
            logger.error(f"PDF too large: {path.stat().st_size / 1024 / 1024:.1f}MB (max 10MB)")
            return False
        
        # Check extension
        if path.suffix.lower() != ".pdf":
            logger.error(f"Not a PDF file: {path.suffix}")
            return False
        
        return True

    def _read_pdf_as_base64(self, pdf_path: str) -> str:
        """Read PDF file and encode as base64."""
        with open(pdf_path, "rb") as f:
            pdf_content = f.read()
        return base64.standard_b64encode(pdf_content).decode("utf-8")
```

---

### STEP 3: Update Analyze Endpoint

**File:** `backend/app/routers/analysis/analyze.py`

#### Remove old imports:
```python
# REMOVE:
# from app.services.ocr_service import extract_text_from_pdf
# from app.utils.biomarker_parser import parse_biomarkers
```

#### Add new imports:
```python
from app.services.claude_pdf_analyzer import ClaudePDFAnalyzer
from app.config import settings
```

#### Initialize analyzer in startup:
```python
analyzer = None

@app.on_event("startup")
async def init_analyzer():
    global analyzer
    analyzer = ClaudePDFAnalyzer(
        api_key=settings.anthropic_api_key,
        model=settings.anthropic_model
    )
```

#### Update endpoint:
```python
@router.post("/analyze")
async def analyze_lab_report(
    file: UploadFile = File(...),
    symptoms: list[str] = Query(default=[]),
    current_user: dict = Depends(require_freemium_analyze),
):
    """
    Analyze lab report PDF directly with Claude API.
    Returns biomarkers and personalized protocol.
    """
    user_id = current_user["sub"]
    
    try:
        # Save uploaded file temporarily
        temp_path = f"/tmp/{uuid.uuid4()}.pdf"
        with open(temp_path, "wb") as f:
            f.write(await file.read())
        
        # Analyze with Claude
        logger.info(f"Analyzing PDF for user {user_id}")
        analysis = await analyzer.analyze_lab_pdf(temp_path, symptoms)
        
        if not analysis.get("success", False):
            logger.warning(f"Analysis failed: {analysis.get('error')}")
            raise HTTPException(
                status_code=400,
                detail=analysis.get("error", "Unable to analyze PDF")
            )
        
        # Save upload record
        upload_id = str(uuid.uuid4())
        upload_record = await save_lab_upload(
            user_id=user_id,
            extracted_text=json.dumps(analysis),  # Store full analysis
            lab_name=file.filename,
            analysis_method="claude_pdf"
        )
        
        # Save biomarkers
        biomarkers = analysis.get("biomarkers", [])
        await save_biomarkers(upload_id, user_id, biomarkers)
        
        # Log timeline event
        await save_timeline_event(
            user_id=user_id,
            event_type="lab_analyzed",
            summary=f"Lab report analyzed: {len(biomarkers)} biomarkers found"
        )
        
        # Track GA event
        track_event("lab_analysis_completed", {
            "user_id": user_id,
            "biomarker_count": len(biomarkers),
            "analysis_time": analysis.get("analysis_time", 0),
            "analysis_method": "claude_pdf",
            "priority_count": len(analysis.get("top_priority", []))
        })
        
        # Clean up temp file
        os.remove(temp_path)
        
        return {
            "upload_id": upload_id,
            "biomarkers": biomarkers,
            "top_priority": analysis.get("top_priority", []),
            "protocol": analysis.get("protocol", []),
            "retest_schedule": analysis.get("retest_schedule", []),
            "summary": analysis.get("summary", {}),
            "analysis_time": analysis.get("analysis_time", 0),
            "analysis_method": "claude_pdf"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing PDF: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error analyzing lab report")
    finally:
        # Clean up temp file if exists
        if os.path.exists(temp_path):
            os.remove(temp_path)
```

---

### STEP 4: Update Frontend Loading States

**File:** `frontend/src/pages/Upload.jsx`

```javascript
// Update loading messages for better UX during Claude analysis
const loadingMessages = [
    "📤 Uploading your lab report...",
    "🧠 AI is analyzing your biomarkers...",
    "📋 Generating your personalized protocol...",
    "💊 Finalizing supplement recommendations...",
    "✅ Almost ready..."
];

// Show messages progressively
useEffect(() => {
    if (!loading) return;
    
    const intervals = [
        setTimeout(() => setLoadingMessage(loadingMessages[0]), 500),
        setTimeout(() => setLoadingMessage(loadingMessages[1]), 3000),
        setTimeout(() => setLoadingMessage(loadingMessages[2]), 15000),
        setTimeout(() => setLoadingMessage(loadingMessages[3]), 25000),
        setTimeout(() => setLoadingMessage(loadingMessages[4]), 35000),
    ];
    
    return () => intervals.forEach(clearTimeout);
}, [loading]);

// Show warning if taking too long
useEffect(() => {
    if (!loading) return;
    
    const timer = setTimeout(() => {
        setLoadingWarning("This is taking longer than usual. Large PDFs may take 1-2 minutes.");
    }, 60000);  // 60 seconds
    
    return () => clearTimeout(timer);
}, [loading]);
```

---

### STEP 5: Add Configuration Settings

**File:** `backend/app/config.py`

```python
# Claude PDF Analysis Settings
CLAUDE_ANALYSIS_TIMEOUT = 120  # seconds
CLAUDE_MAX_TOKENS = 8192
CLAUDE_PDF_MAX_SIZE_MB = 10
CLAUDE_ANALYSIS_RETRY_COUNT = 2  # Retry failed analyses once
```

---

### STEP 6: Error Handling & Validation

**File:** `backend/app/routers/analysis/analyze.py`

```python
# Handle analysis failures gracefully
if analysis.get("error_code") == "TIMEOUT":
    # Suggest user retry or contact support
    logger.warning(f"PDF analysis timeout for user {user_id}")
    raise HTTPException(
        status_code=408,
        detail="Analysis took too long. Please try again or contact support."
    )
    
if analysis.get("error_code") == "VALIDATION_ERROR":
    # PDF format issue - provide guidance
    logger.warning(f"PDF validation failed: {analysis.get('error')}")
    raise HTTPException(
        status_code=400,
        detail="Please ensure you uploaded a valid lab report PDF"
    )

if analysis.get("error_code") == "CONNECTION_ERROR":
    # Temporary service issue
    logger.error(f"Claude API unavailable")
    raise HTTPException(
        status_code=503,
        detail="Service temporarily unavailable. Please try again."
    )
```

---

## 🧪 Testing Checklist

### Test with Different PDF Types
- [ ] Quest Diagnostics report
- [ ] LabCorp report
- [ ] Wellness report
- [ ] International lab report (different format)
- [ ] Scanned lab report (image-based PDF)

### Verify Response Structure
- [ ] All biomarkers have required fields (name, value, unit, status)
- [ ] Protocol recommendations are specific (not generic)
- [ ] Retest schedule includes weeks + reasons
- [ ] Analysis_time is reasonable (10-60 seconds)
- [ ] Summary includes key findings and timeline

### Error Scenarios
- [ ] Corrupted PDF → Returns appropriate error
- [ ] PDF that's not a lab report → Returns appropriate error
- [ ] PDF larger than 10MB → Returns appropriate error
- [ ] Timeout handling (> 120 seconds) → Returns timeout error
- [ ] Empty PDF → Returns appropriate error

### Performance Validation
- [ ] Small PDF (< 2MB): ~15-30 seconds
- [ ] Medium PDF (2-5MB): ~30-45 seconds
- [ ] Large PDF (5-10MB): ~45-60 seconds
- [ ] Response time < 120 seconds

### GA Tracking Verification
- [ ] `lab_analysis_completed` event fires
- [ ] Event includes: biomarker_count, analysis_time, analysis_method
- [ ] Protocol generation success rate > 95%
- [ ] No duplicate events

---

## 🔧 Environment Variables

**Verify these are set in `.env`:**

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
VITE_API_BASE_URL=http://localhost:8000/api  # or production URL

# Optional (if not already set)
CLAUDE_ANALYSIS_TIMEOUT=120
CLAUDE_MAX_TOKENS=8192
```

---

## 📊 Benefits of This Approach

✅ **Higher Quality Analysis**
- Claude sees complete lab report context
- Can identify patterns humans miss
- Better recommendations based on full picture

✅ **No OCR Errors**
- Works with blurry PDFs
- Handles unusual formats
- No text extraction failures

✅ **Simpler Code**
- Removed 3 OCR libraries
- Removed ~500 lines of parsing code
- Single service to manage

✅ **Better Protocols**
- Claude analyzes, not just parses
- More thoughtful recommendations
- Better explanations

✅ **Consistent Results**
- No variation from OCR quality
- Same quality regardless of PDF format
- Reproducible analysis

✅ **Faster Deployment**
- One API call vs multi-step pipeline
- Easier to debug
- Easier to maintain

---

## 💰 Cost & Performance Considerations

### Pricing
- Claude PDF analysis: ~$0.03-0.10 per report (varies by size)
- Old OCR approach: ~$0.001 per report
- Trade-off: 30-100x cost increase for significant quality improvement

### Performance
- Small PDFs: 15-30 seconds
- Medium PDFs: 30-45 seconds
- Large PDFs: 45-60 seconds
- Max timeout: 120 seconds

### Resource Usage
- Memory: Low (PDF streamed to Claude)
- CPU: Low (just encoding base64)
- Bandwidth: Same as before

---

## 🚀 Deployment Strategy

### Phase 1: Testing (1 day)
1. Implement on staging environment
2. Test with 10+ different lab report PDFs
3. Verify response quality vs OCR approach
4. Check performance metrics

### Phase 2: Canary Deployment (2-3 days)
1. Deploy to production
2. Enable for 10% of users
3. Monitor error rates and latency
4. Collect user feedback

### Phase 3: Full Rollout (1 week)
1. Increase to 50% of users
2. Monitor for issues
3. Increase to 100% of users
4. Keep OCR as fallback for 1-2 weeks

### Rollback Plan
If issues arise:
1. Revert to OCR for new uploads
2. Keep Claude results in DB
3. Investigate failure cause
4. Re-deploy when fixed

---

## 📝 Monitoring & Metrics

### Track These Metrics
- Average analysis time per PDF
- Success rate (% PDFs analyzed successfully)
- Error rate by type (timeout, validation, connection)
- Biomarker count distribution
- User satisfaction score
- Cost per analysis

### Log These Events
- Analysis start/end with timing
- PDF size and format
- Error messages and codes
- User feedback (if available)
- Claude API latency

### Alerts to Set Up
- Analysis timeout rate > 5%
- Success rate < 95%
- Average analysis time > 45 seconds
- API connection errors
- Invalid response format errors

---

## 🎯 Success Criteria

✅ All tests passing
✅ Error rate < 5%
✅ Success rate > 95%
✅ Average analysis time < 45 seconds
✅ User satisfaction improved vs OCR
✅ No increase in support tickets
✅ GA events tracking correctly
✅ Cost per analysis acceptable

---

## ⏱️ Estimated Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Create analyzer service | 1 hour |
| 2 | Update endpoints | 1 hour |
| 3 | Update frontend | 0.5 hours |
| 4 | Error handling | 1 hour |
| 5 | Testing | 2 hours |
| **Total** | | **5-6 hours** |

---

## 📚 Additional Resources

- [Claude API Documentation](https://docs.anthropic.com)
- [PDF Document Support](https://docs.anthropic.com/en/docs/build-a-claude-app/vision)
- [Error Handling Guide](https://docs.anthropic.com/en/docs/build-a-claude-app/errors)
- [Rate Limits](https://docs.anthropic.com/en/docs/resources/rate-limits)

---

## ✅ Final Checklist Before Implementation

- [ ] Requirements.txt updated with Claude PDF support
- [ ] OCR dependencies removed
- [ ] New analyzer service created
- [ ] Analyze endpoint updated
- [ ] Frontend loading states updated
- [ ] Error handling implemented
- [ ] Environment variables documented
- [ ] Tests written and passing
- [ ] GA tracking verified
- [ ] Deployment plan reviewed
- [ ] Team informed of changes
- [ ] Rollback plan documented

---

**Ready to implement!** 🚀
