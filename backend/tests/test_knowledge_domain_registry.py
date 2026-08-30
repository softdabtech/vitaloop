import pytest

from app.services.knowledge import domain_registry
from app.services.knowledge.domain_registry import (
    DOMAIN_REGISTRY_VERSION,
    domain_registry_summary,
    get_domain_definition,
    list_domain_definitions,
    load_managed_domain_definitions,
    resolve_domain_definitions,
)


def test_domain_registry_exposes_manageable_health_domains():
    domains = list_domain_definitions()
    summary = domain_registry_summary()
    iron = get_domain_definition("iron_status")

    assert summary["version"] == DOMAIN_REGISTRY_VERSION
    assert summary["domain_count"] == len(domains)
    assert "iron_status" in summary["domains"]
    assert iron is not None
    assert "ferritin" in iron["marker_aliases"]
    assert "Ferritin" in iron["retest_markers"]
    assert iron["evidence_level"] == "clinical_context"
    assert iron["requires_doctor_if_flagged"] is True


@pytest.mark.asyncio
async def test_load_managed_domain_definitions_normalizes_supabase_rows(monkeypatch):
    class _Query:
        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def execute(self):
            return type(
                "Resp",
                (),
                {
                    "data": [
                        {
                            "key": "energy",
                            "label": "Energy",
                            "marker_aliases": ["ferritin"],
                            "symptom_aliases": ["fatigue"],
                            "required_markers": ["ferritin"],
                            "retest_markers": ["Ferritin"],
                            "protocol_sections": ["nutrition"],
                            "expected_timeline": "Retest later.",
                            "evidence_level": "managed",
                            "requires_doctor_if_flagged": True,
                            "version": "managed_v2",
                        }
                    ]
                },
            )()

    class _Client:
        def table(self, name):
            assert name == "knowledge_domain_registry"
            return _Query()

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(domain_registry, "supabase_service", None, raising=False)
    monkeypatch.setattr("app.services.supabase_service._get_supabase", lambda: _Client())
    monkeypatch.setattr("app.services.supabase_service._run", fake_run)

    definitions = await load_managed_domain_definitions()

    assert definitions[0]["key"] == "energy"
    assert definitions[0]["registry_version"] == "managed_v2"
    assert definitions[0]["source"] == "supabase"


@pytest.mark.asyncio
async def test_resolve_domain_definitions_falls_back_to_code_registry(monkeypatch):
    async def empty_managed():
        return []

    monkeypatch.setattr(domain_registry, "load_managed_domain_definitions", empty_managed)

    definitions = await resolve_domain_definitions()

    assert definitions
    assert definitions[0]["registry_version"] == DOMAIN_REGISTRY_VERSION
