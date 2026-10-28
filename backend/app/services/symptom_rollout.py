"""Executable release gate for the structured symptom engine.

The flags in this module record that an external review happened; they do not
replace that review.  The feature's hard-off switch remains authoritative.
"""

from __future__ import annotations

from typing import Any


ROLLOUT_STEPS = (0, 1, 5, 10, 25, 50, 100)


def rollout_target(settings: Any) -> str:
    if not bool(settings.infermedica_enabled):
        return "disabled"
    if int(settings.symptom_engine_rollout_percent) == 0:
        return "internal"
    return "percentage"


def assess_symptom_rollout_readiness(
    settings: Any,
    *,
    approved_mapping_count: int | None,
    target: str = "auto",
) -> dict[str, Any]:
    resolved_target = rollout_target(settings) if target == "auto" else target
    if resolved_target not in {"disabled", "internal", "percentage"}:
        raise ValueError("target must be auto, disabled, internal, or percentage")

    percent = int(settings.symptom_engine_rollout_percent)
    allowlist_count = len(
        {
            value.strip()
            for value in str(settings.symptom_engine_allowlist_user_ids or "").split(",")
            if value.strip()
        }
    )
    checks = {
        "hard_switch_enabled": bool(settings.infermedica_enabled),
        "provider_credentials_configured": bool(
            str(settings.infermedica_app_id or "").strip()
            and str(settings.infermedica_app_key or "").strip()
        ),
        "provider_base_url_https": str(settings.infermedica_base_url or "").startswith("https://"),
        "condition_candidate_storage_disabled": not bool(
            settings.infermedica_store_condition_candidates
        ),
        "approved_mapping_catalog_present": bool(
            approved_mapping_count is not None and approved_mapping_count > 0
        ),
        "clinical_approval_recorded": bool(
            settings.symptom_engine_clinical_approval_recorded
        ),
        "privacy_approval_recorded": bool(
            settings.symptom_engine_privacy_approval_recorded
        ),
        "commercial_approval_recorded": bool(
            settings.symptom_engine_commercial_approval_recorded
        ),
        "security_approval_recorded": bool(
            settings.symptom_engine_security_approval_recorded
        ),
        "alerting_ready": bool(settings.symptom_engine_alerting_ready),
        "rollout_step_supported": percent in ROLLOUT_STEPS,
        "internal_allowlist_present": allowlist_count > 0,
        "production_provider_mode": not bool(settings.infermedica_dev_mode),
    }

    blockers: list[str] = []
    if resolved_target == "disabled":
        if checks["hard_switch_enabled"]:
            blockers.append("hard_switch_must_be_disabled")
    else:
        required = (
            "hard_switch_enabled",
            "provider_credentials_configured",
            "provider_base_url_https",
            "condition_candidate_storage_disabled",
            "approved_mapping_catalog_present",
            "clinical_approval_recorded",
            "privacy_approval_recorded",
            "commercial_approval_recorded",
            "security_approval_recorded",
            "alerting_ready",
            "rollout_step_supported",
        )
        blockers.extend(key for key in required if not checks[key])
        if resolved_target == "internal":
            if percent != 0:
                blockers.append("internal_rollout_percent_must_be_zero")
            if not checks["internal_allowlist_present"]:
                blockers.append("internal_allowlist_present")
        if resolved_target == "percentage":
            if percent <= 0:
                blockers.append("percentage_rollout_must_be_above_zero")
            if not checks["production_provider_mode"]:
                blockers.append("production_provider_mode")

    return {
        "version": "symptom_rollout_gate_v1",
        "target": resolved_target,
        "ready": not blockers,
        "rollout_percent": percent,
        "allowlist_count": allowlist_count,
        "approved_mapping_count": approved_mapping_count,
        "checks": checks,
        "blockers": blockers,
    }
