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


def test_build_deidentified_person_avatar_uses_bands_only():
    avatar = integration.build_deidentified_person_avatar(
        {
            "age": 37,
            "sex": "female",
            "height_cm": 170,
            "weight_kg": 68,
            "goals": ["Energy", "Sleep"],
            "full_name": "Must Not Leak",
        }
    )

    assert avatar == {
        "age_band": "30_39",
        "sex": "female",
        "bmi_band": "healthy_range",
        "goals": ["energy", "sleep"],
    }
    assert "full_name" not in avatar
    assert "height_cm" not in avatar
    assert "weight_kg" not in avatar


def test_build_deidentified_safety_context_uses_flags_not_raw_phi():
    context = integration.build_deidentified_safety_context(
        {
            "pregnancy_status": "pregnant",
            "current_medications": ["metformin"],
            "current_supplements": ["vitamin D"],
            "allergies": "penicillin",
            "prior_diagnoses": "hypothyroidism",
        }
    )

    assert context == {
        "pregnancy_status": "pregnant",
        "has_current_medications": True,
        "current_medication_count": 1,
        "has_current_supplements": True,
        "current_supplement_count": 1,
        "has_known_allergies": True,
        "has_prior_diagnoses": True,
        "safety_context_present": True,
    }
    assert "metformin" not in str(context).lower()
    assert "penicillin" not in str(context).lower()


@pytest.mark.asyncio
async def test_evaluate_biomarkers_with_knowledge_calls_evaluator(monkeypatch):
    captured = {}

    async def _fake_evaluate_health_input(payload, *, user_id=None, persist=True):
        captured["payload"] = payload
        captured["user_id"] = user_id
        captured["persist"] = persist
        return {"matched_rules": [{"rule_key": "rule_low_ferritin_fatigue"}]}

    monkeypatch.setattr(integration, "evaluate_health_input", _fake_evaluate_health_input)
    async def _fake_get_user_profile(_user_id):
        return {
            "age": 37,
            "sex": "female",
            "height_cm": 170,
            "weight_kg": 68,
            "goals": ["energy"],
            "knowledge_learning_consent": True,
        }

    monkeypatch.setattr(integration.supabase, "get_user_profile", _fake_get_user_profile)

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
    assert captured["payload"]["context"]["person_avatar"]["age_band"] == "30_39"
    assert captured["payload"]["context"]["person_avatar"]["bmi_band"] == "healthy_range"
    assert captured["payload"]["context"]["cohort_learning_allowed"] is True
    assert captured["user_id"] == "11111111-1111-1111-1111-111111111111"
    assert captured["persist"] is True


@pytest.mark.asyncio
async def test_evaluate_biomarkers_with_knowledge_accepts_pipeline_profile(monkeypatch):
    captured = {}

    async def _fake_evaluate_health_input(payload, *, user_id=None, persist=True):
        captured["payload"] = payload
        return {"matched_rules": []}

    async def _unexpected_get_user_profile(_user_id):
        raise AssertionError("profile should come from the shared analysis pipeline")

    monkeypatch.setattr(integration, "evaluate_health_input", _fake_evaluate_health_input)
    monkeypatch.setattr(integration.supabase, "get_user_profile", _unexpected_get_user_profile)

    await integration.evaluate_biomarkers_with_knowledge(
        biomarkers=[{"name": "Ferritin", "value": 18, "unit": "ng/mL"}],
        symptoms=[],
        user_id="11111111-1111-1111-1111-111111111111",
        upload_id="upload-1",
        user_profile={
            "age": 37,
            "pregnancy_status": "pregnant",
            "current_medications": ["metformin"],
            "allergies": "penicillin",
        },
    )

    assert captured["payload"]["context"]["person_avatar"]["age_band"] == "30_39"
    assert captured["payload"]["context"]["safety_context"] == {
        "pregnancy_status": "pregnant",
        "has_current_medications": True,
        "current_medication_count": 1,
        "has_known_allergies": True,
        "safety_context_present": True,
    }


@pytest.mark.asyncio
async def test_build_biomarker_extraction_context_is_fail_open(monkeypatch):
    def _raise():
        raise RuntimeError("supabase unavailable")

    monkeypatch.setattr(integration.supabase, "_get_supabase", _raise)

    assert await integration.build_biomarker_extraction_knowledge_context() == ""
