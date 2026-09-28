from types import SimpleNamespace

import pytest

from app.services.symptom_rollout import assess_symptom_rollout_readiness


def _settings(**overrides):
    value = {
        "infermedica_enabled": False,
        "infermedica_app_id": "",
        "infermedica_app_key": "",
        "infermedica_base_url": "https://api.infermedica.com/v3",
        "infermedica_store_condition_candidates": False,
        "infermedica_dev_mode": True,
        "symptom_engine_allowlist_user_ids": "",
        "symptom_engine_rollout_percent": 0,
        "symptom_engine_clinical_approval_recorded": False,
        "symptom_engine_privacy_approval_recorded": False,
        "symptom_engine_commercial_approval_recorded": False,
        "symptom_engine_security_approval_recorded": False,
        "symptom_engine_alerting_ready": False,
    }
    value.update(overrides)
    return SimpleNamespace(**value)


def _approved(**overrides):
    return _settings(
        infermedica_enabled=True,
        infermedica_app_id="app-id",
        infermedica_app_key="secret",
        symptom_engine_allowlist_user_ids="internal-user",
        symptom_engine_clinical_approval_recorded=True,
        symptom_engine_privacy_approval_recorded=True,
        symptom_engine_commercial_approval_recorded=True,
        symptom_engine_security_approval_recorded=True,
        symptom_engine_alerting_ready=True,
        **overrides,
    )


def test_disabled_feature_is_safe_to_deploy_without_external_approvals():
    report = assess_symptom_rollout_readiness(
        _settings(), approved_mapping_count=None
    )
    assert report["target"] == "disabled"
    assert report["ready"] is True
    assert report["blockers"] == []


def test_internal_rollout_fails_closed_when_required_gates_are_missing():
    report = assess_symptom_rollout_readiness(
        _settings(infermedica_enabled=True), approved_mapping_count=0
    )
    assert report["target"] == "internal"
    assert report["ready"] is False
    assert "provider_credentials_configured" in report["blockers"]
    assert "approved_mapping_catalog_present" in report["blockers"]
    assert "clinical_approval_recorded" in report["blockers"]
    assert "internal_allowlist_present" in report["blockers"]


def test_approved_internal_allowlist_is_ready_at_zero_percent():
    report = assess_symptom_rollout_readiness(
        _approved(), approved_mapping_count=12
    )
    assert report["target"] == "internal"
    assert report["ready"] is True
    assert report["rollout_percent"] == 0
    assert report["allowlist_count"] == 1


def test_percentage_rollout_requires_supported_step_and_production_provider_mode():
    report = assess_symptom_rollout_readiness(
        _approved(symptom_engine_rollout_percent=7), approved_mapping_count=12
    )
    assert report["target"] == "percentage"
    assert report["ready"] is False
    assert "rollout_step_supported" in report["blockers"]
    assert "production_provider_mode" in report["blockers"]

    ready = assess_symptom_rollout_readiness(
        _approved(symptom_engine_rollout_percent=5, infermedica_dev_mode=False),
        approved_mapping_count=12,
    )
    assert ready["ready"] is True


def test_invalid_explicit_target_is_rejected():
    with pytest.raises(ValueError):
        assess_symptom_rollout_readiness(
            _settings(), approved_mapping_count=None, target="production"
        )
