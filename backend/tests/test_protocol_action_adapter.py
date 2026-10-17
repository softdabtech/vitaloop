import copy
import json

import pytest

from app.services import supabase_service
from app.services.protocol_action_adapter import adapt_protocol_actions
from app.services.protocol_action_adapter import adapt_protocol_actions_from_frozen_evidence
from app.services.protocol_pipeline_evidence import build_pipeline_frozen_evidence
from tests.test_protocol_action_authorization import (
    with_frozen,
    AUTHENTICATED_PRINCIPAL,
    REPORT_VERSION_ID,
    _action,
    _recommendation,
    _report,
)

PRESENTATION = {"category": "nutrition", "priority": "medium", "source": "guideline_placeholder", "requires_doctor": True,
                "action_id": "v1:protocol-nutrition:iron_followup:0"}


def _real(**overrides):
    return {**_action(), **PRESENTATION, **overrides}


def _install(monkeypatch, report=None, fail=False):
    calls = []

    async def get_report(user_id, report_version_id):
        calls.append(1)
        if fail:
            raise RuntimeError("db down")
        return copy.deepcopy(report or _report())

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)
    return calls


async def _adapt(actions, section="nutrition"):
    return await adapt_protocol_actions(
        protocol={section: actions}, authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID,
    )


def _classes(out):
    return [c["classification"] for c in out["classifications"]]


@pytest.mark.asyncio
async def test_realistic_kb_action_with_presentation_fields_is_authorized_canonically(monkeypatch):
    calls = _install(monkeypatch)
    out = await _adapt([_real()])
    assert _classes(out) == ["GROUNDED"] and len(calls) == 1
    item = out["protocol"]["nutrition"][0]
    assert item["title"] == _recommendation()["title"] and item["body"] == _recommendation()["body"]
    assert item["category"] == "nutrition" and item["action_id"] == PRESENTATION["action_id"]
    assert item["grounding"]["designation"] == "personalized"
    json.dumps(out)


@pytest.mark.asyncio
async def test_null_optional_presentation_fields_do_not_block_a_canonical_action(monkeypatch):
    _install(monkeypatch)
    out = await _adapt([_real(category=None, evidence_level=None, source=None, source_url=None)])
    item = out["protocol"]["nutrition"][0]
    assert _classes(out) == ["GROUNDED"]
    assert all(item.get(field) is None for field in ("category", "evidence_level", "source", "source_url"))


def test_pipeline_only_adapter_uses_current_frozen_evidence_without_a_report_load():
    action = _real()
    biomarker = {
        "name": "Ferritin", "canonical_name": "ferritin", "value": 18,
        "unit": "ng/mL", "status": "DEFICIENT",
    }
    frozen = build_pipeline_frozen_evidence(
        report_version_id=REPORT_VERSION_ID,
        normalized_biomarkers=[biomarker],
        symptom_snapshot=None,
        knowledge_evaluation={
            "matched_rules": [{
                "rule_id": "rule", "rule_key": "low_ferritin", "version": "v1",
                "recommendation_keys": [action["key"]],
                "evidence": [{"type": "lab_marker", "key": "ferritin", "value": 18,
                              "unit": "ng/mL", "matched": True}],
            }],
            "generated_recommendations": [{
                "key": action["key"], "title": action["title"], "body": action["body"],
            }],
        },
    )
    out = adapt_protocol_actions_from_frozen_evidence(
        protocol={"nutrition": [action]}, frozen_evidence=frozen, report_version_id=REPORT_VERSION_ID,
    )
    assert _classes(out) == ["GROUNDED"]
    assert out["protocol"]["nutrition"][0]["title"] == action["title"]


def test_pipeline_adapter_withholds_actions_when_frozen_evidence_is_unavailable():
    out = adapt_protocol_actions_from_frozen_evidence(
        protocol={"nutrition": [_real()]},
        frozen_evidence={"status": "UNAVAILABLE"},
        report_version_id=REPORT_VERSION_ID,
    )
    assert _classes(out) == ["UNSUPPORTED"] and out["protocol"]["nutrition"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad",
    [
        {"metadata": {"instructions": "Take iron 65 mg daily."}},
        {"dosage": "65 mg"},
        {"supplement": "Iron"},
        {"rationale": "Because of iron deficiency."},
        {"timing": "morning"},
        {"category": "Take iron 65 mg"},
        {"source": "Take iron"},
        {"source": "vitamin D deficiency"},
        {"verified": True},
        {"canonical_content": {"title": "x"}},
        {"grounding": {"designation": "general_educational"}},
    ],
)
async def test_hidden_or_unsafe_fields_withhold_whole_action(monkeypatch, bad):
    _install(monkeypatch)
    out = await _adapt([_real(), _real(**bad), _real()])
    assert _classes(out) == ["GROUNDED", "UNSUPPORTED", "GROUNDED"]
    assert len(out["protocol"]["nutrition"]) == 2


