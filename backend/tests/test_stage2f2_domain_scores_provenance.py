"""Stage 2F.2 — provenance check for Questionnaire.jsx's `domain_scores`.

Point of truth: is `domain_scores` (computed by buildDomainScores() in
Questionnaire.jsx) harmless local/display-only state, or another
client-owned health interpretation that is persisted/consumed as
authoritative?

Trace performed (read-only, no production code changed in this stage):

1. Computation: buildDomainScores() in Questionnaire.jsx buckets raw wizard
   answers (bodySystem, selectedSymptoms, selectedTriggers, lifestyleContext,
   severity, duration) into 7 named point totals (energy_recovery, sleep,
   neurocognitive, digestive, metabolic, hormone, inflammation_safety).
2. Wiring: `domainScores` (a useMemo over the same inputs) is included in the
   PATCH /questionnaire/session/context payload as `domain_scores`.
3. Sent to backend: yes, verbatim, inside `summary`.
4. Backend storage: `session_metadata.summary` is stored/echoed as a passthrough
   blob (unchanged by this stage — same mechanism already covered by Stage
   2F.1's `_session_context()` passthrough tests). No backend code computes or
   overwrites `domain_scores`.
5. Consumers:
   - Frontend: grepped the entire frontend/src tree — the ONLY two references
     to domain_scores/domainScores anywhere are its own definition and its own
     inclusion in the PATCH payload, both in Questionnaire.jsx. No other
     frontend file (UserDashboard.jsx, LabPlan.jsx, or any other page/
     component) ever reads it back.
   - Backend: `health_context.py::_questionnaire_summary()` DOES contain a
     reader for a `domain_scores`/`scores`/`domains` key — but only on the
     `questionnaire` parameter of `build_health_context()`. Tracing every
     call site of `run_lab_analysis_pipeline()` (which is the only function
     that forwards a `questionnaire=` argument into `build_health_context`)
     shows:
       * app/routers/analysis/analyze.py (the entire B2C/consumer analyze
         surface — 8 call sites) — NEVER passes `questionnaire=`. It always
         defaults to `questionnaire: Optional[Dict[str, Any]] = None`.
       * app/routers/protocol/compatibility.py — same: never passes
         `questionnaire=`.
       * app/services/b2b/analyze_labs.py:602 — the ONLY call site that
         passes `questionnaire=request.questionnaire`. `request.questionnaire`
         is `B2BAnalyzeLabsRequest.questionnaire: Dict[str, Any]` — an
         arbitrary partner-submitted payload on the B2B ingestion API,
         structurally and semantically unrelated to VITALOOP's own
         Questionnaire.jsx concern-intake wizard / `questionnaire_sessions`
         table. A B2B partner happening to send a `domain_scores`-shaped key
         in their own request would be read here, but that has nothing to do
         with any VITALOOP consumer's wizard answers.
6. Influence: because `questionnaire` is never populated from
   `session_metadata.summary` for any consumer (B2C) code path, `domain_scores`
   from Questionnaire.jsx never reaches `build_health_context()`,
   `analysis_quality_gate`, the safety engine, the protocol/report generation,
   Health Score calculation, next-best-action, or any other user-facing health
   interpretation. It is written, stored/echoed, and read by nobody.

Conclusion: Case A — `domain_scores` is inert, write-only state for the
consumer product. It is technically persisted (as part of the summary blob)
but never authoritative and never consumed. No backend change is required or
made in this stage. This file exists to make that conclusion a checked,
regression-proof fact rather than a one-time trace.

No live database connection is used anywhere in this file.
"""

import inspect
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = REPO_ROOT / "frontend" / "src"
BACKEND_APP = REPO_ROOT / "backend" / "app"
BACKEND_SQL = REPO_ROOT / "backend" / "sql"

from app.services import health_context as health_context_module
from app.services import lab_analysis_pipeline
from app.services.health_context import build_health_context


QUESTIONNAIRE_JSX = (FRONTEND_SRC / "pages/Questionnaire.jsx").read_text()
DASHBOARD_JSX = (FRONTEND_SRC / "pages/UserDashboard.jsx").read_text()
LAB_PLAN_JSX_PATH = (FRONTEND_SRC / "pages/LabPlan.jsx")


# --- G1: domain_scores is computed and sent by Questionnaire.jsx only -----------


def test_g1_domain_scores_defined_and_sent_only_in_questionnaire_jsx():
    assert "buildDomainScores" in QUESTIONNAIRE_JSX
    assert "domain_scores: domainScores" in QUESTIONNAIRE_JSX


