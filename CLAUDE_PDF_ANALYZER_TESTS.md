# 📋 Test Suite: Claude PDF Analyzer - Lab Report Analysis

**Purpose:** Comprehensive tests for reading and analyzing lab reports using Claude API  
**Architecture:** Async pytest with mocking and fixtures  
**Coverage Target:** 95%+  
**Status:** Ready for implementation  

---

## 🎯 Test Objectives

✅ Verify Claude PDF analysis works correctly  
✅ Validate response structure and data  
✅ Test error handling and edge cases  
✅ Verify performance within SLA  
✅ Test backward compatibility  
✅ Validate biomarker extraction quality  
✅ Test protocol generation accuracy  
✅ Verify retest scheduling  

---

## 📁 Test File Structure

```
backend/tests/
├── test_claude_pdf_analyzer.py          # Unit tests for analyzer service
├── test_analyze_endpoint.py             # Integration tests for /analyze endpoint
├── test_pdf_validation.py               # PDF validation tests
├── test_biomarker_extraction.py         # Biomarker parsing tests
├── test_protocol_generation.py          # Protocol recommendation tests
├── test_error_handling.py               # Error scenarios
├── test_performance.py                  # Performance/latency tests
├── fixtures/
│   ├── sample_pdfs/
│   │   ├── quest_diagnostics.pdf        # Sample PDF
│   │   ├── labcorp.pdf
│   │   ├── wellness_report.pdf
│   │   ├── corrupted.pdf                # Invalid PDF
│   │   └── non_lab_report.pdf
│   └── mock_responses/
│       ├── claude_response_full.json    # Complete response
│       ├── claude_response_minimal.json # Minimal valid response
│       └── claude_response_invalid.json # Invalid JSON
```

---

## 🧪 Test Suite 1: Unit Tests - Claude PDF Analyzer Service

**File:** `backend/tests/test_claude_pdf_analyzer.py`

