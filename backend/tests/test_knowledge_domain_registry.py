from app.services.knowledge.domain_registry import (
    DOMAIN_REGISTRY_VERSION,
    domain_registry_summary,
    get_domain_definition,
    list_domain_definitions,
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