def test_g1_no_other_frontend_file_reads_domain_scores():
    frontend_src = FRONTEND_SRC
    hits = []
    for path in frontend_src.rglob("*.js*"):
        if path.name == "Questionnaire.jsx":
            continue
        text = path.read_text(errors="ignore")
        if "domain_scores" in text or "domainScores" in text:
            hits.append(str(path))
    assert hits == [], f"unexpected frontend consumer(s) of domain_scores: {hits}"


def test_g1_dashboard_and_lab_plan_do_not_reference_domain_scores():
    assert "domain_scores" not in DASHBOARD_JSX
    assert "domainScores" not in DASHBOARD_JSX
    if LAB_PLAN_JSX_PATH.exists():
        lab_plan_jsx = LAB_PLAN_JSX_PATH.read_text()
        assert "domain_scores" not in lab_plan_jsx
        assert "domainScores" not in lab_plan_jsx


# --- G2: backend has a reader, but it is never fed real consumer data -----------


def test_g2_health_context_has_a_domain_scores_reader():
    """Confirms the reader exists (so we are not claiming it doesn't) —
    the important fact is which callers can ever reach it, checked below."""
    source = inspect.getsource(health_context_module._questionnaire_summary)
    assert "domain_scores" in source


def test_g2_b2c_analyze_router_never_passes_questionnaire_kwarg():
    analyze_source = (BACKEND_APP / "routers/analysis/analyze.py").read_text()
    assert "questionnaire=" not in analyze_source, (
        "if this now fails, analyze.py has started wiring a questionnaire "
        "argument into run_lab_analysis_pipeline() — domain_scores provenance "
        "must be re-assessed, this is no longer dead data"
    )


def test_g2_compatibility_router_never_passes_questionnaire_kwarg():
    compat_source = (BACKEND_APP / "routers/protocol/compatibility.py").read_text()
    assert "questionnaire=" not in compat_source


def test_g2_only_b2b_analyze_labs_supplies_a_questionnaire_argument():
    pipeline_source = (BACKEND_APP / "services/lab_analysis_pipeline.py").read_text()
    b2b_source = (BACKEND_APP / "services/b2b/analyze_labs.py").read_text()
    # run_lab_analysis_pipeline defaults questionnaire to None
    assert "questionnaire: Optional[Dict[str, Any]] = None" in pipeline_source
    # the only real caller that ever overrides that default is B2B, using the
    # partner's own arbitrary request payload — not VITALOOP's own wizard data
    assert "questionnaire=request.questionnaire" in b2b_source


def test_g2_default_questionnaire_none_means_domain_scores_key_absent():
    """Proves the actual runtime behavior for every B2C caller: with
    questionnaire=None (the default every B2C call site uses),
    _questionnaire_summary() never surfaces a domain_scores key at all."""
    ctx = build_health_context(biomarkers=[], symptoms=[], questionnaire=None)
    summary = (ctx.get("inputs") or {}).get("questionnaire") or {}
    assert summary.get("present") is not True
    assert "domain_scores" not in summary or not summary.get("domain_scores")


def test_g2_even_a_malicious_b2c_style_questionnaire_dict_is_never_wired_in():
    """There is no code path today where a B2C caller could pass a
    Questionnaire.jsx-shaped dict into run_lab_analysis_pipeline at all — this
    test documents that IF someone did (hypothetically), the reader would
    pick it up, which is exactly why the real finding here is about the
    absence of wiring, not the absence of a reader."""
    fabricated = {"domain_scores": {"energy_recovery": 999}}
    ctx = build_health_context(biomarkers=[], symptoms=[], questionnaire=fabricated)
    summary = (ctx.get("inputs") or {}).get("questionnaire") or {}
    assert summary.get("domain_scores") == {"energy_recovery": 999}
    # ^ proves the reader is real and would trust this if fed — reinforcing
    # that the safety of the consumer product depends entirely on the fact
    # that analyze.py/compatibility.py never construct or pass such a dict,
    # which the two tests above pin as a regression guard.


# --- G3: domain_scores does not influence quality gate / safety / protocol ------


def test_g3_quality_gate_and_safety_modules_do_not_read_domain_scores():
    import subprocess

    result = subprocess.run(
        ["grep", "-rl", "domain_scores",
         str(BACKEND_APP / "services/analysis_quality_gate.py"),
         str(BACKEND_APP / "services/safety/safety_engine.py"),
         str(BACKEND_APP / "services/lab_analysis_pipeline.py")],
        capture_output=True, text=True,
    )
    assert result.stdout.strip() == "", "no analysis-pipeline module should read domain_scores"


# --- G4: sanity — lab_analysis_pipeline still forwards questionnaire=None by default,
#          confirming this stage changed no wiring/behavior -----------------------


def test_g4_pipeline_module_imported_without_error_and_signature_unchanged():
    sig = inspect.signature(lab_analysis_pipeline.run_lab_analysis_pipeline)
    assert sig.parameters["questionnaire"].default is None
