from copy import deepcopy
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.routers.protocol import protocol as protocol_router


UPLOAD_ID = UUID("11111111-1111-1111-1111-111111111111")
USER_ID = "22222222-2222-2222-2222-222222222222"


def _setup_protocol_route(monkeypatch, recommendations, *, profile=None, validation=None, cached_protocol=None):
    state = {"saved": None, "generated": recommendations}

    async def no_upload_check(_upload_id, _user_id):
        return {"id": str(UPLOAD_ID)}

    async def no_cached_protocol(_user_id, _upload_id):
        return cached_protocol

    async def get_biomarkers(_upload_id, _user_id):
        return [{"name": "Vitamin D", "value": 18, "status": "DEFICIENT"}]

    async def get_profile(_user_id):
        return profile or {}

    async def load_symptoms(_user_id):
        return None

    async def generate(*, biomarkers, symptoms, **_kwargs):
        assert biomarkers
        assert symptoms == []
        return recommendations

    async def save(*, user_id, upload_id, recommendations, prompt_version=None):
        assert user_id == USER_ID
        assert upload_id == str(UPLOAD_ID)
        rows = recommendations
        state["saved"] = rows
        return {
            "id": "protocol-1",
            "user_id": USER_ID,
            "upload_id": str(UPLOAD_ID),
            "recommendations": rows,
        }

    async def audit(**_kwargs):
        return None

    async def resolve_safety_state(_biomarkers, _profile):
        return {}

    monkeypatch.setattr(protocol_router, "assert_upload_belongs_to_user", no_upload_check)
    monkeypatch.setattr(protocol_router, "get_protocol_by_upload", no_cached_protocol)
    monkeypatch.setattr(protocol_router, "get_biomarkers_by_upload", get_biomarkers)
    monkeypatch.setattr(protocol_router, "get_user_profile", get_profile)
    monkeypatch.setattr(protocol_router, "load_latest_eligible_symptom_snapshot", load_symptoms)
    monkeypatch.setattr(protocol_router, "symptoms_from_snapshot", lambda _snapshot: [])
    monkeypatch.setattr(protocol_router, "generate_protocol", generate)
    monkeypatch.setattr(protocol_router, "save_protocol", save)
    monkeypatch.setattr(protocol_router, "write_audit_log", audit)
    monkeypatch.setattr(protocol_router, "resolve_biomarker_safety_state", resolve_safety_state)
    monkeypatch.setattr(protocol_router, "format_safety_state_for_response", lambda _state: {})
    monkeypatch.setattr(protocol_router, "build_iherb_url", lambda query: f"https://example.test/?q={query}")
    if validation is not None:
        monkeypatch.setattr(protocol_router, "validate_protocol", validation)

    async def invoke():
        return await protocol_router.create_protocol(
            protocol_router.ProtocolRequest(upload_id=UPLOAD_ID),
            current_user={"sub": USER_ID},
            _subscription_check=None,
        )

    return state, invoke


@pytest.mark.asyncio
async def test_dose_in_title_and_nested_content_is_withheld_before_persistence(monkeypatch):
    unsafe_item = {
        "title": "Vitamin D3 5000 IU",
        "supplement": "Vitamin D3",
        "dosage": "Confirm dose with a clinician.",
        "timing": "morning_with_food",
        "priority": "HIGH",
        "rationale": "Discuss suitability with a clinician.",
        "iherb_search": "Vitamin D3 5000 IU",
        "metadata": {"display_text": "5000 IU for deficiency"},
    }
    safe_item = {
        "supplement": "Targeted supplements only after confirmation",
        "dosage": "Discuss any dosing with a qualified clinician after confirmatory labs.",
        "timing": "clinician_review",
        "priority": "MEDIUM",
        "rationale": "Dosing depends on clinical context and contraindications.",
        "iherb_search": "",
    }
    state, invoke = _setup_protocol_route(monkeypatch, [unsafe_item, safe_item])

    response = await invoke()

    assert state["saved"] == [safe_item]
    assert response["recommendations"] == state["saved"]
    assert "5000 IU" not in str(state["saved"])
    assert unsafe_item["title"] == "Vitamin D3 5000 IU"
    assert unsafe_item["metadata"]["display_text"] == "5000 IU for deficiency"


