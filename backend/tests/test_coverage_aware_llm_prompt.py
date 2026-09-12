"""Coverage-aware LLM prompt contract (2026-09-12 clinical analyzer audit,
"not implemented yet" item #4).

clinical_context used to summarize marker_coverage as counts only
(no_matching_rule: 26, unit_blocked: 6) — the LLM had no way to know WHICH
markers those were, so nothing stopped it from inferring a conclusion about
e.g. LDL just because the marker was present in the panel, even though no
active rule backs that interpretation. This tests that the prompt actually
names the markers and instructs the model not to interpret them.
"""

import json

import pytest

from app.services import claude_service


@pytest.mark.asyncio
async def test_generate_protocol_prompt_names_uncovered_markers_and_warns_llm(monkeypatch):
    captured = {}

    async def fake_chat_completion(prompt, **kwargs):
        captured["prompt"] = prompt
        return json.dumps([])

    monkeypatch.setattr(claude_service, "is_llm_configured", lambda: True)
    monkeypatch.setattr(claude_service, "_chat_completion", fake_chat_completion)

    clinical_context = {
        "engine_version": "clinical_engine_v1",
        "marker_coverage_summary": {"evaluated": 2, "fired": 1, "no_matching_rule": 2, "unit_blocked": 1, "unknown_status": 0},
        "no_matching_rule_markers": ["ldl", "crp"],
        "unit_blocked_markers": [{"marker": "homocysteine", "reported_unit": "mg/L", "expected_unit": "umol/L"}],
    }

    await claude_service.generate_protocol(
        biomarkers=[{"name": "LDL", "value": 210, "unit": "mg/dL"}],
        symptoms=[],
        locale="en",
        clinical_context=clinical_context,
    )

    prompt = captured["prompt"]
    assert "no_matching_rule_markers" in prompt
    assert "ldl" in prompt
    assert "crp" in prompt
    assert "homocysteine" in prompt
    assert "do not state or imply a clinical interpretation" in prompt.lower()
