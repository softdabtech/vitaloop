import pytest

from app.services.knowledge import integration


def test_biomarkers_to_knowledge_lab_results_maps_known_markers():
    payload = integration.biomarkers_to_knowledge_lab_results(
        [
            {"name": "Ferritin", "value": "18", "unit": "ng/mL", "status": "DEFICIENT"},
            {"name": "Vitamin D", "value": 21, "unit": "ng/mL"},
            {"name": "Ignored", "value": None, "unit": "mg/dL"},
        ]
    )

    assert payload["ferritin"]["value"] == 18.0
    assert payload["ferritin"]["unit"] == "ng/mL"
    assert payload["vitamin_d"]["value"] == 21.0


def test_biomarkers_to_knowledge_lab_results_maps_stage20_display_names():
    payload = integration.biomarkers_to_knowledge_lab_results(
        [
            {"name": "LDL Cholesterol", "value": 142, "unit": "mg/dL", "status": "ELEVATED"},
            {"name": "HDL Cholesterol", "value": 35, "unit": "mg/dL", "status": "DEFICIENT"},
            {"name": "Vitamin D (25-OH)", "value": 18, "unit": "ng/mL", "status": "DEFICIENT"},
            {"name": "Thyroid Stimulating Hormone", "value": 5.2, "unit": "mIU/L", "status": "ELEVATED"},
            {"name": "Alanine Aminotransferase", "value": 75, "unit": "U/L", "status": "ELEVATED"},
        ]
    )

    assert payload["ldl"]["value"] == 142.0
    assert payload["hdl"]["value"] == 35.0
    assert payload["vitamin_d"]["value"] == 18.0
    assert payload["tsh"]["unit"] == "mIU/L"
    assert payload["alt"]["value"] == 75.0


@pytest.mark.asyncio
async def test_evaluate_biomarkers_with_knowledge_calls_evaluator(monkeypatch):
    captured = {}

    async def _fake_evaluate_health_input(payload, *, user_id=None, persist=True):
        captured["payload"] = payload
        captured["user_id"] = user_id
        captured["persist"] = persist
        return {"matched_rules": [{"rule_key": "rule_low_ferritin_fatigue"}]}

    monkeypatch.setattr(integration, "evaluate_health_input", _fake_evaluate_health_input)

    result = await integration.evaluate_biomarkers_with_knowledge(
        biomarkers=[{"name": "Ferritin", "value": 18, "unit": "ng/mL"}],
        symptoms=["fatigue"],
        user_id="11111111-1111-1111-1111-111111111111",
        upload_id="upload-1",
    )

    assert result["matched_rules"][0]["rule_key"] == "rule_low_ferritin_fatigue"
    assert captured["payload"]["lab_results"]["ferritin"]["value"] == 18.0
    assert captured["payload"]["symptoms"] == ["fatigue"]
    assert captured["payload"]["context"]["source"] == "biomarker_analyzer"
    assert captured["user_id"] == "11111111-1111-1111-1111-111111111111"
    assert captured["persist"] is True


@pytest.mark.asyncio
async def test_build_biomarker_extraction_context_is_fail_open(monkeypatch):
    def _raise():
        raise RuntimeError("supabase unavailable")

    monkeypatch.setattr(integration.supabase, "_get_supabase", _raise)

    assert await integration.build_biomarker_extraction_knowledge_context() == ""