@pytest.mark.asyncio
async def test_sensitive_profile_explicit_dose_is_withheld(monkeypatch):
    item = {
        "supplement": "Iron bisglycinate",
        "dosage": "25 mg daily",
        "timing": "morning_with_food",
        "priority": "HIGH",
        "rationale": "Review iron status.",
        "iherb_search": "Iron bisglycinate 25 mg",
    }
    state, invoke = _setup_protocol_route(
        monkeypatch,
        [item],
        profile={"age": 12, "sex": "female"},
    )

    with pytest.raises(HTTPException) as raised:
        await invoke()
    assert raised.value.detail["code"] == "PROTOCOL_UNSAFE"
    assert state["saved"] is None
    assert item["dosage"] == "25 mg daily"


@pytest.mark.asyncio
async def test_product_strength_in_iherb_query_withholds_recommendation(monkeypatch):
    item = {
        "supplement": "Vitamin D3 5000 IU",
        "dosage": "Confirm dose with a clinician.",
        "timing": "morning_with_food",
        "priority": "MEDIUM",
        "rationale": "Consider the product.",
        "iherb_search": "Vitamin D3 5000 IU",
    }
    state, invoke = _setup_protocol_route(monkeypatch, [item])

    with pytest.raises(HTTPException) as raised:
        await invoke()
    assert raised.value.detail["code"] == "PROTOCOL_UNSAFE"
    assert state["saved"] is None
    assert item["iherb_search"] == "Vitamin D3 5000 IU"


@pytest.mark.asyncio
async def test_unsupported_deficiency_indication_is_withheld(monkeypatch):
    unsafe_item = {
        "title": "Vitamin D3 for deficiency",
        "supplement": "Vitamin D3",
        "dosage": "Discuss with a clinician.",
        "timing": "clinician_review",
        "priority": "LOW",
        "rationale": "Review with a clinician.",
        "iherb_search": "",
    }
    safe_item = {
        "supplement": "Targeted supplements only after confirmation",
        "dosage": "Discuss any dosing with a qualified clinician after confirmatory labs.",
        "timing": "clinician_review",
        "priority": "MEDIUM",
        "rationale": "Dosing depends on clinical context and contraindications.",
        "iherb_search": "",
    }
    state, invoke = _setup_protocol_route(monkeypatch, [unsafe_item, safe_item])

    response = await invoke()

    assert state["saved"] == [safe_item]
    assert response["recommendations"] == [safe_item]
    assert "deficiency" not in str(response["recommendations"]).lower()


@pytest.mark.parametrize(
    "claim_field",
    [
        ("title", "Vitamin D deficiency"),
        ("description", "Vitamin D deficiency"),
        ("metadata", {"clinical_context": {"claim": "Vitamin D deficiency"}}),
    ],
)
@pytest.mark.asyncio
async def test_bare_deficiency_claim_in_any_recommendation_text_is_withheld(monkeypatch, claim_field):
    field, value = claim_field
    unsafe_item = {
        "title": "Vitamin D",
        "supplement": "Vitamin D",
        "dosage": "Discuss dosing with a clinician.",
        "timing": "clinician_review",
        "priority": "LOW",
        "rationale": "Discuss suitability with a clinician.",
        "iherb_search": "",
        field: value,
    }
    state, invoke = _setup_protocol_route(monkeypatch, [unsafe_item])

    with pytest.raises(HTTPException) as raised:
        await invoke()

    assert raised.value.detail["code"] == "PROTOCOL_UNSAFE"
    assert state["saved"] is None
    assert unsafe_item[field] == value


@pytest.mark.asyncio
async def test_neutral_supplement_name_is_not_withheld_as_deficiency_claim(monkeypatch):
    item = {
        "title": "Vitamin D",
        "supplement": "Vitamin D",
        "dosage": "Discuss any dosing with a qualified clinician.",
        "timing": "clinician_review",
        "priority": "LOW",
        "rationale": "Review whether this is appropriate with a clinician.",
        "iherb_search": "",
    }
    state, invoke = _setup_protocol_route(monkeypatch, [item])

    response = await invoke()

    returned = response["recommendations"][0]
    assert returned["title"] == item["title"]
    assert returned.get("withheld_for_safety") is not True
    assert state["saved"] == response["recommendations"]