```python
import pytest
import json
import base64
import asyncio
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from anthropic import APITimeoutError, APIConnectionError

from app.services.claude_pdf_analyzer import ClaudePDFAnalyzer


@pytest.fixture
def analyzer():
    """Initialize analyzer for testing."""
    return ClaudePDFAnalyzer(
        api_key="sk-ant-test-key",
        model="claude-sonnet-4-20250514"
    )


@pytest.fixture
def sample_pdf_path(tmp_path):
    """Create a temporary PDF file for testing."""
    pdf_file = tmp_path / "sample.pdf"
    # Write minimal PDF structure
    pdf_content = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 100 700 Td (Lab Report) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000210 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
303
%%EOF"""
    pdf_file.write_bytes(pdf_content)
    return str(pdf_file)


@pytest.fixture
def mock_claude_response():
    """Mock Claude API response with valid biomarker analysis."""
    return {
        "biomarkers": [
            {
                "name": "Vitamin D (25-OH)",
                "value": 18,
                "unit": "ng/mL",
                "reference_low": 30,
                "reference_high": 100,
                "status": "DEFICIENT",
                "category": "vitamins",
                "interpretation": "Critical vitamin D deficiency"
            },
            {
                "name": "Ferritin",
                "value": 22,
                "unit": "ng/mL",
                "reference_low": 30,
                "reference_high": 300,
                "status": "BORDERLINE",
                "category": "minerals",
                "interpretation": "Low iron stores"
            },
            {
                "name": "Vitamin B12",
                "value": 450,
                "unit": "pg/mL",
                "reference_low": 200,
                "reference_high": 900,
                "status": "OPTIMAL",
                "category": "vitamins",
                "interpretation": "Optimal B12 levels"
            }
        ],
        "top_priority": [
            {
                "biomarker_name": "Vitamin D",
                "current_value": 18,
                "optimal_level": 50,
                "urgency": "HIGH",
                "risk": "Immune dysfunction, bone loss"
            },
            {
                "biomarker_name": "Ferritin",
                "current_value": 22,
                "optimal_level": 50,
                "urgency": "MEDIUM",
                "risk": "Energy fatigue, anemia risk"
            }
        ],
        "protocol": [
            {
                "supplement": "Vitamin D3",
                "dosage": "5000 IU",
                "timing": "morning_with_food",
                "duration_weeks": 12,
                "frequency": "daily",
                "priority": "HIGH",
                "rationale": "Address critical deficiency",
                "recheck_value_target": 50
            },
            {
                "supplement": "Iron (Ferrous Bisglycinate)",
                "dosage": "25mg elemental",
                "timing": "morning_empty_stomach",
                "duration_weeks": 12,
                "frequency": "daily",
                "priority": "HIGH",
                "rationale": "Support iron stores",
                "recheck_value_target": 50
            }
        ],
        "retest_schedule": [
            {
                "biomarker": "Vitamin D",
                "weeks": 8,
                "reason": "Verify supplementation effectiveness"
            },
            {
                "biomarker": "Ferritin",
                "weeks": 12,
                "reason": "Check iron supplementation response"
            }
        ],
        "summary": {
            "key_findings": "Primary deficiencies in Vitamin D and iron",
            "estimated_improvement_timeline": "4-8 weeks for energy improvement",
            "lifestyle_recommendations": ["Increase sun exposure", "Add iron-rich foods"]
        }
    }


# ═══════════════════════════════════════════════════════════════════════════════
# TEST GROUP 1: PDF Validation
# ═══════════════════════════════════════════════════════════════════════════════

class TestPDFValidation:
    """Test PDF validation before sending to Claude."""
    
    def test_valid_pdf_passes_validation(self, analyzer, sample_pdf_path):
        """Valid PDF should pass validation."""
        assert analyzer._validate_pdf(sample_pdf_path) is True
    
    def test_missing_pdf_fails_validation(self, analyzer):
        """Non-existent PDF should fail validation."""
        assert analyzer._validate_pdf("/nonexistent/file.pdf") is False
    
    def test_non_pdf_file_fails_validation(self, analyzer, tmp_path):
        """Non-PDF files should fail validation."""
        txt_file = tmp_path / "notapdf.txt"
        txt_file.write_text("This is not a PDF")
        assert analyzer._validate_pdf(str(txt_file)) is False
    
    def test_oversized_pdf_fails_validation(self, analyzer, tmp_path):
        """PDFs > 10MB should fail validation."""
        large_file = tmp_path / "large.pdf"
        # Create 11MB file
        large_file.write_bytes(b"x" * (11 * 1024 * 1024))
        assert analyzer._validate_pdf(str(large_file)) is False
    
    def test_max_size_pdf_passes_validation(self, analyzer, tmp_path):
        """PDFs exactly 10MB should pass validation."""
        max_file = tmp_path / "max.pdf"
        max_file.write_bytes(b"x" * (10 * 1024 * 1024))
        assert analyzer._validate_pdf(str(max_file)) is True


# ═══════════════════════════════════════════════════════════════════════════════
# TEST GROUP 2: Base64 Encoding
# ═══════════════════════════════════════════════════════════════════════════════

class TestBase64Encoding:
    """Test PDF to base64 conversion."""
    
    def test_pdf_encoded_correctly(self, analyzer, sample_pdf_path):
        """PDF should be encoded as valid base64."""
        encoded = analyzer._read_pdf_as_base64(sample_pdf_path)
        
        # Should be base64 string
        assert isinstance(encoded, str)
        
        # Should be decodable
        decoded = base64.standard_b64decode(encoded)
        assert len(decoded) > 0
        assert decoded[:4] == b"%PDF"  # Valid PDF header
    
    def test_encoding_is_deterministic(self, analyzer, sample_pdf_path):
        """Same PDF should always encode the same."""
        encoded1 = analyzer._read_pdf_as_base64(sample_pdf_path)
        encoded2 = analyzer._read_pdf_as_base64(sample_pdf_path)
        assert encoded1 == encoded2


# ═══════════════════════════════════════════════════════════════════════════════
# TEST GROUP 3: Claude API Integration
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestClaudeAPIIntegration:
    """Test Claude API calls and response handling."""
    
    async def test_successful_analysis(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Successful PDF analysis should return structured data."""
        # Mock Anthropic client
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        # Analyze
        result = await analyzer.analyze_lab_pdf(sample_pdf_path, symptoms=["fatigue"])
        
        # Verify result structure
        assert result["success"] is True
        assert len(result["biomarkers"]) == 3
        assert len(result["protocol"]) == 2
        assert result["biomarker_count"] == 3
        assert result["analysis_method"] == "claude_pdf"
        assert result["analysis_time"] > 0
    
    async def test_analysis_with_symptoms(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Symptoms should be included in Claude prompt."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        
        captured_args = {}
        async def capture_call(**kwargs):
            captured_args.update(kwargs)
            return mock_response
        
        mock_client.messages.create = AsyncMock(side_effect=capture_call)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        # Analyze with symptoms
        symptoms = ["fatigue", "brain_fog", "poor_sleep"]
        await analyzer.analyze_lab_pdf(sample_pdf_path, symptoms=symptoms)
        
        # Verify symptoms were included in prompt
        messages = captured_args["messages"]
        prompt_text = messages[0]["content"][1]["text"]
        assert "fatigue" in prompt_text
        assert "brain_fog" in prompt_text
        assert "poor_sleep" in prompt_text
    
    async def test_timeout_error_handling(self, analyzer, sample_pdf_path, monkeypatch):
        """Timeout should return appropriate error."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(side_effect=APITimeoutError("Timeout", response=Mock(), body={}))
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert result["success"] is False
        assert result["error_code"] == "TIMEOUT"
        assert "timeout" in result["error"].lower()
    
    async def test_connection_error_handling(self, analyzer, sample_pdf_path, monkeypatch):
        """Connection error should return appropriate error."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(side_effect=APIConnectionError("Connection failed", response=Mock(), body={}))
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert result["success"] is False
        assert result["error_code"] == "CONNECTION_ERROR"
        assert "connection" in result["error"].lower()


# ═══════════════════════════════════════════════════════════════════════════════
# TEST GROUP 4: Response Parsing & Validation
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestResponseParsing:
    """Test Claude response parsing and validation."""
    
    async def test_valid_json_response_parsed(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Valid JSON response should be parsed correctly."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert result["success"] is True
        assert isinstance(result["biomarkers"], list)
        assert isinstance(result["protocol"], list)
    
    async def test_invalid_json_response_error(self, analyzer, sample_pdf_path, monkeypatch):
        """Invalid JSON should return error."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text="Not valid JSON at all")]
        
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert result["success"] is False
        assert result["error_code"] == "VALIDATION_ERROR"
        assert "JSON" in result["error"]
    
    async def test_missing_required_fields_error(self, analyzer, sample_pdf_path, monkeypatch):
        """Response missing required fields should return error."""
        mock_client = AsyncMock()
        mock_response = Mock()
        incomplete_response = {
            "biomarkers": [],
            # Missing "protocol" and "retest_schedule"
        }
        mock_response.content = [Mock(text=json.dumps(incomplete_response))]
        
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert result["success"] is False
        assert "missing" in result["error"].lower()


# ═══════════════════════════════════════════════════════════════════════════════
# TEST GROUP 5: Response Structure Validation
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestResponseStructure:
    """Test that response has correct structure and types."""
    
    async def test_biomarker_structure(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Biomarkers should have required fields."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        for biomarker in result["biomarkers"]:
            assert "name" in biomarker
            assert "value" in biomarker
            assert "unit" in biomarker
            assert "status" in biomarker
            assert biomarker["status"] in ["OPTIMAL", "BORDERLINE", "DEFICIENT", "ELEVATED"]
    
    async def test_protocol_structure(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Protocol recommendations should have required fields."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        for rec in result["protocol"]:
            assert "supplement" in rec
            assert "dosage" in rec
            assert "timing" in rec
            assert "duration_weeks" in rec
            assert "priority" in rec
            assert "rationale" in rec
    
    async def test_retest_schedule_structure(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Retest schedule should have required fields."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        for retest in result["retest_schedule"]:
            assert "biomarker" in retest
            assert "weeks" in retest
            assert isinstance(retest["weeks"], int)
            assert retest["weeks"] > 0
```

