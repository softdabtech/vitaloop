import re
from pathlib import Path

import pytest

from app.services.analysis_input_digest import (
    DigestInputError, PROJECTION_FIELDS, build_persisted_projection, canon_numeric,
    canonical_input_digest,
)

U = "11111111-1111-1111-1111-111111111111"
# Pinned cross-language vectors: tests/db asserts PostgreSQL returns the same values.
V1 = "47ccabeba259a06cc599fb601e120988624fd299d618cd9da91bebd95b5eb0e4"  # 6-decimal contract
V2 = "997a7f3f1ec419860f84ea34a7b8e1bc9bfa5f08792e0a18e211d779d9116299"  # 6-decimal contract


def row(**k):
    d = dict(name="Ferritin", value=45.5, unit="ng/mL", ref_low=30, ref_high=400, status="OPTIMAL",
             category=None, canonical_name="ferritin", reference_source=None, unevaluated_reason=None)
    d.update(k)
    return d


def dig(rows, **k):
    a = dict(upload_id=U, locale="en", pipeline_version="v1", projection=rows)
    a.update(k)
    return canonical_input_digest(**a)


def test_pinned_vectors():
    assert dig([row()]) == V1
    rows = [row(name="Вітамін D", value=-9999999.999, ref_low=None, ref_high=0.0, category="Ліпіди"),
            row(name="B12", value=0, canonical_name="b12")]
    assert dig(rows, locale="uk") == V2


def test_v2_independent_canonical_byte_stream():
    """V2: Independent byte-stream verification before SHA-256 hash.

    Fixture: Вітамін D + B12, uk locale, lowercase UUID.
    Canonical byte stream sorted by name (UTF-8 byte order, "C" collation).
    """
    u = U
    rows = [row(name="Вітамін D", value=-9999999.999, ref_low=None, ref_high=0.0, category="Ліпіди"),
            row(name="B12", value=0, canonical_name="b12")]

    # Expected canonical byte stream (independent construction, sorted by name)
    expected_body = (
        'VLH1;S36:11111111-1111-1111-1111-111111111111;S2:uk;S2:v1;R2;'
        'S3:B12;S8:0.000000;S5:ng/mL;S9:30.000000;S10:400.000000;S7:OPTIMAL;N;S3:b12;N;N;'
        'S9:Вітамін D;S15:-9999999.999000;S5:ng/mL;N;S8:0.000000;S7:OPTIMAL;S6:Ліпіди;S8:ferritin;N;N;'
    )
    import hashlib
    expected_hash = hashlib.sha256(expected_body.encode('utf-8')).hexdigest()

    # Compute actual digest
    actual_hash = dig(rows, locale="uk")

    # Assert both byte stream encoding and final hash
    assert actual_hash == expected_hash
    assert actual_hash == V2


def test_order_independent_and_sensitive():
    a, b = row(), row(name="B12", canonical_name="b12")
    assert dig([a, b]) == dig([b, a])
    assert dig([a]) != dig([row(value=45.6)])
    assert dig([a]) != dig([a], locale="uk")
    assert dig([a]) != dig([a], pipeline_version="v2")
    assert dig([a]) != dig([row(status="ELEVATED")])
    assert dig([row(category=None)]) != dig([row(category="")])


@pytest.mark.parametrize("v,exp", [
    (0, "0.000000"), (-0.0, "0.000000"), (1, "1.000000"), (999999999.999999, "999999999.999999"),
    (45.5, "45.500000"), (45.55555, "45.555550"), (1.5, "1.500000"), (0.000001, "0.000001"), (None, None)
])
def test_canon_numeric(v, exp):
    assert canon_numeric(v) == exp


@pytest.mark.parametrize("v,err", [(1000000000, "numeric_out_of_range"),
                                   ("1.000", "numeric_type"), (True, "numeric_type"),
                                   (float("nan"), "numeric_type"), (float("inf"), "numeric_type")])
def test_canon_numeric_rejects(v, err):
    with pytest.raises(DigestInputError, match=err):
        canon_numeric(v)


def test_duplicate_names_case_insensitive_rejected():
    with pytest.raises(DigestInputError, match="duplicate"):
        dig([row(), row(name="FERRITIN")])


def test_unicode_distinct_names_and_nul():
    assert dig([row(name="é"), row(name="e\u0301")])
    with pytest.raises(DigestInputError):
        dig([row(name="a\x00b")])
    with pytest.raises(DigestInputError):
        dig([row(name="\ud800")])


