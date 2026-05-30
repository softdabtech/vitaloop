from app.schemas.partners.results import PartnerResultIngestRequest
from app.services.lab_adapters.smartlab import SmartlabAdapter


def test_smartlab_adapter_maps_to_canonical_biomarkers():
    adapter = SmartlabAdapter()
    request = PartnerResultIngestRequest(
        partner_slug="smartlab",
        external_patient_id="P-1",
        external_order_id="O-1",
        external_result_id="R-1",
        lab_name="smartlab",
        lab_result={},
    )

    raw_payload = {
        "biomarkers": [
            {"name": "Vitamin D", "value": 20, "unit": "ng/mL", "ref_low": 30, "ref_high": 100},
            {"name": "Glucose", "value": 90, "unit": "mg/dL", "ref_low": 70, "ref_high": 99},
        ]
    }

    result = adapter.to_canonical(request, raw_payload)

    assert result.partner_slug == "smartlab"
    assert len(result.biomarkers) == 2
    assert result.biomarkers[0].canonical_name == "vitamin_d_25_oh"
    assert result.biomarkers[0].status == "DEFICIENT"
    assert result.biomarkers[1].canonical_name == "glucose"
    assert result.biomarkers[1].status == "OPTIMAL"
