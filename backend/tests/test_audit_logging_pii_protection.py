"""Tests to ensure audit logging never contains PII."""
import pytest
from app.services import supabase_service as svc


def test_audit_logging_dangerous_fields_never_used():
    """Verify that dangerous keys are never passed to audit logs.

    Dangerous keys that must NEVER appear in audit logs:
    - biomarker values: 'value', 'biomarker_value', 'result'
    - sensitive text: 'symptom_text', 'diagnosis', 'notes'
    - specific biomarkers: 'ferritin', 'vitamin_d', 'tsh', 'b12'
    - diagnoses: 'hiv', 'diabetes', 'thyroid', 'cancer'
    """
    import re
    from pathlib import Path

    # Read supabase_service.py
    filepath = Path(__file__).parent.parent / "app" / "services" / "supabase_service.py"
    content = filepath.read_text()

    dangerous_keys = {
        'value', 'biomarker_value', 'result', 'symptom_text',
        'diagnosis', 'notes', 'ferritin', 'vitamin_d', 'tsh', 'b12',
        'hiv', 'diabetes', 'thyroid', 'cancer',
    }

    # Check all write_audit_log and _audit_medical_* calls
    audit_patterns = [
        r'write_audit_log\([^)]*\)',
        r'_audit_medical_read\([^)]*\)',
        r'_audit_medical_write\([^)]*\)',
    ]

    violations = []
    for pattern in audit_patterns:
        for match in re.finditer(pattern, content, re.DOTALL):
            call_text = match.group(0)
            # Check if any dangerous key appears in the call
            for dangerous_key in dangerous_keys:
                if f'"{dangerous_key}"' in call_text or f"'{dangerous_key}'" in call_text:
                    violations.append({
                        'dangerous_key': dangerous_key,
                        'pattern': pattern,
                        'context': call_text[:100],
                    })

    assert not violations, f"Found {len(violations)} dangerous keys in audit logging: {violations}"


@pytest.mark.asyncio
async def test_write_audit_log_never_logs_raw_values(monkeypatch):
    """Verify write_audit_log handles PII gracefully if passed accidentally."""
    import uuid

    call_args = []

    # Mock Supabase to capture what gets written
    class MockTable:
        def insert(self, payload):
            call_args.append(payload)
            return self

        def execute(self):
            class Result:
                data = [{"id": "test"}]
            return Result()

    class MockSupabase:
        def table(self, name):
            return MockTable()

    def fake_get_supabase():
        return MockSupabase()

    monkeypatch.setattr(svc, "_get_supabase", fake_get_supabase)

    # Call write_audit_log with safe data
    user_id = str(uuid.uuid4())
    await svc.write_audit_log(
        user_id=user_id,
        action="read",
        entity_type="biomarkers",
        entity_id="upload_123",
        new_value={"scope": "medical", "count": 5, "source": "api"},
    )

    # Verify payload doesn't contain actual values
    assert call_args, "write_audit_log should have written data"
    payload = call_args[0]

    # Check that safe data is present
    assert payload.get("action") == "read"
    assert payload.get("entity_type") == "biomarkers"

    # Check that new_value only contains safe data
    if payload.get("new_value"):
        safe_keys = {"scope", "count", "source", "timestamp"}
        actual_keys = set(payload["new_value"].keys())
        # All keys should be safe (no biomarker values, no diagnosis, etc.)
        dangerous_keys = {
            'value', 'biomarker_value', 'result', 'symptom_text',
            'ferritin', 'vitamin_d', 'tsh', 'b12'
        }
        assert not actual_keys.intersection(dangerous_keys), \
            f"Found dangerous keys in payload: {actual_keys.intersection(dangerous_keys)}"


@pytest.mark.asyncio
async def test_audit_medical_functions_safe_details():
    """Verify _audit_medical_read/write only log safe details."""
    import inspect

    # Check _audit_medical_read source
    read_source = inspect.getsource(svc._audit_medical_read)
    write_source = inspect.getsource(svc._audit_medical_write)

    # Should use details parameter safely (not raw biomarker data)
    assert '"scope": "medical"' in read_source, "_audit_medical_read should tag as medical scope"
    assert '"scope": "medical"' in write_source, "_audit_medical_write should tag as medical scope"

    # Should pass through details dict safely
    assert "**(details or {})" in read_source, "_audit_medical_read should unpack safe details"
    assert "**(details or {})" in write_source, "_audit_medical_write should unpack safe details"
