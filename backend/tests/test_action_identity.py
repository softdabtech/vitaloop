from app.services.action_identity import assign_action_ids
from app.services.lab_normalization.biomarker_mapping import to_known_canonical_name
from app.services.next_best_test_engine import attach_report_provenance, build_next_best_tests
from app.services import supabase_service


def test_action_ids_are_deterministic_unique_and_reload_safe():
    items = [
        {"key": "iron_support", "title": "Iron support"},
        {"title": "Recovery", "body": "Prioritize sleep."},
    ]

    first = assign_action_ids(items, "action-plan")
    reloaded = assign_action_ids(items, "action-plan")

    first_ids = [item["action_id"] for item in first]
    assert all(first_ids)
    assert len(first_ids) == len(set(first_ids))
    assert first_ids == [item["action_id"] for item in reloaded]


def test_next_test_recommendation_identity_is_deterministic_and_report_scoped():
    kwargs = {
        "evidence_gaps": {
            "gaps": [{
                "missing_marker": "hemoglobin",
                "domain": "iron",
                "priority": "high",
                "reason": "domain_expected_marker",
            }]
        },
        "patterns": [],
    }

    first = build_next_best_tests(**kwargs)
    reloaded = build_next_best_tests(**kwargs)
    first_item = first["recommended_tests"][0]
    reloaded_item = reloaded["recommended_tests"][0]

    assert first_item["recommendation_id"] == reloaded_item["recommendation_id"]
    assert first_item["recommendation_id"].startswith(
        "v1:next-test:evidence_gaps:hemoglobin:"
    )
    assert "action_id" not in first_item
    assert first_item["canonical_marker"] == "hemoglobin"

    report_one = attach_report_provenance(first, "report-1")
    report_two = attach_report_provenance(first, "report-2")
    assert report_one["recommended_tests"][0]["source_report_version_id"] == "report-1"
    assert report_two["recommended_tests"][0]["source_report_version_id"] == "report-2"
    assert (
        report_one["recommended_tests"][0]["recommendation_id"]
        == report_two["recommended_tests"][0]["recommendation_id"]
    )


def test_existing_biomarker_mapping_resolves_mch_aliases_without_collapsing_unknowns():
    assert to_known_canonical_name("mch") == "mch"
    assert to_known_canonical_name("Mean Corpuscular Hemoglobin") == "mch"
    assert to_known_canonical_name("unknown marker one") is None
    assert to_known_canonical_name("unknown marker two") is None


class _CompletionQuery:
    def __init__(self, client):
        self.client = client
        self.filters = []
        self.payload = None

    def select(self, *_args):
        return self

    def eq(self, key, value):
        self.filters.append((key, str(value)))
        return self

    def limit(self, _count):
        return self

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        if self.payload is not None:
            row = {"id": "event-1", **self.payload}
            self.client.rows.append(row)
            return type("Response", (), {"data": [dict(row)]})()
        rows = [
            row for row in self.client.rows
            if all(str(row.get(key)) == value for key, value in self.filters)
        ]
        return type("Response", (), {"data": [dict(row) for row in rows]})()


class _CompletionClient:
    def __init__(self):
        self.rows = []

    def table(self, _name):
        return _CompletionQuery(self)


def test_protocol_action_completion_is_idempotent(monkeypatch):
    client = _CompletionClient()
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: client)

    first = __import__("asyncio").run(
        supabase_service.complete_protocol_action(
            user_id="user-1",
            action_id="v1:action-plan:iron:0",
            report_version_id="report-1",
            label="Complete action",
        )
    )
    second = __import__("asyncio").run(
        supabase_service.complete_protocol_action(
            user_id="user-1",
            action_id="v1:action-plan:iron:0",
            report_version_id="report-1",
            label="Complete action",
        )
    )

    assert first["id"] == second["id"]
    assert len(client.rows) == 1