@pytest.mark.parametrize(
    "field,value",
    [
        ("title", "Vitamin D deficiency"),
        ("description", "Vitamin D deficiency"),
        ("metadata", {"clinical": {"claim": "Vitamin D deficiency"}}),
        ("title", "Vitamin D3 5000 IU"),
        ("metadata", {"strength": "5000 IU"}),
    ],
)
@pytest.mark.asyncio
async def test_generated_recommendation_without_supplement_field_is_withheld(monkeypatch, field, value):
    unsafe_item = {
        "title": "General recommendation",
        "dosage": "Discuss with a clinician.",
        "timing": "clinician_review",
        "priority": "LOW",
        "rationale": "Review suitability with a clinician.",
        field: value,
    }
    state, invoke = _setup_protocol_route(monkeypatch, [unsafe_item])

    with pytest.raises(HTTPException) as raised:
        await invoke()

    assert raised.value.detail["code"] == "PROTOCOL_UNSAFE"
    assert state["saved"] is None
    assert field not in unsafe_item or unsafe_item[field] == value


@pytest.mark.parametrize(
    "field,value",
    [
        ("title", "Vitamin D deficiency"),
        ("description", "Vitamin D deficiency"),
        ("metadata", {"clinical": {"claim": "Vitamin D deficiency"}}),
        ("title", "Vitamin D3 5000 IU"),
        ("metadata", {"strength": "5000 IU"}),
    ],
)
@pytest.mark.asyncio
async def test_cached_recommendation_without_supplement_field_is_withheld_immutably(monkeypatch, field, value):
    unsafe_item = {
        "title": "General recommendation",
        "dosage": "Discuss with a clinician.",
        "timing": "clinician_review",
        "priority": "LOW",
        "rationale": "Review suitability with a clinician.",
        field: value,
    }
    safe_item = {
        "supplement": "Targeted supplements only after confirmation",
        "dosage": "Discuss any dosing with a qualified clinician after confirmatory labs.",
        "timing": "clinician_review",
        "priority": "MEDIUM",
        "rationale": "Dosing depends on clinical context and contraindications.",
        "iherb_search": "",
    }
    cached = {
        "id": "protocol-cached",
        "user_id": USER_ID,
        "upload_id": str(UPLOAD_ID),
        "recommendations": [unsafe_item, safe_item],
    }
    cached_before = deepcopy(cached)
    state, invoke = _setup_protocol_route(monkeypatch, [], cached_protocol=cached)

    response = await invoke()

    assert response["recommendations"] == [safe_item]
    assert cached == cached_before
    assert state["saved"] is None


@pytest.mark.asyncio
async def test_legacy_numeric_non_supplement_recommendation_is_preserved(monkeypatch):
    item = {
        "category": "lifestyle",
        "title": "Daily 30-minute walk",
        "description": "Aim for 30 minutes of comfortable activity.",
        "dosage": "Discuss any changes with a clinician.",
        "timing": "daily",
        "priority": "LOW",
        "rationale": "A general activity suggestion.",
    }
    state, invoke = _setup_protocol_route(monkeypatch, [item])

    response = await invoke()

    returned = response["recommendations"][0]
    assert returned["title"] == item["title"]
    assert returned["description"] == item["description"]
    assert returned.get("withheld_for_safety") is not True
    assert state["saved"] == response["recommendations"]


@pytest.mark.asyncio
async def test_blocked_validation_fails_closed_without_persisting(monkeypatch):
    item = {
        "supplement": "Vitamin D3",
        "dosage": "Confirm with a clinician",
        "timing": "follow_up",
        "priority": "LOW",
        "rationale": "Review the result.",
        "iherb_search": "Vitamin D3",
    }
    state, invoke = _setup_protocol_route(
        monkeypatch,
        [item],
        validation=lambda *_args, **_kwargs: {
            "status": "blocked",
            "warnings": [],
            "blocked_items": [{"key": "blocked"}],
        },
    )

    with pytest.raises(HTTPException) as raised:
        await invoke()

    assert raised.value.status_code == 422
    assert raised.value.detail["code"] == "PROTOCOL_UNSAFE"
    assert state["saved"] is None


