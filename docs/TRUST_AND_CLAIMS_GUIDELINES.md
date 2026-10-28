# VITALOOP Trust & Claims Guidelines (P13)

**Status:** v1, 2026-09-14. Practical governance guardrail, not a legal filing.
Owner: product + engineering. Update this file whenever new public copy,
a new safety/escalation surface, or a new AI-generated claim type ships —
treat a stale version of this doc as a bug, the same way stale docs are
treated elsewhere in this repo.

## Why this exists

By P10, VITALOOP had shipped a real explainable clinical reasoning layer —
patterns with confidence and evidence, evidence gaps, personal baseline,
progress tracking, a system map, a role-segmented action plan, and a
knowledge-rule governance/coverage system. That is a genuine trust asset
(see [FDA CDS guidance](https://www.fda.gov/) and
[ONC HTI-1](https://www.healthit.gov/topic/laws-regulation-and-policy/health-data-technology-and-interoperability-hti-1-final-rule)
on transparency for predictive decision support) — but only if every
surface that describes it, publicly or internally, uses consistent,
accurate, non-diagnostic language. This file is the single reference for
what VITALOOP is allowed to claim, so a new feature doesn't quietly
introduce marketing language the product doesn't back up.

## 1. Approved framing (use these)

| Say this | Not this |
|---|---|
| "Wellness support / educational decision support" | "Clinical decision-making tool" |
| "Possible pattern" / "context signal" | "Diagnosis" / "condition" |
| "Discussion points for your doctor/nutritionist" | "Treatment plan" / "prescription" |
| "Confidence: high / moderate / low" | "We are sure" / "definitely" |
| "Evidence gap" / "not enough data yet" | (never silently omit uncertainty) |
| "Traceable to a specific matched rule/pattern" | "AI-powered insight" (unqualified) |
| "Retest suggested" / "next best test" | "Required test" / "you must get tested" |
| "Discuss urgently" / "doctor-only" (from the P9 buckets) | "Medical emergency" (unless the safety engine's own IMMEDIATE tier says so verbatim) |

## 2. Forbidden wording (hard blocks)

These already have a runtime guard — `governance.py::_ensure_text_without_forbidden`
rejects `"confirmed diagnosis"` / `"diagnosis confirmed"` in any knowledge-rule
`outputs.summary` or recommendation text before it can reach `active` status.
Public copy and CRM/practitioner text must hold the same bar even though
nothing currently lints it automatically:

- "confirmed diagnosis" / "diagnosis confirmed"
- "you have [condition]" (stated as fact rather than a pattern/signal)
- "guaranteed to work" / "clinically proven to cure"
- "replaces your doctor" (the FAQ already correctly says the opposite)
- "FDA-cleared" / "FDA-approved" (VITALOOP is not; never imply otherwise)
- Any absolute-certainty phrasing for a `low_confidence` or
  `blocked_by_missing_data` finding

## 3. The reasoning chain, in one sentence

Every surface that describes "how VITALOOP knows this" should be able to
complete this sentence without inventing new mechanics:

> symptoms + biomarkers → detected pattern → confidence + evidence gaps →
> safety level → next best tests → action bucket (self / practitioner /
> doctor / urgent)

This is not aspirational — it is exactly what `clinical_reasoning_trace.py`,
`evidence_gaps.py`, `personal_baseline.py`, and `action_plan_by_role.py`
already compute (P1–P9). Public copy describing the product's reasoning
should trace back to this chain, not a generic "AI analyzes your labs."

## 4. Medical-boundary vocabulary (must match across every surface)

P9's four buckets are the canonical vocabulary. Do not introduce a fifth
bucket or rename these elsewhere (support docs, CRM, emails) without
updating this file and every surface at once:

| Bucket | User-facing label (Results.jsx) | Practitioner-facing label (CRM) |
|---|---|---|
| `urgent` | "Urgent — discuss promptly" | "Urgent — discuss promptly" |
| `doctor` | "Discuss with a doctor" | "Discuss with a doctor" |
| `practitioner` | "Bring to a specialist / nutritionist" | "Bring to a specialist" |
| `self` | "You can do yourself" | "Client can do themselves" |

If a future feature needs a new bucket or relabels an existing one, update
`action_plan_by_role.py`, `Results.jsx`, `ProtocolPage.jsx`, and
`Areas/Practitioner/Views/Clients/Profile.cshtml` together — a mismatch
between what the client sees and what the practitioner sees is exactly the
inconsistency P9 was built to prevent.

## 5. Governance trust signals (safe to state publicly)

These are true today and can be stated on public pages without
overclaiming:

- Every active knowledge rule went through a draft → reviewed → active
  lifecycle with a named medical reviewer and a change note
  (`governance.py::approve_rule` enforces both fields; there is no bulk or
  automatic approval path — confirmed in `KnowledgeRulesController`'s own
  docstring).
- Rule coverage per clinical domain is tracked, not assumed
  (`governance_coverage.py`, P10) — gaps are visible internally, not
  hidden.
- Every recommendation traces to a specific matched pattern or rule
  (`clinical_reasoning_trace.py`, P2), not an opaque model output.
- A full audit trail exists per rule (`get_rule_audit`).

Do **not** state anything beyond this — e.g. do not claim "physician
network," "board-certified review," or a specific regulatory clearance
unless a real one exists and is confirmed with legal/compliance sign-off
outside this repo.

## 6. Pre-launch checklist for any new AI-generated or clinical-sounding surface

Before shipping a new feature that generates or displays a
recommendation, pattern, score, or escalation:

- [ ] Does the copy avoid every phrase in §2?
- [ ] Does the surface show (or link to) a confidence/evidence-gap
      indicator when the underlying data has one available?
- [ ] If it can trigger a doctor/urgent escalation, does it use the exact
      §4 vocabulary — not a new synonym?
- [ ] Is there a disclaimer reachable from the surface (either inline or
      via the existing global disclaimer) stating VITALOOP does not
      diagnose, treat, or replace professional medical advice?
- [ ] If the feature reads/writes knowledge rules, does it respect the
      existing governance lifecycle (draft/review/approve) rather than
      adding a second, parallel path to "active"?
- [ ] Has this file been updated if the feature introduces a genuinely new
      claim type not covered above?

## 7. Known gaps as of 2026-09-14 (not blockers, just tracked)

- Landing.jsx's "How it works" step copy was written before P1–P10 shipped
  the richer reasoning layer; the "Why it matters" step was updated in
  this pass to mention confidence/evidence gaps, but the rest of the
  marketing site has not had a full copy pass against this file yet —
  flagged here rather than rewritten wholesale without design/marketing
  review.
- No automated lint currently enforces §2 outside of
  `governance.py`'s knowledge-rule-specific check. A future improvement
  would be a CI grep step over `frontend/src/pages/*.jsx` and
  `crm-mvc/**/*.cshtml` for the §2 phrase list.