---

## 🧪 Test Suite 2: Integration Tests - Analyze Endpoint

**File:** `backend/tests/test_analyze_endpoint.py`

```python
import pytest
import json
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from app.main import app
from app.dependencies import get_current_user, require_freemium_analyze


@pytest.fixture
def test_user():
    """Authenticated test user."""
    return {"sub": "test-user-123", "email": "test@example.com"}


@pytest.fixture
def sample_pdf_file(tmp_path):
    """Create a sample PDF file for upload."""
    pdf_file = tmp_path / "test_report.pdf"
    # Minimal valid PDF
    pdf_content = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
179
%%EOF"""
    pdf_file.write_bytes(pdf_content)
    return pdf_file


@pytest.mark.asyncio
class TestAnalyzeEndpoint:
    """Test /analyze endpoint with Claude PDF analyzer."""
    
    async def test_successful_upload_and_analysis(self, test_user, sample_pdf_file, monkeypatch):
        """Upload PDF and verify analysis response."""
        # Mock Claude analyzer
        mock_analysis = {
            "success": True,
            "biomarkers": [
                {
                    "name": "Vitamin D",
                    "value": 18,
                    "unit": "ng/mL",
                    "reference_low": 30,
                    "reference_high": 100,
                    "status": "DEFICIENT"
                }
            ],
            "protocol": [
                {
                    "supplement": "Vitamin D3",
                    "dosage": "5000 IU",
                    "timing": "morning_with_food",
                    "duration_weeks": 12,
                    "priority": "HIGH",
                    "rationale": "Address deficiency"
                }
            ],
            "retest_schedule": [
                {"biomarker": "Vitamin D", "weeks": 8, "reason": "Verify effectiveness"}
            ],
            "analysis_time": 25.5
        }
        
        mock_analyzer = AsyncMock()
        mock_analyzer.analyze_lab_pdf = AsyncMock(return_value=mock_analysis)
        
        monkeypatch.setattr("app.routers.analysis.analyze.analyzer", mock_analyzer)
        app.dependency_overrides[get_current_user] = lambda: test_user
        app.dependency_overrides[require_freemium_analyze] = lambda: test_user
        
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Upload file
                with open(sample_pdf_file, "rb") as f:
                    response = await client.post(
                        "/analyze",
                        files={"file": ("test.pdf", f, "application/pdf")},
                        params={"symptoms": ["fatigue", "brain_fog"]}
                    )
                
                # Verify response
                assert response.status_code == 200
                data = response.json()
                assert "upload_id" in data
                assert len(data["biomarkers"]) > 0
                assert len(data["protocol"]) > 0
                assert data["analysis_method"] == "claude_pdf"
                assert data["analysis_time"] > 0
        
        finally:
            app.dependency_overrides.clear()
    
    async def test_missing_file_returns_error(self, test_user):
        """Missing file should return 422."""
        app.dependency_overrides[get_current_user] = lambda: test_user
        app.dependency_overrides[require_freemium_analyze] = lambda: test_user
        
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post("/analyze")
                assert response.status_code == 422
        finally:
            app.dependency_overrides.clear()
    
    async def test_analysis_failure_returns_error(self, test_user, sample_pdf_file, monkeypatch):
        """Failed analysis should return 400."""
        mock_analysis = {
            "success": False,
            "error": "Unable to analyze PDF",
            "error_code": "VALIDATION_ERROR"
        }
        
        mock_analyzer = AsyncMock()
        mock_analyzer.analyze_lab_pdf = AsyncMock(return_value=mock_analysis)
        
        monkeypatch.setattr("app.routers.analysis.analyze.analyzer", mock_analyzer)
        app.dependency_overrides[get_current_user] = lambda: test_user
        app.dependency_overrides[require_freemium_analyze] = lambda: test_user
        
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                with open(sample_pdf_file, "rb") as f:
                    response = await client.post(
                        "/analyze",
                        files={"file": ("test.pdf", f, "application/pdf")}
                    )
                
                assert response.status_code == 400
                data = response.json()
                assert "error" in data or "detail" in data
        finally:
            app.dependency_overrides.clear()
```

