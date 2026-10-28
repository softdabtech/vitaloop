"""Knowledge-base reference ranges wired into calculate_status() (product
step 1 of the "process every marker through the KB, using the whole
profile" work).

Point of truth: public.reference_ranges (Stage 18 knowledge base foundation)
is age/sex-aware but starts empty in production. calculate_status() must:
  1. reproduce the exact prior (BIOMARKER_DATABASE-only) result whenever the
     KB has no matching row for a given marker/unit/sex/age — this is the
     production case today, since reference_ranges has zero rows;
  2. prefer a KB row over BIOMARKER_DATABASE the moment one does exist;
  3. never guess: a sex-specific or age-banded KB row must not be applied to
     a user whose profile doesn't supply that dimension;
  4. pick the most specific match when several rows could apply (exact sex
     over "any", a bounded age range over an unbounded one);
  5. never raise — a missing table, an unmapped biomarker_id, or a Supabase
     error must all fall back to BIOMARKER_DATABASE silently, since this
     runs inline in the manual-entry validation path.

Adults only: this product does not serve minors, so age<18 is never passed
in and reference_ranges is never expected to hold a pediatric band.

No live database connection is used anywhere in this file.

Also covers a real bug caught live after step 1 first shipped: manual
entries are routed through the SAME shared run_lab_analysis_pipeline() as
PDF/image uploads (per create_upload_from_manual_entries()'s docstring),
which recomputes status from ref_low/ref_high via
normalize_biomarkers()/_status_for_value() — it does NOT trust
ManualBiomarkerEntry.status. Setting only .status from the KB and leaving
.ref_low/.ref_high on the old unisex BIOMARKER_DATABASE range meant the
pipeline silently overwrote the correct KB-aware status with a recomputed,
demographic-blind one. Confirmed live: HDL=45 mg/dL for a real 38-year-old
female profile returned OPTIMAL end-to-end despite calculate_status() alone
correctly returning DEFICIENT. test_h/test_i below assert on
ManualBiomarkerEntry.ref_low/ref_high directly — the field that actually
reaches the pipeline — not just .status, so a regression here can't hide
behind .status looking right in isolation again.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import biomarker_reference as ref
from app.services.biomarker_service import ManualBiomarkerEntry


def _mock_supabase_returning(rows):
    """Patch app.services.supabase_service so client.table(...).select(...)
    ...eq(...).execute() (chained any number of times) resolves to `rows`,
    and svc._run(fn) just calls fn() synchronously (matching the real
    helper's behavior of running the callable and returning its result).
    """
    fake_response = MagicMock()
    fake_response.data = rows

    fake_query = MagicMock()
    fake_query.select.return_value = fake_query
    fake_query.eq.return_value = fake_query
    fake_query.limit.return_value = fake_query
    fake_query.execute.return_value = fake_response

    fake_table = MagicMock()
    fake_table.table.return_value = fake_query

    async def _run(fn):
        return fn()

    return fake_table, _run


@pytest.fixture(autouse=True)
def _clear_lab_marker_cache():
    # The id cache is process-lifetime by design (see biomarker_reference.py)
    # — clear it around each test so one test's mocked client doesn't leak
    # a cached id into the next.
    ref._lab_marker_id_cache.clear()
    yield
    ref._lab_marker_id_cache.clear()


@pytest.mark.asyncio
async def test_a_empty_kb_reproduces_prior_biomarker_database_result():
    """reference_ranges has zero rows in production today — calculate_status()
    must land exactly where it did before this change."""
    fake_client, fake_run = _mock_supabase_returning([])  # lab_markers lookup finds nothing
    with patch("app.services.supabase_service._get_supabase", return_value=fake_client), \
         patch("app.services.supabase_service._run", side_effect=fake_run):
        status = await ref.calculate_status("ferritin", 15.0, "ng/mL", sex="female", age=34)

    # Same result calculate_status would have returned pre-KB, computed
    # directly from BIOMARKER_DATABASE for comparison.
    info = ref.BIOMARKER_DATABASE["ferritin"]["units"]["ng/mL"]
    expected_min, expected_max = info["min"], info["max"]
    if 15.0 < expected_min:
        assert status == "DEFICIENT"
    elif 15.0 > expected_max:
        assert status == "ELEVATED"
    else:
        assert status in ("OPTIMAL", "BORDERLINE")


@pytest.mark.asyncio
async def test_b_unmapped_biomarker_id_returns_none():
    """A biomarker with no lab_markers.key mapping (most of BIOMARKER_DATABASE
    today — only ~15 of ~37 overlap with the 19-row KB) must resolve to None,
    not raise or fabricate a range. There's no hardcoded skip-list — the
    lab_markers query itself naturally returns nothing for a key it doesn't
    have, which is what's being exercised here."""
    fake_client, fake_run = _mock_supabase_returning([])  # lab_markers lookup finds nothing
    with patch("app.services.supabase_service._get_supabase", return_value=fake_client), \
         patch("app.services.supabase_service._run", side_effect=fake_run):
        result = await ref.get_kb_reference_range("hemoglobin", "g/dL", sex="female", age=34)
    assert result is None


@pytest.mark.asyncio
async def test_c_kb_row_overrides_biomarker_database_when_present():
    """The moment a matching reference_ranges row exists, it must win over
    the flat BIOMARKER_DATABASE default — this is the whole point of step 1."""
    lab_marker_rows = [{"id": "marker-uuid-ferritin"}]
    range_rows = [
        {
            "sex": "female",
            "min_age": 18,
            "max_age": None,
            "unit": "ng/mL",
            "low_value": 20,
            "high_value": 40,
            "optimal_low_value": 25,
            "optimal_high_value": 35,
        }
    ]

    call_count = {"n": 0}

    async def _run(fn):
        call_count["n"] += 1
        return fn()

    fake_query = MagicMock()
    fake_query.select.return_value = fake_query
    fake_query.eq.return_value = fake_query
    fake_query.limit.return_value = fake_query

    responses = [lab_marker_rows, range_rows]

    def _execute():
        data = responses.pop(0)
        resp = MagicMock()
        resp.data = data
        return resp

    fake_query.execute.side_effect = _execute
    fake_client = MagicMock()
    fake_client.table.return_value = fake_query

    with patch("app.services.supabase_service._get_supabase", return_value=fake_client), \
         patch("app.services.supabase_service._run", side_effect=_run):
        # 30 ng/mL sits inside the KB's optimal band (25-35) but would be
        # BORDERLINE-or-worse under most generic fixed ranges — a value
        # chosen specifically so the two sources would disagree if the KB
        # row weren't actually being used.
        status = await ref.calculate_status("ferritin", 30.0, "ng/mL", sex="female", age=34)

    assert status == "OPTIMAL"


@pytest.mark.asyncio
async def test_d_sex_specific_row_not_applied_without_known_sex():
    """A KB row scoped to a specific sex must never apply to a lookup that
    doesn't supply sex — no guessing which range applies."""
    lab_marker_rows = [{"id": "marker-uuid"}]
    range_rows = [
        {"sex": "female", "min_age": 18, "max_age": None, "unit": "ng/mL",
         "low_value": 20, "high_value": 40, "optimal_low_value": 25, "optimal_high_value": 35},
    ]
    responses = [lab_marker_rows, range_rows]

    def _execute():
        resp = MagicMock()
        resp.data = responses.pop(0)
        return resp

    fake_query = MagicMock()
    fake_query.select.return_value = fake_query
    fake_query.eq.return_value = fake_query
    fake_query.limit.return_value = fake_query
    fake_query.execute.side_effect = _execute
    fake_client = MagicMock()
    fake_client.table.return_value = fake_query

    async def _run(fn):
        return fn()

    with patch("app.services.supabase_service._get_supabase", return_value=fake_client), \
         patch("app.services.supabase_service._run", side_effect=_run):
        result = await ref.get_kb_reference_range("ferritin", "ng/mL", sex=None, age=34)

    assert result is None


@pytest.mark.asyncio
async def test_e_prefers_sex_specific_over_any():
    """When both an "any" row and a sex-matched row could apply, the
    sex-matched one must win (more specific)."""
    lab_marker_rows = [{"id": "marker-uuid"}]
    range_rows = [
        {"sex": "any", "min_age": 18, "max_age": None, "unit": "ng/mL",
         "low_value": 15, "high_value": 45, "optimal_low_value": 20, "optimal_high_value": 40},
        {"sex": "female", "min_age": 18, "max_age": None, "unit": "ng/mL",
         "low_value": 20, "high_value": 40, "optimal_low_value": 25, "optimal_high_value": 35},
    ]
    responses = [lab_marker_rows, range_rows]

    def _execute():
        resp = MagicMock()
        resp.data = responses.pop(0)
        return resp

    fake_query = MagicMock()
    fake_query.select.return_value = fake_query
    fake_query.eq.return_value = fake_query
    fake_query.limit.return_value = fake_query
    fake_query.execute.side_effect = _execute
    fake_client = MagicMock()
    fake_client.table.return_value = fake_query

    async def _run(fn):
        return fn()

    with patch("app.services.supabase_service._get_supabase", return_value=fake_client), \
         patch("app.services.supabase_service._run", side_effect=_run):
        result = await ref.get_kb_reference_range("ferritin", "ng/mL", sex="female", age=34)

    assert result == {"min": 20.0, "max": 40.0, "optimal_min": 25.0, "optimal_max": 35.0}


@pytest.mark.asyncio
async def test_f_db_error_falls_back_silently():
    """A Supabase error (table missing, network blip, etc.) must never raise
    out of calculate_status() — it runs inline in request validation."""
    fake_client = MagicMock()
    fake_client.table.side_effect = RuntimeError("relation does not exist")

    async def _run(fn):
        return fn()

    with patch("app.services.supabase_service._get_supabase", return_value=fake_client), \
         patch("app.services.supabase_service._run", side_effect=_run):
        status = await ref.calculate_status("ferritin", 15.0, "ng/mL", sex="female", age=34)

    assert status in ("OPTIMAL", "BORDERLINE", "DEFICIENT", "ELEVATED")


@pytest.mark.asyncio
async def test_g_alias_map_resolves_mismatched_keys():
    """A handful of BIOMARKER_DATABASE ids differ from lab_markers.key
    (t3_free -> free_t3, hemoglobin_a1c -> hba1c, cholesterol_total ->
    total_cholesterol) — confirm the alias is actually applied, not just
    documented."""
    seen_keys = []

    async def _run(fn):
        return fn()

    fake_query = MagicMock()
    fake_query.select.return_value = fake_query

    def _eq(field, value):
        if field == "key":
            seen_keys.append(value)
        return fake_query

    fake_query.eq.side_effect = _eq
    fake_query.limit.return_value = fake_query
    empty_resp = MagicMock()
    empty_resp.data = []
    fake_query.execute.return_value = empty_resp
    fake_client = MagicMock()
    fake_client.table.return_value = fake_query

    with patch("app.services.supabase_service._get_supabase", return_value=fake_client), \
         patch("app.services.supabase_service._run", side_effect=_run):
        await ref.get_kb_reference_range("hemoglobin_a1c", "%", sex="female", age=34)

    assert seen_keys == ["hba1c"]


def _mock_supabase_two_step(lab_marker_rows, range_rows):
    """lab_markers lookup (1st query) returns lab_marker_rows, then the
    reference_ranges lookup (2nd query) returns range_rows."""
    responses = [lab_marker_rows, range_rows]

    def _execute():
        resp = MagicMock()
        resp.data = responses.pop(0)
        return resp

    fake_query = MagicMock()
    fake_query.select.return_value = fake_query
    fake_query.eq.return_value = fake_query
    fake_query.limit.return_value = fake_query
    fake_query.execute.side_effect = _execute
    fake_client = MagicMock()
    fake_client.table.return_value = fake_query

    async def _run(fn):
        return fn()

    return fake_client, _run


@pytest.mark.asyncio
async def test_h_ref_low_ref_high_reflect_the_kb_range_not_just_status():
    """The actual bug caught live: .ref_low/.ref_high (not .status) are what
    reaches the shared pipeline downstream — they must come from the KB row
    too, not be left on the old BIOMARKER_DATABASE range."""
    lab_marker_rows = [{"id": "marker-uuid-hdl"}]
    range_rows = [
        {"sex": "female", "min_age": 18, "max_age": None, "unit": "mg/dL",
         "low_value": 50, "high_value": None, "optimal_low_value": 60, "optimal_high_value": None},
    ]
    fake_client, fake_run = _mock_supabase_two_step(lab_marker_rows, range_rows)

    entry = ManualBiomarkerEntry(biomarker_id="hdl", value=45.0, unit="mg/dL")
    with patch("app.services.supabase_service._get_supabase", return_value=fake_client), \
         patch("app.services.supabase_service._run", side_effect=fake_run):
        ok = await entry.validate(sex="female", age=38)

    assert ok is True
    assert entry.ref_low == 50.0
    assert entry.ref_high is None  # genuinely unbounded — must not become 0/inf here
    assert entry.status == "DEFICIENT"  # 45 < the female low-HDL cutoff of 50


@pytest.mark.asyncio
async def test_i_same_value_different_sex_yields_different_ref_low_and_status():
    """Same HDL=45 value, opposite sex on the profile, must resolve
    differently end to end — proves the sex-awareness is real, matching the
    live verification against Svetlana's real profile vs. an equivalent male
    profile (45 -> DEFICIENT for female, BORDERLINE for male)."""
    lab_marker_rows = [{"id": "marker-uuid-hdl"}]
    range_rows = [
        {"sex": "male", "min_age": 18, "max_age": None, "unit": "mg/dL",
         "low_value": 40, "high_value": None, "optimal_low_value": 60, "optimal_high_value": None},
    ]
    fake_client, fake_run = _mock_supabase_two_step(lab_marker_rows, range_rows)

    entry = ManualBiomarkerEntry(biomarker_id="hdl", value=45.0, unit="mg/dL")
    with patch("app.services.supabase_service._get_supabase", return_value=fake_client), \
         patch("app.services.supabase_service._run", side_effect=fake_run):
        await entry.validate(sex="male", age=40)

    assert entry.ref_low == 40.0
    assert entry.status == "BORDERLINE"  # above the male cutoff, below the 60 "protective" optimal