@pytest.mark.asyncio
async def test_ai_modified_content_or_other_key_cannot_replace_canonical(monkeypatch):
    _install(monkeypatch)
    out = await _adapt([
        _real(title="Discuss vitamin D follow-up"),
        _real(body="Review ferritin results with a clinician, then take iron."),
        _real(key="vitamin_d_followup"),
        _real(recommendation_key="other"),
    ])
    assert _classes(out) == ["UNSUPPORTED"] * 4
    assert out["protocol"]["nutrition"] == []


@pytest.mark.asyncio
async def test_unsupported_personalized_is_withheld_not_relabelled_educational(monkeypatch):
    _install(monkeypatch)
    out = await _adapt([{"title": "Take more iron", "body": "Your ferritin is low.", "category": "nutrition"}])
    assert _classes(out) == ["UNSUPPORTED"] and out["protocol"]["nutrition"] == []


EDU = {"title": "Sleep basics", "body": "Regular sleep supports general wellbeing."}


@pytest.mark.asyncio
async def test_neutral_education_is_server_designated_and_separate(monkeypatch):
    _install(monkeypatch)
    out = await _adapt([dict(EDU), {**EDU, "category": "lifestyle", "source": "vitaloop_analysis_core"}])
    assert _classes(out) == ["GENERAL_EDUCATIONAL"] * 2
    item = out["protocol"]["nutrition"][0]
    assert item["grounding"] == {"designation": "general_educational", "personalized_claims": False, "evidence_refs": []}
    assert "key" not in item


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad",
    [
        {"grounding": {"designation": "general_educational", "personalized_claims": False}},
        {"grounding": {"designation": "general_educational", "personalized_claims": False, "metadata": {"x": 1}}},
        {"grounding": {"designation": "personalized", "evidence_refs": []}},
        {"source": "Your ferritin is low"},
        {"source": "Please take iron"},
        {"source": "Guidance: Take iron"},
        {"source": "Iron daily"},
        {"source": "Mayo Clinic"},
        {"source": "forged_source"},
        {"source": "AI_PROTOCOL"},
        {"evidence_level": "Take iron daily"},
        {"evidence_level": "clinical_context; take iron"},
        {"category": "iron_daily"},
        {"priority": "take iron now"},
        {"source_url": "http://example.org/x"},
        {"source_url": "https://user:pw@example.org/x"},
        {"source_url": "https://example.org/x y"},
        {"category": "Based on your results"},
        {"source": "Take iron"},
        {"category": "Take_iron_65_mg"},
        {"source_url": "javascript:alert(1)"},
        {"key": "iron_followup"},
        {"title": "Your low iron stores require treatment.", "body": "Sleep."},
        {"body": "Your ferritin is low."},
    ],
)
async def test_educational_trust_boundary_bypasses_are_withheld(monkeypatch, bad):
    _install(monkeypatch)
    out = await _adapt([dict(EDU), {**EDU, **bad}, dict(EDU)])
    assert _classes(out)[0] == "GENERAL_EDUCATIONAL" and _classes(out)[2] == "GENERAL_EDUCATIONAL"
    assert _classes(out)[1] == "UNSUPPORTED"
    assert len(out["protocol"]["nutrition"]) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "source", ["ai_protocol", "vitaloop_analysis_core", "vitaloop_pattern_engine", "vitaloop_context_engine",
               "guideline_placeholder", "clinical_guideline_placeholder", "symptom_check", "deterministic_fallback"],
)
async def test_known_source_identifiers_are_retained(monkeypatch, source):
    _install(monkeypatch)
    out = await _adapt([{**EDU, "source": source, "category": "lifestyle", "evidence_level": "best_practice",
                         "priority": "low", "source_url": "https://example.org/x"}])
    assert _classes(out) == ["GENERAL_EDUCATIONAL"]


@pytest.mark.asyncio
async def test_caller_grounding_on_kb_action_is_rejected(monkeypatch):
    _install(monkeypatch)
    out = await _adapt([_real(grounding={"designation": "general_educational", "personalized_claims": False})])
    assert _classes(out) == ["UNSUPPORTED"] and out["classifications"][0]["reasons"] == ["caller_grounding_untrusted"]