---

## 🧪 Test Suite 3: Biomarker Extraction Tests

**File:** `backend/tests/test_biomarker_extraction.py`

```python
import pytest
from app.services.claude_pdf_analyzer import ClaudePDFAnalyzer


@pytest.mark.asyncio
class TestBiomarkerExtraction:
    """Test biomarker extraction and validation."""
    
    async def test_all_biomarkers_extracted(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """All biomarkers should be extracted from response."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        # Should extract 3 biomarkers from fixture
        assert len(result["biomarkers"]) == 3
        names = [b["name"] for b in result["biomarkers"]]
        assert "Vitamin D (25-OH)" in names
        assert "Ferritin" in names
        assert "Vitamin B12" in names
    
    async def test_biomarker_values_are_numeric(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Biomarker values should be numeric."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        for biomarker in result["biomarkers"]:
            assert isinstance(biomarker["value"], (int, float))
            assert isinstance(biomarker["reference_low"], (int, float))
            assert isinstance(biomarker["reference_high"], (int, float))
    
    async def test_biomarker_status_validity(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Biomarker status should be valid enum."""
        valid_statuses = ["OPTIMAL", "BORDERLINE", "DEFICIENT", "ELEVATED"]
        
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        for biomarker in result["biomarkers"]:
            assert biomarker["status"] in valid_statuses
```

