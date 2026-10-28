"""Stable identity helpers for generated report actions."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Iterable, List


def _fingerprint(value: Dict[str, Any]) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()[:16]


def assign_action_ids(items: Iterable[Dict[str, Any]], namespace: str) -> List[Dict[str, Any]]:
    assigned: List[Dict[str, Any]] = []
    used: set[str] = set()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        updated = dict(item)
        existing = str(updated.get("action_id") or "").strip()
        if not existing:
            source_key = str(updated.get("key") or "").strip()
            identity = source_key or _fingerprint(updated)
            existing = f"v1:{namespace}:{identity}:{index}"
        if existing in used:
            existing = f"{existing}:{index}"
        updated["action_id"] = existing
        used.add(existing)
        assigned.append(updated)
    return assigned