@pytest.mark.asyncio
async def test_validator_exception_fails_closed_without_persisting(monkeypatch):
    item = {
        "supplement": "Nutrition foundation",
        "dosage": "Food-first meals; discuss supplements with a clinician.",
        "timing": "daily_with_meals",
        "priority": "LOW",
        "rationale": "Use food sources.",
        "iherb_search": "",
    }

    def fail_validation(*_args, **_kwargs):
        raise RuntimeError("validator unavailable")

    state, invoke = _setup_protocol_route(monkeypatch, [item], validation=fail_validation)

    with pytest.raises(HTTPException) as raised:
        await invoke()

    assert raised.value.status_code == 502
    assert raised.value.detail["code"] == "PROTOCOL_VALIDATION_FAILED"
    assert state["saved"] is None


@pytest.mark.asyncio
async def test_safe_clinician_review_content_passes_validation_and_is_persisted(monkeypatch):
    item = {
        "supplement": "Targeted supplements only after confirmation",
        "dosage": "Discuss any dosing with a qualified clinician after confirmatory labs.",
        "timing": "clinician_review",
        "priority": "MEDIUM",
        "rationale": "Dosing depends on clinical context and contraindications.",
        "iherb_search": "iron b12 folate vitamin d",
    }
    state, invoke = _setup_protocol_route(monkeypatch, [item])

    response = await invoke()

    assert state["saved"] == response["recommendations"]
    assert state["saved"][0]["dosage"] == item["dosage"]
    assert state["saved"][0]["iherb_search"] == ""
    assert "iherb_url" not in state["saved"][0]


@pytest.mark.asyncio
async def test_cached_dose_is_sanitized_in_response_without_rewriting_stored_protocol(monkeypatch):
    unsafe_item = {
        "title": "Vitamin D3 5000 IU for deficiency",
        "supplement": "Vitamin D3",
        "dosage": "5000 IU",
        "timing": "morning_with_food",
        "priority": "HIGH",
        "rationale": "Vitamin D is low.",
        "iherb_search": "Vitamin D3 5000 IU",
        "iherb_url": "https://example.test/?q=Vitamin%20D3%205000%20IU",
        "metadata": {"nested": {"text": "Use 5000 IU for deficiency"}},
    }
    safe_item = {
        "supplement": "Targeted supplements only after confirmation",
        "dosage": "Discuss any dosing with a qualified clinician after confirmatory labs.",
        "timing": "clinician_review",
        "priority": "MEDIUM",
        "rationale": "Dosing depends on clinical context and contraindications.",
        "iherb_search": "",
    }
    cached = {
        "id": "protocol-cached",
        "user_id": USER_ID,
        "upload_id": str(UPLOAD_ID),
        "recommendations": [unsafe_item, safe_item],
    }
    cached_before = deepcopy(cached)
    state, invoke = _setup_protocol_route(monkeypatch, [], cached_protocol=cached)

    response = await invoke()

    assert response["recommendations"] == [safe_item]
    assert "5000 IU" not in str(response["recommendations"])
    assert cached == cached_before
    assert state["saved"] is None


@pytest.mark.asyncio
async def test_cached_bare_deficiency_claim_is_withheld_without_mutating_cache(monkeypatch):
    unsafe_item = {
        "title": "Vitamin D deficiency",
        "supplement": "Vitamin D",
        "dosage": "Discuss dosing with a clinician.",
        "timing": "clinician_review",
        "priority": "LOW",
        "rationale": "Discuss suitability with a clinician.",
        "description": {"clinical_context": "Vitamin D deficiency"},
        "iherb_search": "",
    }
    safe_item = {
        "supplement": "Targeted supplements only after confirmation",
        "dosage": "Discuss any dosing with a qualified clinician after confirmatory labs.",
        "timing": "clinician_review",
        "priority": "MEDIUM",
        "rationale": "Dosing depends on clinical context and contraindications.",
        "iherb_search": "",
    }
    cached = {
        "id": "protocol-cached",
        "user_id": USER_ID,
        "upload_id": str(UPLOAD_ID),
        "recommendations": [unsafe_item, safe_item],
    }
    cached_before = deepcopy(cached)
    state, invoke = _setup_protocol_route(monkeypatch, [], cached_protocol=cached)

    response = await invoke()

    assert response["recommendations"] == [safe_item]
    assert "deficiency" not in str(response["recommendations"]).lower()
    assert cached == cached_before
    assert state["saved"] is None