---

## 🧪 Test Suite 4: Protocol Generation Tests

**File:** `backend/tests/test_protocol_generation.py`

```python
import pytest


@pytest.mark.asyncio
class TestProtocolGeneration:
    """Test protocol recommendation generation."""
    
    async def test_protocol_recommendations_generated(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Protocol should contain supplement recommendations."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert len(result["protocol"]) > 0
        assert len(result["protocol"]) >= len(result["top_priority"])
    
    async def test_protocol_has_specific_dosages(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Protocol should have specific dosages (not generic)."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        for rec in result["protocol"]:
            # Should have specific dosage like "5000 IU" not generic "take it"
            assert rec["dosage"]
            assert any(char.isdigit() for char in rec["dosage"])
            assert rec["timing"] in ["morning_with_food", "evening_with_food", "morning_empty_stomach", "evening_empty_stomach", "daily"]
    
    async def test_protocol_duration_is_realistic(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Protocol duration should be reasonable (4-24 weeks)."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        for rec in result["protocol"]:
            assert 4 <= rec["duration_weeks"] <= 24
    
    async def test_high_priority_items_have_rationale(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """HIGH priority items should have clear rationale."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        high_priority = [rec for rec in result["protocol"] if rec["priority"] == "HIGH"]
        for rec in high_priority:
            assert rec["rationale"]
            assert len(rec["rationale"]) > 20  # Meaningful explanation
```

---

## 🧪 Test Suite 5: Error Handling Tests

**File:** `backend/tests/test_error_handling.py`

```python
import pytest
from unittest.mock import AsyncMock
from anthropic import APITimeoutError, APIConnectionError


@pytest.mark.asyncio
class TestErrorHandling:
    """Test comprehensive error handling."""
    
    async def test_timeout_returns_appropriate_error(self, analyzer, sample_pdf_path, monkeypatch):
        """Timeout should return timeout error, not generic error."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            side_effect=APITimeoutError("Request timed out", response=Mock(), body={})
        )
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert result["success"] is False
        assert result["error_code"] == "TIMEOUT"
        assert "timeout" in result["error"].lower()
    
    async def test_connection_error_returns_appropriate_error(self, analyzer, sample_pdf_path, monkeypatch):
        """Connection error should be distinguishable from timeout."""
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            side_effect=APIConnectionError("Failed to connect", response=Mock(), body={})
        )
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert result["success"] is False
        assert result["error_code"] == "CONNECTION_ERROR"
        assert "connection" in result["error"].lower()
    
    async def test_invalid_json_response(self, analyzer, sample_pdf_path, monkeypatch):
        """Invalid JSON response should return validation error."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text="This is not JSON")]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert result["success"] is False
        assert result["error_code"] == "VALIDATION_ERROR"
    
    async def test_missing_required_fields(self, analyzer, sample_pdf_path, monkeypatch):
        """Missing required response fields should return error."""
        mock_client = AsyncMock()
        mock_response = Mock()
        incomplete = json.dumps({"biomarkers": []})  # Missing protocol, retest_schedule
        mock_response.content = [Mock(text=incomplete)]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert result["success"] is False
        assert "missing" in result["error"].lower() or "required" in result["error"].lower()
```

---

## ⚡ Test Suite 6: Performance Tests

**File:** `backend/tests/test_performance.py`

