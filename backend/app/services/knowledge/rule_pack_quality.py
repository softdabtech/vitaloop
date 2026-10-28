"""Rule Pack Quality Scoring (P26, backend/ops-first v1).

An overlay/reporting layer, not a new detection layer — deterministic
composition over rule_packs.py's existing pack grouping, the same way
P22 evidence_debt.py composes over P14-P21's outputs rather than
re-detecting anything. This module does not touch a single
knowledge_rule, does not change what fires during evaluation
(evaluator.py), and does not gate anything: it answers "how healthy is
this rule pack" for a practitioner/ops reviewer, nothing more.

Reuses:
- rule_packs.py::build_rule_packs -- the pack grouping, per-rule status,
  domain coverage, and reviewer set this module scores.
- governance_coverage.py::_domain_alias_map -- the same canonical domain
  registry, for "how many of the domains this system knows about does
  this pack actually cover" (breadth, not just "how many rules").

Per-pack quality score (0-100, higher is better) is a fixed, documented
weighted sum of five ratios, each already computable from data
rule_packs.py already surfaces:

    active_ratio        (weight 0.30) -- active rules / total rules.
                         A pack that is mostly drafts contributes little
                         to live recommendations today.
    reviewer_coverage    (weight 0.25) -- rules with a recorded
                         medical_reviewed_by / total rules.
    domain_coverage      (weight 0.20) -- distinct domains this pack's
                         rules map to / total domains the system's
                         domain registry knows about. A narrow pack
                         is not necessarily bad, but breadth is a
                         legitimate quality signal for a "general"
                         pack specifically.
    freshness_ratio      (weight 0.15) -- rules reviewed/updated within
                         _FRESHNESS_WINDOW_DAYS (documented limitation:
                         this is a deliberately simple, fixed 365-day
                         window, not a clinically-derived threshold) /
                         total rules.
    non_deprecated_ratio (weight 0.10) -- 1 - (deprecated rules / total
                         rules). Penalizes a pack accumulating retired
                         rules it hasn't cleaned up.

Weights sum to 1.0 and are intentionally simple/inspectable rather than
"tuned" -- this is meant to be read and adjusted by a human reviewing
this file, not treated as a black box. See LIMITATIONS below.

quality_level buckets (fixed thresholds, see _LEVEL_THRESHOLDS):
    score >= 80  -> "strong"
    score >= 60  -> "adequate"
    score >= 40  -> "needs_attention"
    score <  40  -> "weak"
A pack with zero rules gets quality_level "empty" and score None (never
0 -- an empty pack is not "the worst possible pack", it is simply not
measurable yet).

LIMITATIONS (documented, not hidden):
- The 365-day freshness window is an arbitrary, simple default, not a
  clinically-derived staleness threshold; the codebase has no such
  standard, so this module states its assumption instead of pretending
  precision it doesn't have.
- "approved" is not a distinct governance_status in this codebase's
  vocabulary (see rule_packs.py/governance_coverage.py's _STATUS_KEYS:
  draft/reviewed/active/deprecated) -- "active" IS this system's
  approved/live state, so `approved_count` below is an alias for the
  `active` status count, not a fifth status. Documented rather than
  silently invented.
- Domain coverage rewards breadth; it does not (and cannot, from this
  data alone) measure per-domain clinical DEPTH or correctness -- a pack
  covering 8 domains with one weak rule each scores the same on this
  axis as one covering 8 domains thoroughly. This module reports
  structure/governance health, not clinical accuracy.
- No LLM anywhere in this module; every value here is derived
  arithmetically from already-persisted rule fields.

Frozen replay: NOT APPLICABLE. This module is never called from
lab_analysis_pipeline.py, is never persisted into input_snapshot, and
has no relationship to any clinical report. It is ops/governance
visibility only, exactly like llm_cost_audit.py (P28) and
governance_coverage.py (P10) before it.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.knowledge.governance_coverage import _domain_alias_map
from app.services.knowledge.rule_packs import _pack_key_for_rule, build_rule_packs
from app.services.trend_engine import _parse_dt

RULE_PACK_QUALITY_VERSION = "rule_pack_quality_v1"

_FRESHNESS_WINDOW_DAYS = 365

_WEIGHTS = {
    "active_ratio": 0.30,
    "reviewer_coverage": 0.25,
    "domain_coverage": 0.20,
    "freshness_ratio": 0.15,
    "non_deprecated_ratio": 0.10,
}
assert abs(sum(_WEIGHTS.values()) - 1.0) < 1e-9, "quality weights must sum to 1.0"

_LEVEL_THRESHOLDS = (
    (80.0, "strong"),
    (60.0, "adequate"),
    (40.0, "needs_attention"),
)
_LOW_LEVEL = "weak"
_EMPTY_LEVEL = "empty"


def _quality_level(score: Optional[float]) -> str:
    if score is None:
        return _EMPTY_LEVEL
    for threshold, label in _LEVEL_THRESHOLDS:
        if score >= threshold:
            return label
    return _LOW_LEVEL


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _is_fresh(rule: Dict[str, Any], *, now: datetime) -> bool:
    """A rule counts as fresh if EITHER its medical review or its last
    update falls within the freshness window -- a rule can be legitimately
    updated (e.g. a wording fix) without a fresh medical re-review, and
    vice versa; either signal is evidence someone looked at it recently."""
    for field in ("medical_reviewed_at", "updated_at"):
        parsed = _parse_dt(rule.get(field))
        if parsed is not None and (now - parsed).days <= _FRESHNESS_WINDOW_DAYS:
            return True
    return False


def _score_pack(
    pack: Dict[str, Any],
    *,
    raw_rules: List[Dict[str, Any]],
    total_domains: int,
    now: datetime,
) -> Dict[str, Any]:
    # rule_packs.py's own per-rule dicts (pack["rules"]) intentionally
    # carry only a display-oriented subset of fields (id/key/name/
    # governance_status/version/medical_reviewed_by/medical_reviewed_at)
    # -- no updated_at. Freshness needs updated_at as a fallback signal
    # (see _is_fresh's docstring), so this scores against the ORIGINAL raw
    # rule rows for this pack, grouped locally with the same
    # _pack_key_for_rule() rule_packs.py itself uses, rather than the
    # trimmed display copy.
    rules: List[Dict[str, Any]] = raw_rules
    rule_count = len(rules)
    status_counts = pack.get("status_counts") or {}

    active_count = int(status_counts.get("active") or 0)
    reviewed_count = int(status_counts.get("reviewed") or 0)
    draft_count = int(status_counts.get("draft") or 0)
    deprecated_count = int(status_counts.get("deprecated") or 0)

    reviewer_backed_count = len([r for r in rules if isinstance(r, dict) and r.get("medical_reviewed_by")])
    domain_count = len(pack.get("domains") or [])
    stale_rules = [r for r in rules if isinstance(r, dict) and not _is_fresh(r, now=now)]
    fresh_count = rule_count - len(stale_rules)

    if rule_count == 0:
        return {
            "pack_id": pack.get("pack_id"),
            "rule_count": 0,
            "quality_score": None,
            "quality_level": _EMPTY_LEVEL,
            "status_counts": {
                "draft": 0, "reviewed": 0, "active": 0, "deprecated": 0, "approved": 0,
            },
            "reviewer_coverage": {"reviewer_backed_count": 0, "reviewer_backed_ratio": 0.0, "reviewers": []},
            "domain_coverage": {"domain_count": 0, "total_known_domains": total_domains, "domain_coverage_ratio": 0.0, "domains": []},
            "freshness": {
                "fresh_count": 0, "stale_count": 0, "freshness_ratio": 0.0,
                "freshness_window_days": _FRESHNESS_WINDOW_DAYS, "stale_rule_ids": [],
            },
            "score_breakdown": {},
            "improvement_actions": ["This pack has no rules yet -- nothing to score."],
        }

    ratios = {
        "active_ratio": _safe_ratio(active_count, rule_count),
        "reviewer_coverage": _safe_ratio(reviewer_backed_count, rule_count),
        "domain_coverage": _safe_ratio(domain_count, total_domains) if total_domains else 0.0,
        "freshness_ratio": _safe_ratio(fresh_count, rule_count),
        "non_deprecated_ratio": 1.0 - _safe_ratio(deprecated_count, rule_count),
    }
    score_breakdown = {
        key: {"ratio": round(ratio, 4), "weight": _WEIGHTS[key], "contribution": round(ratio * _WEIGHTS[key] * 100, 2)}
        for key, ratio in ratios.items()
    }
    quality_score = round(sum(item["contribution"] for item in score_breakdown.values()), 2)

    improvement_actions: List[str] = []
    if draft_count > 0 and _safe_ratio(draft_count, rule_count) > 0.3:
        improvement_actions.append(
            f"{draft_count} of {rule_count} rule(s) are still drafts -- review and promote them or archive if abandoned."
        )
    if ratios["reviewer_coverage"] < 0.5:
        improvement_actions.append(
            f"Only {reviewer_backed_count} of {rule_count} rule(s) have a recorded medical reviewer -- "
            "increase review coverage before treating this pack as clinically vetted."
        )
    if total_domains and ratios["domain_coverage"] < 0.2:
        improvement_actions.append(
            f"This pack backs only {domain_count} of {total_domains} known clinical domains -- "
            "consider whether broader domain coverage is in scope for it."
        )
    if stale_rules:
        improvement_actions.append(
            f"{len(stale_rules)} rule(s) have not been reviewed or updated in over {_FRESHNESS_WINDOW_DAYS} days -- "
            "schedule a review pass."
        )
    if deprecated_count > 0 and _safe_ratio(deprecated_count, rule_count) > 0.2:
        improvement_actions.append(
            f"{deprecated_count} deprecated rule(s) remain in this pack -- consider removing them from active tracking."
        )
    if not improvement_actions:
        improvement_actions.append("No immediate action identified -- this pack meets this audit's baseline thresholds.")

    return {
        "pack_id": pack.get("pack_id"),
        "rule_count": rule_count,
        "quality_score": quality_score,
        "quality_level": _quality_level(quality_score),
        "status_counts": {
            "draft": draft_count,
            "reviewed": reviewed_count,
            "active": active_count,
            "deprecated": deprecated_count,
            # See module LIMITATIONS: this codebase has no distinct
            # "approved" governance_status -- "active" is its approved/
            # live state. Exposed under both keys so a caller looking for
            # either vocabulary finds the same number, not a missing field.
            "approved": active_count,
        },
        "reviewer_coverage": {
            "reviewer_backed_count": reviewer_backed_count,
            "reviewer_backed_ratio": round(ratios["reviewer_coverage"], 4),
            "reviewers": pack.get("reviewers") or [],
        },
        "domain_coverage": {
            "domain_count": domain_count,
            "total_known_domains": total_domains,
            "domain_coverage_ratio": round(ratios["domain_coverage"], 4),
            "domains": pack.get("domains") or [],
        },
        "freshness": {
            "fresh_count": fresh_count,
            "stale_count": len(stale_rules),
            "freshness_ratio": round(ratios["freshness_ratio"], 4),
            "freshness_window_days": _FRESHNESS_WINDOW_DAYS,
            "stale_rule_ids": [r.get("id") for r in stale_rules if isinstance(r, dict)],
        },
        "score_breakdown": score_breakdown,
        "improvement_actions": improvement_actions,
    }


def build_rule_pack_quality(
    rules: List[Dict[str, Any]] | None = None,
    *,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Pure aggregation over rule_packs.py's existing pack grouping -- see
    module docstring for the scoring formula and its documented
    limitations. Never raises on missing/malformed input (delegates
    malformed-row handling to build_rule_packs, which already tolerates
    non-dict rows); never mutates `rules`. `now` is injectable purely for
    deterministic testing of the freshness axis -- production callers
    should omit it (defaults to the current UTC time)."""
    resolved_now = now or datetime.now(timezone.utc)
    if resolved_now.tzinfo is None:
        resolved_now = resolved_now.replace(tzinfo=timezone.utc)

    packs_result = build_rule_packs(rules)
    total_domains = len(_domain_alias_map())

    raw_rules_by_pack: Dict[str, List[Dict[str, Any]]] = {}
    for rule in rules or []:
        if not isinstance(rule, dict):
            continue
        raw_rules_by_pack.setdefault(_pack_key_for_rule(rule), []).append(rule)

    scored_packs = {
        pack_id: _score_pack(
            pack,
            raw_rules=raw_rules_by_pack.get(pack_id, []),
            total_domains=total_domains,
            now=resolved_now,
        )
        for pack_id, pack in packs_result["packs"].items()
    }

    measurable = [p for p in scored_packs.values() if p["quality_score"] is not None]
    average_score = round(sum(p["quality_score"] for p in measurable) / len(measurable), 2) if measurable else None
    weakest_pack_id = min(measurable, key=lambda p: p["quality_score"])["pack_id"] if measurable else None
    strongest_pack_id = max(measurable, key=lambda p: p["quality_score"])["pack_id"] if measurable else None

    return {
        "version": RULE_PACK_QUALITY_VERSION,
        "generated_at": resolved_now.isoformat(),
        "packs": scored_packs,
        "summary": {
            "pack_count": len(scored_packs),
            "measurable_pack_count": len(measurable),
            "average_quality_score": average_score,
            "strongest_pack_id": strongest_pack_id,
            "weakest_pack_id": weakest_pack_id,
            "level_counts": {
                level: len([p for p in scored_packs.values() if p["quality_level"] == level])
                for level in ("strong", "adequate", "needs_attention", "weak", "empty")
            },
        },
        "methodology": {
            "weights": dict(_WEIGHTS),
            "freshness_window_days": _FRESHNESS_WINDOW_DAYS,
            "level_thresholds": {label: threshold for threshold, label in _LEVEL_THRESHOLDS} | {_LOW_LEVEL: 0.0},
            "limitations": [
                "The 365-day freshness window is a simple, documented default, not a clinically-derived threshold.",
                "'approved' is an alias for the 'active' governance_status -- this codebase has no separate approved state.",
                "Domain coverage measures breadth, not per-domain clinical depth or correctness.",
                "This is a governance/structure health score, not a measure of clinical accuracy.",
            ],
        },
    }