CANONICAL_BODY = (
    "Low ferritin with fatigue may indicate a possible iron deficiency risk. "
    "Consider discussing iron studies and follow-up testing with a clinician."
)


def _canonical_report(body=CANONICAL_BODY):
    report = _report()
    rec = _recommendation(key="iron_followup_discussion", title="Discuss iron status follow-up", body=body)
    report["explainability"]["knowledge_evaluation"]["matched_rules"] = [
        {**report["explainability"]["knowledge_evaluation"]["matched_rules"][0],
         "recommendation_keys": ["iron_followup_discussion"]}
    ]
    report["explainability"]["knowledge_evaluation"]["generated_recommendations"] = [rec]
    return with_frozen(report)


KB_ACTION = {
    "key": "iron_followup_discussion", "title": "Discuss iron status follow-up", "body": CANONICAL_BODY,
    "category": "hematology", "priority": "high", "requires_doctor": False, "evidence_level": "clinical_context",
    "source": "guideline_placeholder", "source_url": "https://example.org/iron-guideline",
}


@pytest.mark.asyncio
async def test_real_canonical_iron_followup_discussion_is_retained(monkeypatch):
    _install(monkeypatch, _canonical_report())
    out = await _adapt([dict(KB_ACTION)])
    assert _classes(out) == ["GROUNDED"]
    assert out["protocol"]["nutrition"][0]["body"] == CANONICAL_BODY


@pytest.mark.asyncio
async def test_forged_or_altered_kb_action_is_withheld_and_safety_still_applies(monkeypatch):
    _install(monkeypatch, _canonical_report())
    out = await _adapt([
        {**KB_ACTION, "body": "Low ferritin means you have iron deficiency anemia."},
        {**KB_ACTION, "body": CANONICAL_BODY + " Take iron 65 mg daily."},
        {**KB_ACTION, "key": "forged_key"},
        {**KB_ACTION, "body": "Iron deficiency: take supplements."},
    ])
    assert _classes(out) == ["UNSUPPORTED"] * 4
    # Canonical text containing a dose is still rejected: KB origin does not bypass safety.
    _install(monkeypatch, _canonical_report(body="Take iron 65 mg daily."))
    out = await _adapt([{**KB_ACTION, "body": "Take iron 65 mg daily."}])
    assert _classes(out) == ["UNSUPPORTED"]


SEVEN = [
    ("kb_rule_action", "nutrition", dict(KB_ACTION)),
    ("pipeline_fallback_keyed", "nutrition", {
        "key": "nutrition_foundation_for_flagged_markers", "title": "Support nutrition basics while reviewing flagged markers",
        "body": "Use a food-first pattern while confirming the cause.", "category": "nutrition", "priority": "medium",
        "evidence_level": "clinical_context", "requires_doctor": False, "source": "vitaloop_analysis_core"}),
    ("ai_supplement_free_text", "supplements", {"supplement": "Vitamin D3", "dosage": "Confirm dose with clinician",
                                                "rationale": "Vitamin D is low.", "category": "supplement"}),
    ("ai_neutral_lifestyle", "lifestyle", {**EDU, "category": "lifestyle", "source": "ai_protocol"}),
    ("ai_neutral_display_name_source", "lifestyle", {**EDU, "source": "NIH Office of Dietary Supplements"}),
    ("ai_lifestyle_with_rationale", "lifestyle", {**EDU, "rationale": "Helps recovery.", "timing": "evening"}),
    ("ai_personalized_unkeyed", "training_recovery", {"title": "Rest", "body": "Your results show fatigue risk; avoid intense training."}),
]
EXPECTED_SEVEN = {
    "kb_rule_action": ("GROUNDED", []),  # trusted KB + authorized
    "pipeline_fallback_keyed": ("UNSUPPORTED", "missing_kb_authorization"),
    "ai_supplement_free_text": ("UNSUPPORTED", "unsupported_ai_only"),
    "ai_neutral_lifestyle": ("GENERAL_EDUCATIONAL", []),
    "ai_neutral_display_name_source": ("UNSUPPORTED", "metadata_incompatibility"),
    "ai_lifestyle_with_rationale": ("UNSUPPORTED", "unsupported_ai_only"),
    "ai_personalized_unkeyed": ("UNSUPPORTED", "unsafe_clinical_content"),
}


