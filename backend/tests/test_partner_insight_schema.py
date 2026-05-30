from app.schemas.partners.insights import PartnerInsightResponse
from app.services.intelligence.partner_pipeline import build_partner_insights
from app.services.lab_normalization.canonical import CanonicalBiomarker, CanonicalLabResult


def test_partner_insight_payload_matches_response_schema():
    result = CanonicalLabResult(
        partner_slug="smartlab",
        external_patient_id="P-1",
        external_order_id="O-1",
        external_result_id="R-1",
        lab_name="smartlab",
        biomarkers=[
            CanonicalBiomarker(
                canonical_name="vitamin_d_25_oh",
                display_name="Vitamin D",
                value=19.0,
                unit="ng/mL",
                ref_low=30.0,
                ref_high=100.0,
                status="DEFICIENT",
                category="nutrients",
                confidence=1.0,
            )
        ],
    )

    payload = build_partner_insights(result)
    parsed = PartnerInsightResponse.model_validate(payload)

    assert parsed.health_score <= 100
    assert parsed.summary
    assert parsed.doctor_summary
    assert len(parsed.biomarkers) == 1