```python
import pytest
import time


@pytest.mark.asyncio
class TestPerformance:
    """Test performance and latency requirements."""
    
    async def test_analysis_completes_within_sla(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Analysis should complete within 120 second SLA."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        start = time.time()
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        elapsed = time.time() - start
        
        assert elapsed < 120  # SLA is 120 seconds
        assert result["analysis_time"] < 120
    
    async def test_analysis_time_recorded(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Analysis time should be accurately recorded."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        result = await analyzer.analyze_lab_pdf(sample_pdf_path)
        
        assert "analysis_time" in result
        assert isinstance(result["analysis_time"], float)
        assert result["analysis_time"] > 0
    
    async def test_multiple_analyses_independent(self, analyzer, sample_pdf_path, mock_claude_response, monkeypatch):
        """Multiple analyses should be independent and not interfere."""
        mock_client = AsyncMock()
        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(mock_claude_response))]
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        monkeypatch.setattr(analyzer, "client", mock_client)
        
        # Run 3 analyses
        results = []
        for _ in range(3):
            result = await analyzer.analyze_lab_pdf(sample_pdf_path)
            results.append(result)
        
        # All should succeed
        assert all(r["success"] for r in results)
        # All should have same number of biomarkers
        assert all(len(r["biomarkers"]) == len(results[0]["biomarkers"]) for r in results)
```

---

## 📝 Test Fixtures & Helpers

**File:** `backend/tests/conftest.py`

```python
import pytest
import json
from unittest.mock import Mock, AsyncMock


@pytest.fixture
def mock_claude_response():
    """Standard mock Claude response for testing."""
    return {
        "biomarkers": [
            {
                "name": "Vitamin D (25-OH)",
                "value": 18,
                "unit": "ng/mL",
                "reference_low": 30,
                "reference_high": 100,
                "status": "DEFICIENT",
                "category": "vitamins",
                "interpretation": "Critical deficiency"
            },
            {
                "name": "Ferritin",
                "value": 22,
                "unit": "ng/mL",
                "reference_low": 30,
                "reference_high": 300,
                "status": "BORDERLINE",
                "category": "minerals",
                "interpretation": "Low iron stores"
            }
        ],
        "top_priority": [
            {
                "biomarker_name": "Vitamin D",
                "current_value": 18,
                "optimal_level": 50,
                "urgency": "HIGH",
                "risk": "Immune dysfunction"
            }
        ],
        "protocol": [
            {
                "supplement": "Vitamin D3",
                "dosage": "5000 IU",
                "timing": "morning_with_food",
                "duration_weeks": 12,
                "frequency": "daily",
                "priority": "HIGH",
                "rationale": "Address deficiency",
                "recheck_value_target": 50
            }
        ],
        "retest_schedule": [
            {
                "biomarker": "Vitamin D",
                "weeks": 8,
                "reason": "Verify supplementation"
            }
        ],
        "summary": {
            "key_findings": "Vitamin D deficiency",
            "estimated_improvement_timeline": "4-8 weeks",
            "lifestyle_recommendations": ["Increase sun exposure"]
        }
    }
```

---

## ✅ Test Execution & Coverage

### Run All Tests
```bash
pytest backend/tests/test_claude_pdf_analyzer*.py -v
```

### Run Specific Test Suite
```bash
pytest backend/tests/test_analyze_endpoint.py -v
```

### Run with Coverage Report
```bash
pytest backend/tests/test_claude_pdf_analyzer*.py --cov=app.services.claude_pdf_analyzer --cov-report=html
```

### Run Specific Test
```bash
pytest backend/tests/test_claude_pdf_analyzer.py::TestPDFValidation::test_valid_pdf_passes_validation -v
```

---

## 📊 Expected Coverage

| Component | Target | Status |
|-----------|--------|--------|
| PDF Validation | 100% | ✅ |
| Base64 Encoding | 100% | ✅ |
| Claude API Integration | 95%+ | ✅ |
| Response Parsing | 100% | ✅ |
| Biomarker Extraction | 100% | ✅ |
| Protocol Generation | 95%+ | ✅ |
| Error Handling | 100% | ✅ |
| Performance | 90%+ | ✅ |
| **Overall** | **95%+** | ✅ |

---

## 🎯 Success Criteria

✅ All tests passing (100% pass rate)  
✅ Code coverage > 95%  
✅ No warnings or deprecations  
✅ Performance within SLA  
✅ Error handling comprehensive  
✅ Response structure valid  
✅ Biomarker extraction accurate  
✅ Protocol generation quality high  

---

## 📋 Test Execution Checklist

- [ ] All unit tests written
- [ ] All integration tests written
- [ ] All fixtures created
- [ ] Mock data comprehensive
- [ ] Error scenarios covered
- [ ] Performance tests added
- [ ] Coverage > 95%
- [ ] All tests passing
- [ ] No flaky tests
- [ ] Documentation complete
- [ ] Ready for CI/CD

---

**Ready to implement and run tests!** 🚀
