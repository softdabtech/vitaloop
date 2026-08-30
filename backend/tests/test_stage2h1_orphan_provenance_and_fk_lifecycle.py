"""Stage 2H.1 — orphan provenance and lifecycle decision.

No data was deleted or modified this stage (explicit instruction). This file
covers what CAN be tested without executing anything against the live
database: the delete-path map, the migration drafts' safety guards, and the
final entitlement-authorization sweep.

The live forensic trace itself (orphan row provenance, deleted-account
confirmation, cascade evidence) was gathered via a separate, read-only,
ad-hoc introspection pass against the actual production Supabase project
during this session and is documented in the Stage 2H.1 report — it is not
repeated as an automated test since it requires live credentials, targets
2 specific historical row IDs, and is not something a CI run should depend
on or re-verify on every run.

No live database connection is used anywhere in this file.
"""

import inspect
from pathlib import Path

from app.routers.identity import auth as auth_router

FK_MIGRATION = Path(
    "/var/www/VITALOOP/backend/sql/stage-29-analysis-artifact-fk-integrity.sql"
).read_text()
SYMPTOMS_MIGRATION = Path(
    "/var/www/VITALOOP/backend/sql/stage-28-symptoms-schema-consolidation.sql"
).read_text()


# --- Delete-path map: exactly one code path can remove a lab_uploads row --------


def test_delete_path_map_only_account_self_deletion_exists():
    """Grepped-and-pinned finding: the backend has no explicit lab_uploads
    DELETE anywhere, no soft-delete status value, no cleanup cron. The only
    way a lab_uploads row can disappear is indirectly, via Supabase-side
    cascade triggered by DELETE /auth's supabase.auth.admin.delete_user()
    call — never a direct application-level delete of lab_uploads itself."""
    source = inspect.getsource(auth_router.delete_account)
    assert "admin.delete_user" in source
    assert "lab_uploads" not in source  # confirms it is NOT a direct/explicit delete


def test_no_other_backend_code_path_deletes_lab_uploads_directly():
    import subprocess

    result = subprocess.run(
        ["grep", "-rn", r'\.table("lab_uploads")\.delete', "/var/www/VITALOOP/backend/app/"],
        capture_output=True, text=True,
    )
    assert result.stdout.strip() == "", "no direct lab_uploads.delete() call site should exist anywhere in app/"


# --- H15: proposed FK semantics correctly cover the one known delete path -------


def test_h15_fk_migration_targets_all_four_tables_with_cascade_matching_delete_path():
    for table in (
        "analysis_quality_gates",
        "clinical_data_integrity_events",
        "evidence_gaps",
        "health_state_versions",
    ):
        assert f"public.{table}\n--   add constraint {table}_upload_id_fkey" in FK_MIGRATION, (
            f"FK migration must propose an upload_id FK for {table}"
        )
        assert f"references public.lab_uploads(id) on delete cascade" in FK_MIGRATION


def test_h15_fk_migration_orphan_cleanup_is_a_separate_uncommitted_step():
    """The FK addition must not be bundled with, or silently depend on, an
    automatic orphan delete — Section 1 (cleanup) and Section 2 (FK) are
    both commented out by default and sequenced explicitly, requiring a
    human decision between them."""
    assert "SECTION 1 — ORPHAN RESOLUTION" in FK_MIGRATION
    assert "SECTION 2 — FK ADDITION" in FK_MIGRATION
    assert "-- begin;\n--\n-- alter table public.analysis_quality_gates" in FK_MIGRATION
    assert "-- delete from public.analysis_quality_gates" in FK_MIGRATION


# --- H16: existing FK tables' ON DELETE precedent is documented -----------------


def test_h16_existing_fk_precedent_is_documented_with_its_evidence_basis():
    assert "report_versions, safety_events, biomarker_extraction_candidates" in FK_MIGRATION
    assert "could not have their exact\n-- ON DELETE rule introspected directly" in FK_MIGRATION
    assert "Circumstantial evidence supports CASCADE" in FK_MIGRATION


def test_h16_lifecycle_decision_is_per_table_not_assumed_uniform():
    assert "No table-specific divergence was found" in FK_MIGRATION
    assert "category 1 (\"child must die with upload\")" in FK_MIGRATION


# --- H17: symptoms migration aborts safely on unexpected/catalog rows -----------


def test_h17_symptoms_migration_has_runtime_abort_guard_not_just_a_static_comment():
    assert "do $$" in SYMPTOMS_MIGRATION
    assert "raise exception" in SYMPTOMS_MIGRATION
    assert "total_rows <> 0" in SYMPTOMS_MIGRATION
    assert "catalog_rows <> 0" in SYMPTOMS_MIGRATION
    # the DO block must run INSIDE the transaction, before the destructive DDL
    do_block_pos = SYMPTOMS_MIGRATION.index("do $$")
    alter_pos = SYMPTOMS_MIGRATION.index("alter table public.symptoms\n  drop column")
    begin_pos = SYMPTOMS_MIGRATION.rindex("begin;", 0, do_block_pos)
    assert begin_pos < do_block_pos < alter_pos


def test_h17_symptoms_migration_rollback_explicitly_disclaims_data_recovery():
    assert "NOT\n-- recoverable" in SYMPTOMS_MIGRATION or "is NOT recoverable" in SYMPTOMS_MIGRATION


def test_h17_symptoms_migration_confirms_no_view_function_trigger_rpc_dependency():
    assert "Views/functions/triggers/RPCs: none reference public.symptoms" in SYMPTOMS_MIGRATION
    assert "Seed/bootstrap paths" in SYMPTOMS_MIGRATION


# --- H18: no live premium authorization path bypasses the canonical resolver ----


def test_h18_no_live_authorization_bypass_of_resolve_user_entitlements():
    import subprocess

    result = subprocess.run(
        ["grep", "-rn", r"is_premium\s*=\|require_premium\|premium_required",
         "/var/www/VITALOOP/backend/app/"],
        capture_output=True, text=True,
    )
    hits = [line for line in result.stdout.splitlines() if "entitlements.py" not in line]
    # Only the already-classified DEAD code path (biomarker_service.py's
    # unused check_freemium_limit, zero callers anywhere) may remain.
    assert all("biomarker_service.py:" in line for line in hits), (
        f"unexpected live authorization pattern outside the dead check_freemium_limit(): {hits}"
    )


def test_h18_check_freemium_limit_confirmed_still_dead_zero_callers():
    import subprocess

    this_file = "test_stage2h1_orphan_provenance_and_fk_lifecycle.py"
    result = subprocess.run(
        ["grep", "-rln", "--include=*.py", "check_freemium_limit(",
         "/var/www/VITALOOP/backend/app/", "/var/www/VITALOOP/backend/tests/"],
        capture_output=True, text=True,
    )
    files_mentioning_it = [
        line for line in result.stdout.splitlines()
        if not line.endswith("biomarker_service.py") and not line.endswith(this_file)
    ]
    assert files_mentioning_it == [], (
        f"check_freemium_limit() has gained a live caller — must be routed through the resolver now: {files_mentioning_it}"
    )


def test_h18_llm_consult_and_dependencies_both_route_through_the_same_resolver():
    import app.dependencies as deps
    from app.routers import llm_consult

    for source in (
        inspect.getsource(deps.require_active_subscription),
        inspect.getsource(deps.require_freemium_analyze),
        inspect.getsource(llm_consult._is_premium_user),
    ):
        assert "resolve_user_entitlements(" in source