@pytest.mark.asyncio
async def test_seven_action_functional_impact(monkeypatch):
    _install(monkeypatch, _canonical_report())
    report = {}
    for name, section, action in SEVEN:
        result = await adapt_protocol_actions(
            protocol={section: [action]}, authenticated_principal=AUTHENTICATED_PRINCIPAL,
            report_version_id=REPORT_VERSION_ID,
        )
        rec = result["classifications"][0]
        report[name] = (rec["classification"], rec["reasons"])
    print("SEVEN_ACTION_REPORT", report)
    assert {k: v[0] for k, v in report.items()} == {k: v[0] for k, v in EXPECTED_SEVEN.items()}
    assert sum(v[0] != "UNSUPPORTED" for v in report.values()) == 2
    assert report["ai_neutral_display_name_source"][1] == ["invalid_presentation_field"]


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [
    "https://example.org:bad/x", "https://.com/x", "https://example..com/x", "https://example.org:0/x",
    "https://example.org:99999/x", "https://example.org:/x", "https://-bad.example.org/x", "https://localhost/x",
    "https://192.168.0.1/x", "https://exa mple.org/x", "https://u:p@example.org/x", "http://example.org/x",
    "ftp://example.org/x", "javascript:alert(1)", "https:///x", "https://example.org\\@evil.com/x",
    "https://exämple.org/x", " https://example.org/x",
])
async def test_malformed_urls_are_withheld(monkeypatch, url):
    _install(monkeypatch)
    out = await _adapt([{**EDU, "source_url": url}])
    assert _classes(out) == ["UNSUPPORTED"]


@pytest.mark.asyncio
@pytest.mark.parametrize("url", ["https://example.org/x", "https://www.who.int/health-topics/laboratory-quality",
                                 "https://sub.example.co.uk:8443/a?b=1#c"])
async def test_valid_https_urls_retained(monkeypatch, url):
    _install(monkeypatch)
    out = await _adapt([{**EDU, "source_url": url}])
    assert _classes(out) == ["GENERAL_EDUCATIONAL"]


@pytest.mark.asyncio
@pytest.mark.parametrize("meta", [
    {"category": "endocrine"}, {"category": "profile"}, {"category": "kidney"}, {"priority": "urgent"},
    {"evidence_level": "clinical_guideline_context"}, {"evidence_level": "moderate"},
    {"source": "clinical_guideline_placeholder"},
])
async def test_existing_internal_metadata_retained(monkeypatch, meta):
    _install(monkeypatch)
    out = await _adapt([{**EDU, **meta}])
    assert _classes(out) == ["GENERAL_EDUCATIONAL"], out["classifications"]


@pytest.mark.asyncio
async def test_unknown_evidence_gives_no_abnormality_authorization(monkeypatch):
    report = _report()
    report["input_snapshot"]["biomarkers"][0]["status"] = "UNKNOWN"
    _install(monkeypatch, report)
    out = await _adapt([_real()])
    assert _classes(out) == ["UNSUPPORTED"]


@pytest.mark.asyncio
async def test_loader_failure_wrong_owner_and_forged_grounding_fail_closed(monkeypatch):
    _install(monkeypatch, fail=True)
    assert _classes(await _adapt([_real()])) == ["UNSUPPORTED"]
    _install(monkeypatch)
    out = await adapt_protocol_actions(
        protocol={"nutrition": [_real()]}, authenticated_principal={"sub": "other"},
        report_version_id=REPORT_VERSION_ID,
    )
    assert _classes(out) == ["UNSUPPORTED"] or out["protocol"]["nutrition"] == []
    forged = _real(grounding={"designation": "personalized", "evidence_refs": []})
    assert _classes(await _adapt([forged])) == ["UNSUPPORTED"]


@pytest.mark.asyncio
async def test_order_and_sections_preserved_with_single_fetch(monkeypatch):
    calls = _install(monkeypatch)
    out = await adapt_protocol_actions(
        protocol={"nutrition": [_real(), {"bad": 1}, _real()], "lifestyle": []},
        authenticated_principal=AUTHENTICATED_PRINCIPAL, report_version_id=REPORT_VERSION_ID,
    )
    assert list(out["protocol"]) == ["nutrition", "lifestyle"]
    assert [(c["section"], c["index"]) for c in out["classifications"]] == [("nutrition", 0), ("nutrition", 1), ("nutrition", 2)]
    assert len(out["protocol"]["nutrition"]) == 2 and len(calls) == 1
