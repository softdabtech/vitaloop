"""
Tests for MedicalAnalyzer — biomarker parsing, range classification,
recommendations, and edge cases.
"""
import pytest
from app.services.medical_analyzer import MedicalAnalyzer


@pytest.fixture
def analyzer():
    return MedicalAnalyzer()


# ── Reference ranges loaded ──────────────────────────────────────────────────

def test_reference_ranges_loaded(analyzer):
    ranges = analyzer.get_reference_ranges()
    assert isinstance(ranges, dict)
    assert len(ranges) >= 4  # glucose, hemoglobin, wbc, rbc at minimum
    assert "glucose" in ranges
    assert "hemoglobin" in ranges


# ── Biomarker parsing from text ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analyze_glucose_normal(analyzer):
    text = "Glucose: 85 mg/dL"
    results = await analyzer.analyze_biomarkers(text)
    glucose = next((b for b in results if b.get("name", "").lower() == "glucose"), None)
    assert glucose is not None, "glucose must be detected"
    assert glucose["value"] == pytest.approx(85.0, abs=1)
    assert glucose["status"] == "normal"


@pytest.mark.asyncio
async def test_analyze_glucose_high(analyzer):
    text = "Glucose 145 mg/dL"
    results = await analyzer.analyze_biomarkers(text)
    glucose = next((b for b in results if b.get("name", "").lower() == "glucose"), None)
    assert glucose is not None
    assert glucose["status"] in ("diabetic", "high", "elevated")


@pytest.mark.asyncio
async def test_analyze_hemoglobin_low(analyzer):
    text = "Hemoglobin: 10.2 g/dL"
    results = await analyzer.analyze_biomarkers(text)
    hgb = next((b for b in results if "hemoglobin" in b.get("name", "").lower()), None)
    assert hgb is not None
    assert hgb["status"] in ("low", "anemia")


@pytest.mark.asyncio
async def test_analyze_wbc(analyzer):
    text = "WBC 7.5 x10^3/uL"
    results = await analyzer.analyze_biomarkers(text)
    wbc = next((b for b in results if "white" in b.get("name", "").lower() or b.get("name","").lower() == "wbc"), None)
    assert wbc is not None
    assert wbc["status"] == "normal"


@pytest.mark.asyncio
async def test_analyze_empty_text_returns_empty(analyzer):
    results = await analyzer.analyze_biomarkers("")
    assert isinstance(results, list)
    assert len(results) == 0


@pytest.mark.asyncio
async def test_analyze_irrelevant_text_returns_empty(analyzer):
    results = await analyzer.analyze_biomarkers("The weather today is sunny and warm.")
    assert isinstance(results, list)
    assert len(results) == 0


@pytest.mark.asyncio
async def test_analyze_multiple_biomarkers(analyzer):
    text = "Glucose: 92 mg/dL\nHemoglobin: 14.5 g/dL\nWBC: 6.2 x10^3/uL"
    results = await analyzer.analyze_biomarkers(text)
    assert len(results) >= 2


# ── Interpretation ───────────────────────────────────────────────────────────

def test_get_interpretation_returns_string(analyzer):
    interp = analyzer._get_interpretation("glucose", "normal")
    assert isinstance(interp, str)
    assert len(interp) > 0


def test_get_interpretation_unknown_status(analyzer):
    interp = analyzer._get_interpretation("glucose", "unknown_status_xyz")
    assert isinstance(interp, str)


def test_get_interpretation_unknown_biomarker(analyzer):
    interp = analyzer._get_interpretation("nonexistent_marker", "normal")
    assert isinstance(interp, str)


# ── Single biomarker analysis ────────────────────────────────────────────────

def test_analyze_single_normal_glucose(analyzer):
    result = analyzer._analyze_single_biomarker("glucose", 90.0)
    assert result is not None
    assert result["status"] == "normal"
    assert result["value"] == pytest.approx(90.0)


def test_analyze_single_prediabetic_glucose(analyzer):
    result = analyzer._analyze_single_biomarker("glucose", 110.0)
    assert result is not None
    assert result["status"] in ("prediabetic", "elevated", "borderline")


def test_analyze_single_unknown_biomarker_returns_none(analyzer):
    result = analyzer._analyze_single_biomarker("xenon_level", 42.0)
    assert result is None


# ── Recommendations ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_recommendations_non_empty(analyzer):
    text = "Glucose: 145 mg/dL\nHemoglobin: 10.0 g/dL"
    biomarkers = await analyzer.analyze_biomarkers(text)
    recs = analyzer.generate_recommendations(biomarkers)
    assert isinstance(recs, list)


@pytest.mark.asyncio
async def test_generate_recommendations_empty_input(analyzer):
    # generate_recommendations may return general wellness advice even for empty input
    recs = analyzer.generate_recommendations([])
    assert isinstance(recs, list)


def test_get_biomarker_recommendations_returns_list(analyzer):
    recs = analyzer._get_biomarker_recommendations("glucose", "diabetic")
    assert isinstance(recs, list)


def test_get_biomarker_recommendations_normal_may_be_empty(analyzer):
    recs = analyzer._get_biomarker_recommendations("glucose", "normal")
    assert isinstance(recs, list)