@pytest.mark.parametrize("bad", [
    {"extra": 1}, {"status": None}, {"unit": ""}, {"value": None}, {"value": "1"}, {"category": 5},
])
def test_projection_mismatch_rejected(bad):
    r = row()
    r.update(bad)
    with pytest.raises(DigestInputError):
        dig([r])


def test_missing_field_rejected():
    r = row()
    del r["category"]
    with pytest.raises(DigestInputError, match="fields"):
        dig([r])


def test_invalid_upload_id():
    with pytest.raises(DigestInputError, match="invalid_uuid"):
        dig([row()], upload_id="nope")


def test_builder_mirrors_save_biomarkers_selection():
    src = {**row(), "assay_qualifier": "x", "reference_range": "1-2", "collected_at": "d", "lab_name": "L"}
    assert build_persisted_projection([src]) == [row()]
    assert set(build_persisted_projection([src])[0]) == set(PROJECTION_FIELDS)
    with pytest.raises(DigestInputError):
        build_persisted_projection([{"name": "x", "value": 1, "unit": "u"}])


def test_sql_projection_fields_match_python():
    sql = (Path(__file__).resolve().parents[1] / "migrations" /
           "20261016120000_atomic_lab_analysis_finalization.sql").read_text()
    for f in PROJECTION_FIELDS:
        assert f"'{f}'" in sql
    assert "<> 10" in sql


def test_sql_accepts_explicit_non_authorizing_frozen_state():
    from app.services import protocol_pipeline_evidence as ppe
    sql = (Path(__file__).resolve().parents[1] / "migrations" /
           "20261016120000_atomic_lab_analysis_finalization.sql").read_text()
    assert ppe.NON_AUTHORIZING_SCHEMA in sql and ppe.NON_AUTHORIZING_REASON in sql
    for k in ppe._NON_AUTHORIZING_FIELDS:
        assert f"'{k}'" in sql


def test_six_decimal_precision():
    assert canon_numeric(45.123456) == "45.123456"
    assert canon_numeric(0.000001) == "0.000001"
    assert canon_numeric(1.5) == "1.500000"
    with pytest.raises(DigestInputError, match="precision_loss"):
        canon_numeric(45.1234567)
    with pytest.raises(DigestInputError, match="out_of_range"):
        canon_numeric(1_000_000_000)


def test_unevaluated_status_and_reason():
    r = row(status="UNEVALUATED", unevaluated_reason="unverified_reference_range")
    assert dig([r])
    r2 = row(status="UNKNOWN")
    assert dig([r2])
    r_bad = row(status="UNKNOWN", unevaluated_reason="test")
    assert dig([r_bad])


def test_byte_level_parity_45_5():
    """45.5 must serialize to exactly "45.500000" for PostgreSQL parity."""
    assert canon_numeric(45.5) == "45.500000"
    # Verify it's in the digest as well
    r = row(value=45.5)
    digest1 = dig([r])
    assert digest1 == V1


def test_v1_canonical_byte_stream():
    """Assert V1 byte stream independently before verifying hash."""
    # Canonical encoding: VLH1;S36:uuid;S2:en;S2:v1;R1;S8:Ferritin;S9:45.500000;...
    # Each field: S<len>:<text> for strings, N for null, numeric in canonical 6-decimal form.
    r = row(value=45.5)

    # Build byte stream manually to verify independent computation
    body = (
        "VLH1;"
        + _enc("11111111-1111-1111-1111-111111111111")
        + _enc("en")
        + _enc("v1")
        + "R1;"
        + _enc("Ferritin")
        + _enc("45.500000")  # canonical 6-decimal form
        + _enc("ng/mL")
        + _enc("30.000000")
        + _enc("400.000000")
        + _enc("OPTIMAL")
        + _enc(None) + _enc("ferritin") + _enc(None) + _enc(None)
    )

    # Expected hash from canonical bytes
    import hashlib
    expected_hash = hashlib.sha256(body.encode('utf-8')).hexdigest()
    assert expected_hash == V1

    # Verify digest computation produces the same hash
    assert dig([r]) == V1


def _enc(value):
    """Helper: encode value for VLH1 byte stream."""
    if value is None:
        return "N;"
    return f"S{len(value)}:{value};"
